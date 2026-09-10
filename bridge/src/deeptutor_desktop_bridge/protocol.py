"""Desktop Bridge JSON-RPC protocol and DeepTutor event translation.

Desktop Bridge JSON-RPC protocol and DeepTutor event translation.

桌面 Bridge 的 JSON-RPC 协议与 DeepTutor 事件转换逻辑。
"""

from __future__ import annotations

import asyncio
import platform
from collections.abc import Awaitable, Callable
from typing import Any

from .agent_adapter import AgentAdapter, AgentAdapterError

PROTOCOL_VERSION = 1
BRIDGE_VERSION = "0.1.0"
JsonMessage = dict[str, Any]
EventEmitter = Callable[[JsonMessage], Awaitable[None]]


def _success(request_id: Any, result: dict[str, Any]) -> JsonMessage:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _error(
    request_id: Any,
    code: str,
    message: str,
    *,
    retryable: bool = False,
) -> JsonMessage:
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": code, "message": message, "retryable": retryable},
    }


def _request_id(request: dict[str, Any]) -> Any:
    value = request.get("id")
    if value is None or (isinstance(value, (str, int)) and not isinstance(value, bool)):
        return value
    raise ValueError("id must be a string, integer, or null")


def _validate_request(request: object) -> tuple[dict[str, Any], Any, str, dict[str, Any]]:
    if not isinstance(request, dict):
        raise ValueError("Request must be a JSON object")
    request_id = _request_id(request)
    if request.get("jsonrpc") != "2.0":
        raise ValueError("jsonrpc must be '2.0'")
    method = request.get("method")
    if not isinstance(method, str) or not method:
        raise ValueError("method must be a non-empty string")
    params = request.get("params", {})
    if not isinstance(params, dict):
        raise ValueError("params must be an object")
    return request, request_id, method, params


def _runtime_info(adapter: AgentAdapter) -> dict[str, Any]:
    """Build the handshake payload without initializing DeepTutor.

    Build the handshake payload without initializing DeepTutor.

    构造握手信息时不初始化 DeepTutor, 避免健康检查触发数据库或模型配置加载。
    """

    return {
        "protocol_version": PROTOCOL_VERSION,
        "agent_name": "deeptutor",
        "agent_version": adapter.agent_version if adapter.available else None,
        "bridge_version": BRIDGE_VERSION,
        "runtime_target": f"{platform.system().lower()}-{platform.machine().lower()}",
        "agent_available": adapter.available,
        "agent_connected": adapter.connected,
    }


def _event_name(event_type: str) -> str:
    names = {
        "content": "chat.delta",
        "thinking": "chat.thinking",
        "stage_start": "chat.stage_start",
        "stage_end": "chat.stage_end",
        "tool_call": "chat.tool_call",
        "tool_result": "chat.tool_result",
        "progress": "chat.progress",
        "sources": "chat.sources",
        "result": "chat.result",
        "error": "chat.error",
        "session": "session.started",
        "session_meta": "session.meta",
        "done": "chat.done",
        "wait_for_input": "chat.wait_for_input",
    }
    return names.get(event_type, f"agent.{event_type or 'event'}")


def _translate_event(event: dict[str, Any], request_id: Any) -> JsonMessage:
    """Convert one SDK event to the stable desktop event envelope.

    Convert one SDK event to the stable desktop event envelope.

    将一个 SDK 事件转换成稳定的桌面事件 envelope。
    """

    event_type = str(event.get("type") or "event")
    params: JsonMessage = {
        "event": _event_name(event_type),
        "request_id": request_id,
        "turn_id": event.get("turn_id"),
        "session_id": event.get("session_id"),
        "source": event.get("source"),
        "stage": event.get("stage"),
        "content": event.get("content", ""),
        "text": event.get("content", ""),
        "metadata": event.get("metadata") or {},
        "seq": event.get("seq"),
        "timestamp": event.get("timestamp"),
    }
    if event_type == "done":
        params["status"] = str((event.get("metadata") or {}).get("status") or "completed")
    return {"jsonrpc": "2.0", "method": "event", "params": params}


class BridgeRuntime:
    """Own the SDK adapter and background event-forwarding tasks.

    Own the SDK adapter and background event-forwarding tasks.

    BridgeRuntime 持有 SDK 适配器以及后台事件转发任务。
    """

    def __init__(self, adapter: AgentAdapter | None = None) -> None:
        self.adapter = adapter or AgentAdapter()
        self._stream_tasks: dict[str, asyncio.Task[None]] = {}

    async def handle_request(
        self,
        request: object,
        emit: EventEmitter | None = None,
    ) -> tuple[JsonMessage, bool]:
        """Handle one request and return ``(response, should_exit)``.

        Handle one request and return ``(response, should_exit)``.

        ``chat.send`` acknowledges the new turn before its stream is forwarded.
        If no emitter is supplied, the turn is still started but events are not
        forwarded; this keeps the method straightforward to unit-test.

        ``chat.send`` 会先确认新 turn, 再转发其事件流。未提供 emitter 时仍会
        启动 turn, 但不会转发事件, 便于进行单元测试。
        """

        try:
            _request, request_id, method, params = _validate_request(request)
        except ValueError as exc:
            request_id = request.get("id") if isinstance(request, dict) else None
            return _error(request_id, "INVALID_REQUEST", str(exc)), False

        try:
            if method == "runtime.get_info":
                return _success(request_id, _runtime_info(self.adapter)), False
            if method == "runtime.health":
                return (
                    _success(
                        request_id,
                        {
                            "status": "ok" if self.adapter.available else "unavailable",
                            "agent_available": self.adapter.available,
                            "agent_connected": self.adapter.connected,
                        },
                    ),
                    False,
                )
            if method == "runtime.shutdown":
                return _success(request_id, {"status": "shutting_down"}), True
            if method == "chat.send":
                result = await self.adapter.start_turn(params)
                if emit is not None:
                    task = asyncio.create_task(
                        self._forward_events(request_id, result["turn_id"], emit)
                    )
                    self._stream_tasks[result["turn_id"]] = task
                    task.add_done_callback(
                        lambda _: self._stream_tasks.pop(result["turn_id"], None)
                    )
                return _success(request_id, result), False
            if method == "request.cancel":
                turn_id = self._require_turn_id(params)
                cancelled = await self.adapter.cancel_turn(turn_id)
                return _success(request_id, {"turn_id": turn_id, "cancelled": cancelled}), False
            if method == "chat.resume":
                turn_id = self._require_turn_id(params)
                text = params.get("text")
                if text is not None and not isinstance(text, str):
                    raise AgentAdapterError("text must be a string or null")
                answers = params.get("answers")
                if answers is not None and not isinstance(answers, list):
                    raise AgentAdapterError("answers must be an array")
                resumed = await self.adapter.submit_user_reply(turn_id, text, answers)
                return _success(request_id, {"turn_id": turn_id, "resumed": resumed}), False
            if method == "session.list":
                limit = self._bounded_int(params, "limit", 50, minimum=1, maximum=200)
                offset = self._bounded_int(params, "offset", 0, minimum=0, maximum=1_000_000)
                sessions = await self.adapter.list_sessions(limit=limit, offset=offset)
                return _success(
                    request_id, {"sessions": sessions, "limit": limit, "offset": offset}
                ), False
            if method == "session.get":
                session_id = self._require_string(params, "session_id")
                session = await self.adapter.get_session(session_id)
                return _success(request_id, {"session": session}), False
            return _error(request_id, "METHOD_NOT_FOUND", f"Unknown method: {method}"), False
        except (AgentAdapterError, ValueError) as exc:
            return _error(request_id, "INVALID_PARAMS", str(exc)), False
        except Exception as exc:
            return _error(request_id, "AGENT_ERROR", str(exc)), False

    async def _forward_events(self, request_id: Any, turn_id: str, emit: EventEmitter) -> None:
        """Forward a turn stream and translate unexpected SDK failures.

        Forward a turn stream and translate unexpected SDK failures.

        转发 turn 事件流, 并把未预期的 SDK 异常转换为协议错误事件。
        """

        try:
            async for event in self.adapter.stream_turn(turn_id):
                await emit(_translate_event(event, request_id))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            await emit(
                {
                    "jsonrpc": "2.0",
                    "method": "event",
                    "params": {
                        "event": "chat.error",
                        "request_id": request_id,
                        "turn_id": turn_id,
                        "code": "AGENT_ERROR",
                        "message": str(exc),
                        "retryable": False,
                    },
                }
            )

    @staticmethod
    def _require_turn_id(params: dict[str, Any]) -> str:
        return BridgeRuntime._require_string(params, "turn_id")

    @staticmethod
    def _require_string(params: dict[str, Any], name: str) -> str:
        value = params.get(name)
        if not isinstance(value, str) or not value.strip():
            raise AgentAdapterError(f"{name} must be a non-empty string")
        return value

    @staticmethod
    def _bounded_int(
        params: dict[str, Any], name: str, default: int, *, minimum: int, maximum: int
    ) -> int:
        value = params.get(name, default)
        if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
            raise AgentAdapterError(f"{name} must be an integer from {minimum} to {maximum}")
        return value

    async def close(self) -> None:
        """Cancel stream tasks and close the SDK runtime.

        Cancel stream tasks and close the SDK runtime.

        取消事件流任务并关闭 SDK 运行时。
        """

        tasks = list(self._stream_tasks.values())
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._stream_tasks.clear()
        await self.adapter.close()


def handle_request(request: object) -> tuple[JsonMessage, bool]:
    """Preserve the synchronous bootstrap API used by bridge unit tests.

    Preserve the synchronous bootstrap API used by bridge unit tests.

    保留 Bridge 单元测试使用的同步启动阶段 API; 完整异步处理由
    ``BridgeRuntime.handle_request`` 负责。
    """

    runtime = BridgeRuntime()
    try:
        _request, request_id, method, _params = _validate_request(request)
    except ValueError as exc:
        request_id = request.get("id") if isinstance(request, dict) else None
        return _error(request_id, "INVALID_REQUEST", str(exc)), False
    if method == "runtime.get_info":
        return _success(request_id, _runtime_info(runtime.adapter)), False
    if method == "runtime.health":
        return _success(
            request_id,
            {
                "status": "ok" if runtime.adapter.available else "unavailable",
                "agent_available": runtime.adapter.available,
                "agent_connected": runtime.adapter.connected,
            },
        ), False
    if method == "runtime.shutdown":
        return _success(request_id, {"status": "shutting_down"}), True
    return _error(request_id, "METHOD_NOT_FOUND", f"Unknown method: {method}"), False


__all__ = ["BRIDGE_VERSION", "PROTOCOL_VERSION", "BridgeRuntime", "handle_request"]
