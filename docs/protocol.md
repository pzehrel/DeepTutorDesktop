# Desktop Bridge protocol draft

> This is the internal protocol between Tauri and the Desktop Bridge, not a DeepTutor-native protocol. DeepTutor is currently reached by the bridge through the Python SDK; the bridge's job is to translate SDK turns/sessions/stream events into the JSON-RPC messages below.

## 1. Transport

- Transport: stdin/stdout
- Encoding: UTF-8
- Format: NDJSON, one JSON object per line
- stdout: protocol messages only
- stderr: logs, diagnostics, and debugging output

## 2. Request

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "chat.send",
  "params": {
    "session_id": "session-001",
    "message": "Explain Fourier transform"
  }
}
```

## 3. Success response

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "session_id": "session-001",
    "text": "..."
  }
}
```

## 4. Streaming event

```json
{
  "jsonrpc": "2.0",
  "method": "event",
  "params": {
    "event": "chat.delta",
    "request_id": "req-001",
    "session_id": "session-001",
    "text": "..."
  }
}
```

## 5. Error

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "error": {
    "code": "AGENT_ERROR",
    "message": "Human-readable message",
    "retryable": false
  }
}
```

## 6. Lifecycle methods

The following method names are reserved:

```text
runtime.get_info
runtime.health
runtime.shutdown
request.cancel
chat.send
chat.resume
session.list
session.get
workspace.get   # reserved, not implemented
workspace.set   # reserved, not implemented
```

Method names, parameters, and return values must be defined as schemas before implementation; DeepTutor's internal Python function signatures are never exposed to the renderer as-is.

## 7. Protocol version

After startup the bridge first returns runtime information:

```json
{
  "protocol_version": 1,
  "agent_name": "deeptutor",
  "agent_version": "<pinned version>",
  "runtime_target": "darwin-arm64"
}
```
