//! Bridge sidecar lifecycle and JSON-RPC forwarding.
//!
//! Bridge sidecar 生命周期与 JSON-RPC 转发。
//!
//! The Rust core owns the bridge child process: it spawns it, frames NDJSON
//! JSON-RPC requests over stdin, routes responses back to the awaiting Tauri
//! command, and forwards bridge stream events to the renderer. The renderer
//! never talks to the process directly.
//!
//! Rust 核心独占 bridge 子进程: 通过 stdin 发送 NDJSON JSON-RPC 请求,
//! 将响应路由回等待中的 Tauri command, 并把 bridge 流式事件转发给
//! Renderer。Renderer 不直接接触子进程。

use std::collections::HashMap;
use std::env;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, oneshot, Mutex};

/// Renderer event carrying one translated bridge stream event payload.
/// 携带单个 bridge 流式事件 payload 的 Renderer 事件名。
pub const BRIDGE_EVENT: &str = "bridge://event";
/// Renderer event emitted when the bridge process lifecycle state changes.
/// bridge 进程生命周期状态变化时发给 Renderer 的事件名。
pub const BRIDGE_STATUS_EVENT: &str = "bridge://status";

/// How long to wait for a graceful `runtime.shutdown` before killing.
/// 等待优雅 `runtime.shutdown` 完成的时间上限, 超时后强制杀掉子进程。
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(5);

/// Serializable bridge failure surfaced to Tauri commands / the renderer.
/// 传给 Tauri command 与 Renderer 的可序列化 bridge 错误。
#[derive(Debug, Clone, serde::Serialize)]
pub struct BridgeError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

impl BridgeError {
    fn new(code: &str, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
            retryable,
        }
    }

    /// Map a JSON-RPC error object onto the desktop error contract.
    /// 将 JSON-RPC error 对象映射为桌面错误契约。
    fn from_json(error: &Value) -> Self {
        Self {
            code: error
                .get("code")
                .and_then(Value::as_str)
                .unwrap_or("AGENT_ERROR")
                .to_string(),
            message: error
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("unknown bridge error")
                .to_string(),
            retryable: error
                .get("retryable")
                .and_then(Value::as_bool)
                .unwrap_or(false),
        }
    }

    fn not_running() -> Self {
        Self::new("BRIDGE_NOT_RUNNING", "bridge process is not running", true)
    }
}

impl std::fmt::Display for BridgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for BridgeError {}

/// Classification of one decoded stdout line from the bridge.
/// 对 bridge stdout 单行消息的分类, 决定路由去向。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MessageKind {
    /// A response echoing one of our numeric request ids.
    /// 回显我方数字请求 id 的响应。
    Response { id: u64 },
    /// A forwarded stream event (`method == "event"`).
    /// 转发的流式事件 (`method == "event"`)。
    Event,
    /// Anything else; logged and dropped.
    /// 其他消息; 记录日志后丢弃。
    Other,
}

fn classify_message(message: &Value) -> MessageKind {
    if message.get("method").and_then(Value::as_str) == Some("event") {
        return MessageKind::Event;
    }
    match message.get("id").and_then(Value::as_u64) {
        Some(id) => MessageKind::Response { id },
        None => MessageKind::Other,
    }
}

/// Extract `result` or map `error` from a JSON-RPC response object.
/// 从 JSON-RPC 响应对象中提取 `result`, 或映射 `error`。
fn response_to_result(message: &Value) -> Result<Value, BridgeError> {
    if let Some(error) = message.get("error") {
        return Err(BridgeError::from_json(error));
    }
    Ok(message.get("result").cloned().unwrap_or(Value::Null))
}

type PendingMap = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, BridgeError>>>>>;

/// One live bridge process plus its request-routing state.
/// 一个存活的 bridge 进程及其请求路由状态。
struct Running {
    child: Child,
    /// Cloned per call; dropping every clone closes stdin via the writer task.
    /// 每次 call 克隆一份; 所有克隆释放后 writer task 关闭 stdin。
    writer: mpsc::Sender<String>,
    pending: PendingMap,
    next_id: Arc<AtomicU64>,
}

/// Shared manager owning at most one bridge process.
/// 共享管理器, 最多持有一个 bridge 进程。
#[derive(Clone, Default)]
pub struct BridgeManager {
    running: Arc<Mutex<Option<Running>>>,
}

impl BridgeManager {
    /// Spawn the bridge if needed, then return its `runtime.get_info` payload.
    ///
    /// Spawn the bridge if needed, then return its `runtime.get_info` payload.
    ///
    /// 按需启动 bridge, 并返回其 `runtime.get_info` 握手信息。
    pub async fn start(&self, app: &AppHandle) -> Result<Value, BridgeError> {
        {
            let mut guard = self.running.lock().await;
            if guard.is_none() {
                let running = spawn_bridge(app, Arc::clone(&self.running))?;
                *guard = Some(running);
            }
        }
        self.call("runtime.get_info", json!({})).await
    }

    /// Whether a bridge process is currently spawned.
    /// 当前是否已有 bridge 进程。
    pub async fn is_running(&self) -> bool {
        self.running.lock().await.is_some()
    }

    /// Issue one JSON-RPC request and await its routed response.
    ///
    /// Issue one JSON-RPC request and await its routed response.
    ///
    /// 发送一个 JSON-RPC 请求并等待路由回来的响应。
    pub async fn call(&self, method: &str, params: Value) -> Result<Value, BridgeError> {
        let (writer, pending, next_id) = {
            let guard = self.running.lock().await;
            let running = guard.as_ref().ok_or_else(BridgeError::not_running)?;
            (
                running.writer.clone(),
                running.pending.clone(),
                running.next_id.clone(),
            )
        };

        let id = next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        pending.lock().await.insert(id, tx);

        let request = json!({"jsonrpc": "2.0", "id": id, "method": method, "params": params});
        let Ok(mut line) = serde_json::to_string(&request) else {
            pending.lock().await.remove(&id);
            return Err(BridgeError::new(
                "REQUEST_SERIALIZE_FAILED",
                "invalid request",
                false,
            ));
        };
        line.push('\n');

        if writer.send(line).await.is_err() {
            pending.lock().await.remove(&id);
            return Err(BridgeError::not_running());
        }

        match rx.await {
            Ok(result) => result,
            Err(_) => Err(BridgeError::new(
                "BRIDGE_DISCONNECTED",
                "bridge exited before responding",
                false,
            )),
        }
    }

    /// Request a graceful shutdown, then kill after a timeout.
    ///
    /// Request a graceful shutdown, then kill after a timeout.
    ///
    /// 先请求优雅关闭, 超时后强制终止子进程。
    pub async fn stop(&self) -> Result<(), BridgeError> {
        // Best-effort protocol shutdown; the child may already be gone.
        // 尽力发送协议关闭请求; 子进程可能已经退出。
        let _ = self.call("runtime.shutdown", json!({})).await;

        let mut guard = self.running.lock().await;
        let Some(mut running) = guard.take() else {
            return Ok(());
        };
        // Dropping our writer clone lets stdin close once in-flight calls finish.
        // 释放本地的 writer 克隆后, 进行中的请求结束时会关闭 stdin。
        drop(running.writer);
        let wait = tokio::time::timeout(SHUTDOWN_TIMEOUT, running.child.wait()).await;
        match wait {
            Ok(Ok(status)) => {
                tracing_note_shutdown(&status);
                Ok(())
            }
            Ok(Err(error)) => Err(BridgeError::new(
                "BRIDGE_WAIT_FAILED",
                error.to_string(),
                false,
            )),
            Err(_) => {
                running.child.kill().await.map_err(|error| {
                    BridgeError::new("BRIDGE_KILL_FAILED", error.to_string(), false)
                })
            }
        }
    }
}

fn tracing_note_shutdown(status: &std::process::ExitStatus) {
    eprintln!("[bridge] exited with status {status}");
}

/// Spawn the bridge process and wire reader/writer tasks.
///
/// Spawn the bridge process and wire reader/writer tasks.
///
/// 启动 bridge 进程并挂接读取/写入任务。
fn spawn_bridge(
    app: &AppHandle,
    running_state: Arc<Mutex<Option<Running>>>,
) -> Result<Running, BridgeError> {
    // AppHandle is cheaply cloneable and `'static`; the reader task needs to
    // outlive this function to keep forwarding events.
    // AppHandle 可低成本克隆且生命周期为 `'static`; reader task 需要
    // 比本函数存活更久以持续转发事件。
    let app = app.clone();
    let (program, args) = resolve_bridge_command();
    let mut command = Command::new(&program);
    command
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        // Safety net: never orphan the sidecar if the manager is dropped.
        // 兜底: 管理器被释放时不遗留孤儿进程。
        .kill_on_drop(true);

    let spawn_error = |error: std::io::Error| {
        BridgeError::new(
            "BRIDGE_SPAWN_FAILED",
            format!("failed to spawn {program:?} {args:?}: {error}"),
            false,
        )
    };

    let mut child = command.spawn().map_err(spawn_error)?;
    let stdin = child.stdin.take().ok_or_else(|| {
        BridgeError::new(
            "BRIDGE_SPAWN_FAILED",
            "bridge stdin was not captured",
            false,
        )
    })?;
    let stdout = child.stdout.take().ok_or_else(|| {
        BridgeError::new(
            "BRIDGE_SPAWN_FAILED",
            "bridge stdout was not captured",
            false,
        )
    })?;
    let stderr = child.stderr.take().ok_or_else(|| {
        BridgeError::new(
            "BRIDGE_SPAWN_FAILED",
            "bridge stderr was not captured",
            false,
        )
    })?;

    // Diagnostics only; protocol stays on stdout.
    // 仅输出诊断; 协议只走 stdout。
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            eprintln!("[bridge:stderr] {line}");
        }
    });

    let (writer_tx, writer_rx) = mpsc::channel::<String>(16);
    tokio::spawn(async move {
        let mut stdin = stdin;
        let mut writer_rx = writer_rx;
        while let Some(line) = writer_rx.recv().await {
            if stdin.write_all(line.as_bytes()).await.is_err() || stdin.flush().await.is_err() {
                break;
            }
        }
    });

    let pending: PendingMap = Arc::new(Mutex::new(HashMap::new()));
    let next_id = Arc::new(AtomicU64::new(1));

    let reader_pending = Arc::clone(&pending);
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        loop {
            let line = match reader.next_line().await {
                Ok(Some(line)) => line,
                _ => break,
            };
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            let decoded: Value = match serde_json::from_str(trimmed) {
                Ok(value) => value,
                Err(error) => {
                    eprintln!("[bridge:stdout] undecodable line ({error}): {trimmed}");
                    continue;
                }
            };
            match classify_message(&decoded) {
                MessageKind::Event => {
                    let params = decoded.get("params").cloned().unwrap_or(Value::Null);
                    if let Err(error) = app.emit(BRIDGE_EVENT, params) {
                        eprintln!("[bridge] failed to emit event: {error}");
                    }
                }
                MessageKind::Response { id } => {
                    let mut map = reader_pending.lock().await;
                    if let Some(sender) = map.remove(&id) {
                        let _ = sender.send(response_to_result(&decoded));
                    }
                }
                MessageKind::Other => {
                    eprintln!("[bridge:stdout] unexpected message: {decoded}");
                }
            }
        }

        // stdout closed: fail every pending request and notify the renderer.
        // stdout 关闭: 让所有等待中的请求失败, 并通知 Renderer。
        let mut map = reader_pending.lock().await;
        for (_, sender) in map.drain() {
            let _ = sender.send(Err(BridgeError::new(
                "BRIDGE_DISCONNECTED",
                "bridge stdout closed before responding",
                false,
            )));
        }
        drop(map);
        // Mirror the process death into the manager so `is_running` stays
        // truthful even for unexpected exits.
        // 把进程退出同步进管理器, 使意外退出后 `is_running` 仍然真实。
        running_state.lock().await.take();
        let _ = app.emit(BRIDGE_STATUS_EVENT, json!({"status": "exited"}));
    });

    Ok(Running {
        child,
        writer: writer_tx,
        pending,
        next_id,
    })
}

/// Resolve the bridge executable for development or packaged runs.
///
/// Resolution order:
/// 1. `DEEPTUTOR_BRIDGE` (+ optional `DEEPTUTOR_BRIDGE_ARGS`) override;
/// 2. the repository's `bridge/.venv` interpreter (development mode).
///
/// Packaged builds later replace this with the bundled sidecar binary (Tauri
/// `externalBin`).
///
/// Resolve the bridge executable for development or packaged runs.
///
/// 解析 bridge 可执行文件: 优先环境变量覆盖, 其次开发模式下的仓库 venv;
/// 打包模式后续接入 `externalBin` 形式的 sidecar。
fn resolve_bridge_command() -> (PathBuf, Vec<String>) {
    if let Ok(program) = env::var("DEEPTUTOR_BRIDGE") {
        if !program.trim().is_empty() {
            let args = env::var("DEEPTUTOR_BRIDGE_ARGS")
                .ok()
                .and_then(|raw| {
                    let split: Vec<String> =
                        raw.split_whitespace().map(ToString::to_string).collect();
                    (!split.is_empty()).then_some(split)
                })
                .unwrap_or_default();
            return (PathBuf::from(program), args);
        }
    }

    if let Some(python) = find_repo_venv_python() {
        return (
            python,
            vec!["-m".to_string(), "deeptutor_desktop_bridge".to_string()],
        );
    }

    // Last resort: rely on PATH, matching the installed console script name.
    // 最后手段: 依赖 PATH 中安装的同名 console script。
    (PathBuf::from("deeptutor-desktop-bridge"), Vec::new())
}

fn venv_python_relative(root: &Path) -> PathBuf {
    if cfg!(windows) {
        root.join("bridge")
            .join(".venv")
            .join("Scripts")
            .join("python.exe")
    } else {
        root.join("bridge").join(".venv").join("bin").join("python")
    }
}

/// Walk up from the executable and working directories to find the repo venv.
///
/// Walk up from the executable and working directories to find the repo venv.
///
/// 从可执行文件目录和工作目录逐级向上查找仓库 venv。
fn find_repo_venv_python() -> Option<PathBuf> {
    let starts = [
        env::current_dir().ok(),
        env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(Path::to_path_buf)),
    ];
    for start in starts.into_iter().flatten() {
        for dir in start.ancestors() {
            let candidate = venv_python_relative(dir);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_event_messages() {
        let message =
            json!({"jsonrpc": "2.0", "method": "event", "params": {"event": "chat.delta"}});
        assert_eq!(classify_message(&message), MessageKind::Event);
    }

    #[test]
    fn classifies_numeric_response_ids() {
        let message = json!({"jsonrpc": "2.0", "id": 7, "result": {}});
        assert_eq!(classify_message(&message), MessageKind::Response { id: 7 });
    }

    #[test]
    fn ignores_non_numeric_ids() {
        let message = json!({"jsonrpc": "2.0", "id": "req-001", "result": {}});
        assert_eq!(classify_message(&message), MessageKind::Other);
    }

    #[test]
    fn maps_error_objects_to_bridge_error() {
        let message = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "error": {"code": "INVALID_PARAMS", "message": "bad input", "retryable": false}
        });
        let error = response_to_result(&message).unwrap_err();
        assert_eq!(error.code, "INVALID_PARAMS");
        assert_eq!(error.message, "bad input");
        assert!(!error.retryable);
    }

    #[test]
    fn defaults_missing_error_fields() {
        let message = json!({"jsonrpc": "2.0", "id": 1, "error": {}});
        let error = response_to_result(&message).unwrap_err();
        assert_eq!(error.code, "AGENT_ERROR");
        assert!(!error.retryable);
    }

    #[test]
    fn extracts_result_payload() {
        let message = json!({"jsonrpc": "2.0", "id": 1, "result": {"status": "ok"}});
        let result = response_to_result(&message).unwrap();
        assert_eq!(result["status"], "ok");
    }
}
