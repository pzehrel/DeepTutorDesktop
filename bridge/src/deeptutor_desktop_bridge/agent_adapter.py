"""Adapter for the public DeepTutor Python SDK.

Adapter for the public DeepTutor Python SDK.

该模块只依赖 DeepTutor 的公开 ``DeepTutorApp`` facade, 把 SDK 类型隔离在
Bridge 内部, 避免 Tauri 或 Renderer 依赖 Python 实现细节。
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from importlib.metadata import PackageNotFoundError, version
from typing import Any

from deeptutor.app import DeepTutorApp, TurnRequest


class AgentAdapterError(RuntimeError):
    """Raised when a request cannot be translated to the DeepTutor SDK.

    当请求无法转换为 DeepTutor SDK 调用时抛出此异常。
    """


class AgentAdapter:
    """Translate desktop payloads into public ``DeepTutorApp`` operations.

    Translate desktop payloads into public ``DeepTutorApp`` operations.

    The application instance is created lazily on the first operation that needs
    the runtime. This keeps ``runtime.get_info`` cheap and lets health checks
    report package availability before a user has configured a model.

    应用实例会在第一次真正需要运行时才延迟创建。这样 ``runtime.get_info``
    不会触发运行时初始化, 也能在用户配置模型前报告 package 是否可用。
    """

    def __init__(self, app_factory: Callable[[], DeepTutorApp] = DeepTutorApp) -> None:
        self._app_factory = app_factory
        self._app: DeepTutorApp | None = None

    @property
    def available(self) -> bool:
        """Return whether the pinned SDK distribution can be imported.

        返回当前锁定的 SDK distribution 是否可以被导入。
        """

        try:
            _ = self.agent_version
        except PackageNotFoundError:
            return False
        return True

    @property
    def connected(self) -> bool:
        """Return whether the in-process SDK facade has been initialized.

        返回进程内 SDK facade 是否已经初始化。
        """

        return self._app is not None

    @property
    def agent_version(self) -> str:
        """Return the installed DeepTutor distribution version.

        返回已安装的 DeepTutor distribution 版本。
        """

        return version("deeptutor")

    def _get_app(self) -> DeepTutorApp:
        if self._app is None:
            self._app = self._app_factory()
        return self._app

    @staticmethod
    def _turn_payload(params: dict[str, Any]) -> dict[str, Any]:
        """Validate and normalize the desktop chat payload.

        Validate and normalize the desktop chat payload.

        ``message`` is the stable desktop field; DeepTutor's public contract
        calls the same value ``content``. Only fields explicitly supported by
        ``TurnRequest`` cross the adapter boundary.

        ``message`` 是桌面协议的稳定字段, 而 DeepTutor 公共契约把同一值称为
        ``content``。只有 ``TurnRequest`` 明确支持的字段才能穿过适配层。
        """

        if not isinstance(params, dict):
            raise AgentAdapterError("params must be an object")

        payload = dict(params)
        if "message" in payload and "content" in payload:
            raise AgentAdapterError("Use either message or content, not both")
        if "message" in payload:
            payload["content"] = payload.pop("message")

        allowed_fields = set(TurnRequest.model_fields)
        unknown_fields = sorted(set(payload) - allowed_fields)
        if unknown_fields:
            joined = ", ".join(unknown_fields)
            raise AgentAdapterError(f"Unsupported chat fields: {joined}")

        try:
            request = TurnRequest.model_validate(payload)
        except Exception as exc:
            raise AgentAdapterError(str(exc)) from exc
        return request.model_dump(exclude_none=True)

    async def start_turn(self, params: dict[str, Any]) -> dict[str, Any]:
        """Start one DeepTutor turn and return its stable identifiers.

        Start one DeepTutor turn and return its stable identifiers.

        The stream is consumed separately by ``BridgeRuntime`` so the request
        response is delivered immediately and the renderer can render progress.

        流式事件由 ``BridgeRuntime`` 单独消费, 因此请求响应可以立即返回,
        Renderer 同时能够持续渲染进度。
        """

        app = self._get_app()
        request = TurnRequest.model_validate(self._turn_payload(params))
        session, turn = await app.start_turn(request)
        session_id = str(session.get("id") or session.get("session_id") or "")
        turn_id = str(turn.get("id") or turn.get("turn_id") or "")
        if not session_id or not turn_id:
            raise AgentAdapterError("DeepTutor returned an invalid session or turn")
        return {
            "session_id": session_id,
            "turn_id": turn_id,
            "status": str(turn.get("status") or "running"),
        }

    async def stream_turn(self, turn_id: str, after_seq: int = 0) -> AsyncIterator[dict[str, Any]]:
        """Yield the SDK event dictionaries for a started turn.

        Yield the SDK event dictionaries for a started turn.

        ``after_seq`` is forwarded to DeepTutor's durable stream replay support.

        ``after_seq`` 会传给 DeepTutor 的持久化流回放机制。
        """

        async for event in self._get_app().stream_turn(turn_id, after_seq=after_seq):
            yield event

    async def cancel_turn(self, turn_id: str) -> bool:
        """Request cancellation of a running turn.

        Request cancellation of a running turn.

        请求取消正在运行的 turn。
        """

        return await self._get_app().cancel_turn(turn_id)

    async def submit_user_reply(
        self,
        turn_id: str,
        text: str | None = None,
        answers: list[dict[str, Any]] | None = None,
    ) -> bool:
        """Resume a turn paused for user input.

        Resume a turn paused for user input.

        恢复因等待用户输入而暂停的 turn。
        """

        return await self._get_app().submit_user_reply(turn_id, text=text, answers=answers)

    async def list_sessions(self, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
        """Return a page of persisted sessions.

        Return a page of persisted sessions.

        返回一页已持久化的会话。
        """

        return await self._get_app().list_sessions(limit=limit, offset=offset)

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        """Return one session with its messages, if it exists.

        Return one session with its messages, if it exists.

        返回指定会话及其消息; 会话不存在时返回 ``None``。
        """

        return await self._get_app().get_session(session_id)

    async def close(self) -> None:
        """Close DeepTutor-owned runtime resources when initialized.

        Close DeepTutor-owned runtime resources when initialized.

        仅在 SDK 已初始化时关闭 DeepTutor 管理的运行时资源。
        """

        if self._app is not None:
            await self._app.container.close()
            self._app = None


__all__ = ["AgentAdapter", "AgentAdapterError"]
