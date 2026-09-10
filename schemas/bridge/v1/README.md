# Bridge protocol v1

The schemas in this directory describe the internal NDJSON protocol between the Tauri Rust core and the Desktop Bridge.

The protocol is deliberately separate from DeepTutor's Python SDK and HTTP/WebSocket API. The bridge owns the translation between this protocol and the agent runtime.
