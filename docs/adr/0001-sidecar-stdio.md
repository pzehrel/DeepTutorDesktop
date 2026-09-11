# ADR-0001: Sidecar with stdio JSON-RPC

- Status: Accepted (the "no TCP listeners" constraint has been amended for the embedded web stack by [ADR-0003](0003-embedded-web-stack.md); the bridge portions remain fully in force)
- Date: 2026-09-09
- Scope: the stdio bridge and protocol-level access

## Context

The desktop application ships the DeepTutor agent alongside Tauri but does not want to:

- copy agent source into the Tauri project;
- require users to install Python or run pip themselves;
- open local HTTP/WebSocket ports;
- let other programs on the machine call the agent directly.

`127.0.0.1` only limits network scope; it cannot restrict other processes on the same host. A localhost API therefore fails this project's process-isolation goal.

DeepTutor already offers a Python SDK, CLI JSON/NDJSON output, and an HTTP/WebSocket API, but no JSON-RPC server facing stdin/stdout. A separate Desktop Bridge is needed for protocol adaptation instead of forcing JSON-RPC support into the agent core.

## Decision

Adopt an independent Desktop Bridge sidecar:

1. at build time, place the pinned DeepTutor package into an embedded Python runtime;
2. the Tauri Rust Core starts the bridge sidecar;
3. Tauri and the bridge speak NDJSON JSON-RPC over stdin/stdout;
4. the renderer reaches the bridge only through Tauri commands/events;
5. the agent listens on no TCP port.

## Consequences

### Advantages

- the agent and the desktop layer stay decoupled through a package and a protocol;
- there is no TCP API that browsers or other local programs can scan;
- users need no Python, Node.js, or DeepTutor installed;
- the bridge is versioned independently of Tauri and can be reused by other desktop shells;
- agent, bridge, and desktop shell can each be versioned separately.

### Costs

- the frontend cannot reuse an HTTP/WebSocket-only transport directly and needs a Tauri IPC transport;
- separate runtimes must be built per target such as macOS arm64/x64;
- Python dependency packaging, code signing, and native extensions add CI complexity;
- streaming events, cancellation, timeouts, and child-process crashes must be defined in the bridge protocol.

## Alternatives considered

### localhost HTTP/WebSocket

Simple to implement, but any process on the same machine can reach the port, which violates the "desktop app only" requirement.

### Unix domain socket

Reduces network exposure, but other processes under the same user can still access the socket, and cross-platform support is more complex — not chosen for the first release.

### Rewriting the Python code as Tauri/Rust modules

Would couple languages and source, destroying the agent's independent release ability. Rejected.
