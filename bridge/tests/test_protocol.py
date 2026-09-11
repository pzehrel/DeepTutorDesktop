import asyncio
from collections.abc import AsyncIterator
from typing import Any

from deeptutor_desktop_bridge.agent_adapter import AgentAdapter
from deeptutor_desktop_bridge.protocol import BridgeRuntime, handle_request


class FakeAdapter(AgentAdapter):
    def __init__(self) -> None:
        self.started_params: dict[str, Any] | None = None
        self.cancelled_turns: list[str] = []
        self.replied_turns: list[str] = []

    @property
    def available(self) -> bool:
        return True

    @property
    def connected(self) -> bool:
        return True

    @property
    def agent_version(self) -> str:
        return "1.6.6"

    async def start_turn(self, params: dict[str, Any]) -> dict[str, Any]:
        self.started_params = params
        return {"session_id": "session-1", "turn_id": "turn-1", "status": "running"}

    async def stream_turn(self, turn_id: str, after_seq: int = 0) -> AsyncIterator[dict[str, Any]]:
        assert turn_id == "turn-1"
        assert after_seq == 0
        yield {
            "type": "content",
            "session_id": "session-1",
            "turn_id": turn_id,
            "content": "Hello",
            "metadata": {},
            "seq": 1,
        }
        yield {
            "type": "done",
            "session_id": "session-1",
            "turn_id": turn_id,
            "metadata": {"status": "completed"},
            "seq": 2,
        }

    async def cancel_turn(self, turn_id: str) -> bool:
        self.cancelled_turns.append(turn_id)
        return True

    async def submit_user_reply(
        self,
        turn_id: str,
        text: str | None = None,
        answers: list[dict[str, Any]] | None = None,
    ) -> bool:
        self.replied_turns.append(turn_id)
        assert text == "answer"
        assert answers == [{"id": "a"}]
        return True

    async def list_sessions(self, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
        return [{"id": "session-1", "limit": limit, "offset": offset}]

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        return {"id": session_id}

    async def close(self) -> None:
        return None


def test_runtime_info_handshake() -> None:
    response, should_exit = handle_request(
        {"jsonrpc": "2.0", "id": "one", "method": "runtime.get_info"}
    )

    assert should_exit is False
    assert response["id"] == "one"
    assert response["result"]["protocol_version"] == 1
    assert response["result"]["agent_connected"] is False


def test_shutdown_requests_exit() -> None:
    response, should_exit = handle_request(
        {"jsonrpc": "2.0", "id": "two", "method": "runtime.shutdown"}
    )

    assert should_exit is True
    assert response["result"]["status"] == "shutting_down"


def test_unknown_method_is_reported() -> None:
    response, should_exit = handle_request({"jsonrpc": "2.0", "id": "three", "method": "unknown"})

    assert should_exit is False
    assert response["error"]["code"] == "METHOD_NOT_FOUND"


def test_chat_send_acknowledges_and_forwards_stream() -> None:
    async def scenario() -> None:
        adapter = FakeAdapter()
        runtime = BridgeRuntime(adapter)
        events: list[dict[str, Any]] = []

        async def emit(event: dict[str, Any]) -> None:
            events.append(event)

        response, should_exit = await runtime.handle_request(
            {
                "jsonrpc": "2.0",
                "id": "chat-1",
                "method": "chat.send",
                "params": {"message": "Hi", "capability": "chat"},
            },
            emit=emit,
        )
        assert should_exit is False
        assert response["result"]["turn_id"] == "turn-1"
        assert adapter.started_params == {"message": "Hi", "capability": "chat"}

        # Waiting on the pending stream tasks is the only way to observe events
        # forwarded by a lazily-starting async generator: `close()` cancels them
        # before the first yield, so it cannot be used to drain them here. The
        # private task map is therefore the contract under test, not an
        # incidental reach-through.
        #
        # 等待挂起的流任务, 是观察惰性启动的 async generator 所转发事件的唯一方式:
        # `close()` 会在首次 yield 之前取消任务, 因此无法用它排空事件。此处的私有
        # 任务表正是被测契约本身, 而非顺手访问内部实现。
        pending = runtime._stream_tasks.values()  # pyright: ignore[reportPrivateUsage]
        await asyncio.gather(*pending)
        assert events[0]["params"]["event"] == "chat.delta"
        assert events[0]["params"]["text"] == "Hello"
        assert events[1]["params"]["event"] == "chat.done"
        assert events[1]["params"]["status"] == "completed"
        await runtime.close()

    asyncio.run(scenario())


def test_cancel_resume_and_session_methods() -> None:
    async def scenario() -> None:
        adapter = FakeAdapter()
        runtime = BridgeRuntime(adapter)

        cancel, _ = await runtime.handle_request(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "request.cancel",
                "params": {"turn_id": "turn-1"},
            }
        )
        assert cancel["result"] == {"turn_id": "turn-1", "cancelled": True}

        resume, _ = await runtime.handle_request(
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "chat.resume",
                "params": {
                    "turn_id": "turn-1",
                    "text": "answer",
                    "answers": [{"id": "a"}],
                },
            }
        )
        assert resume["result"]["resumed"] is True

        sessions, _ = await runtime.handle_request(
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "session.list",
                "params": {"limit": 10},
            }
        )
        assert sessions["result"]["sessions"][0]["limit"] == 10

        session, _ = await runtime.handle_request(
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "session.get",
                "params": {"session_id": "session-1"},
            }
        )
        assert session["result"]["session"]["id"] == "session-1"
        assert adapter.cancelled_turns == ["turn-1"]
        assert adapter.replied_turns == ["turn-1"]
        await runtime.close()

    asyncio.run(scenario())


def test_chat_payload_rejects_unknown_fields() -> None:
    """Unsupported chat fields never reach the SDK.

    Unsupported chat fields never reach the SDK.

    Calls the adapter's field-level validator directly. ``FakeAdapter`` replaces
    ``start_turn`` wholesale and therefore bypasses validation, so routing this
    assertion through ``handle_request`` would exercise the fake instead of the
    real guarantee. The validator is private only because no production caller
    outside the adapter needs it.

    ``FakeAdapter`` 整体替换了 ``start_turn``, 因此绕过了校验; 若把本断言改走
    ``handle_request``, 实际被测的是测试替身而非真实保证。该函数之所以是私有的,
    仅因为适配层之外没有生产调用方需要它。
    """

    try:
        AgentAdapter._turn_payload(  # pyright: ignore[reportPrivateUsage]
            {"message": "Hi", "internal_module": "secret"}
        )
    except Exception as exc:
        assert "Unsupported chat fields" in str(exc)
    else:
        raise AssertionError("unknown fields must be rejected")
