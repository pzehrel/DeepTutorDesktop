# Desktop Bridge 协议草案

> 本协议是 Tauri 与 Desktop Bridge 之间的内部协议，不是 DeepTutor 官方原生协议。DeepTutor 当前由 Bridge 通过 Python SDK 调用；Bridge 负责将 SDK 的 turn/session/stream 事件转换为下列 JSON-RPC 消息。

## 1. 传输

- Transport：stdin/stdout
- 编码：UTF-8
- 格式：NDJSON，一行一个 JSON 对象
- stdout：只允许协议消息
- stderr：日志、诊断和调试信息

## 2. 请求

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

## 3. 成功响应

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

## 4. 流式事件

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

## 5. 错误

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

## 6. 生命周期方法

预留以下方法名：

```text
runtime.get_info
runtime.health
runtime.shutdown
request.cancel
chat.send
chat.resume
session.list
session.get
workspace.get   # 预留，未实现
workspace.set   # 预留，未实现
```

方法名、参数和返回值必须在实现前形成 schema，不允许把 DeepTutor 内部 Python 函数签名直接暴露给 Renderer。

## 7. 协议版本

Bridge 启动后应先返回 runtime 信息：

```json
{
  "protocol_version": 1,
  "agent_name": "deeptutor",
  "agent_version": "<pinned version>",
  "runtime_target": "darwin-arm64"
}
```
