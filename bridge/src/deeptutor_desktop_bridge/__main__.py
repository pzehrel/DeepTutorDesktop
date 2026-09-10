"""NDJSON stdin/stdout entry point for the desktop bridge.

NDJSON stdin/stdout entry point for the desktop bridge.

桌面 Bridge 的 NDJSON 标准输入/输出入口。
"""

from __future__ import annotations

import asyncio
import json
import sys
from typing import Any

from .protocol import BridgeRuntime


def _write(message: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(message, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


async def _main() -> None:
    """Read requests without blocking background event forwarding.

    Read requests without blocking background event forwarding.

    使用线程读取标准输入, 避免同步 ``readline`` 阻塞后台事件转发任务。
    """

    runtime = BridgeRuntime()
    write_lock = asyncio.Lock()

    async def write(message: dict[str, Any]) -> None:
        async with write_lock:
            _write(message)

    try:
        while True:
            raw_line = await asyncio.to_thread(sys.stdin.readline)
            if not raw_line:
                break
            line = raw_line.strip()
            if not line:
                continue

            try:
                request = json.loads(line)
            except json.JSONDecodeError as exc:
                await write(
                    {
                        "jsonrpc": "2.0",
                        "id": None,
                        "error": {
                            "code": "PARSE_ERROR",
                            "message": str(exc),
                            "retryable": False,
                        },
                    }
                )
                continue

            response, should_exit = await runtime.handle_request(request, emit=write)
            await write(response)
            if should_exit:
                break
    finally:
        await runtime.close()


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
