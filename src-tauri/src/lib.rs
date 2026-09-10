//! Tauri shell commands exposing the bridge sidecar to the renderer.
//!
//! Tauri shell commands, 将 bridge sidecar 受控地暴露给 Renderer。
//!
//! Every renderer bridge interaction goes through these allowlisted commands;
//! the renderer holds no process or shell capability itself.
//!
//! Renderer 与 bridge 的所有交互都经过这些白名单 command;
//! Renderer 本身不持有任何进程或 shell 权限。

mod bridge;
mod stack;

use bridge::{BridgeError, BridgeManager};
use serde_json::{json, Value};
use stack::{StackManager, StackState};
use tauri::{AppHandle, Manager, State};

#[tauri::command]
async fn stack_start(
    app: AppHandle,
    manager: State<'_, StackManager>,
) -> Result<StackState, String> {
    manager.start(&app).await;
    Ok(manager.state().await)
}

#[tauri::command]
async fn stack_stop(
    app: AppHandle,
    manager: State<'_, StackManager>,
) -> Result<StackState, String> {
    manager.stop(&app).await;
    Ok(manager.state().await)
}

#[tauri::command]
async fn stack_status(manager: State<'_, StackManager>) -> Result<StackState, String> {
    Ok(manager.state().await)
}

/// DeepTutor's persisted interface theme, mirrored by the boot loader.
/// DeepTutor 持久化的界面主题, 启动加载页与其保持一致。
#[tauri::command]
fn stack_theme(app: AppHandle) -> String {
    stack::persisted_theme(&app)
}

#[tauri::command]
async fn bridge_start(
    app: AppHandle,
    manager: State<'_, BridgeManager>,
) -> Result<Value, BridgeError> {
    manager.start(&app).await
}

#[tauri::command]
async fn bridge_stop(manager: State<'_, BridgeManager>) -> Result<(), BridgeError> {
    manager.stop().await
}

#[tauri::command]
async fn bridge_status(manager: State<'_, BridgeManager>) -> Result<Value, BridgeError> {
    Ok(json!({"running": manager.is_running().await}))
}

#[tauri::command]
async fn bridge_info(manager: State<'_, BridgeManager>) -> Result<Value, BridgeError> {
    manager.call("runtime.get_info", json!({})).await
}

#[tauri::command]
async fn bridge_health(manager: State<'_, BridgeManager>) -> Result<Value, BridgeError> {
    manager.call("runtime.health", json!({})).await
}

#[tauri::command]
async fn chat_send(
    manager: State<'_, BridgeManager>,
    message: String,
    session_id: Option<String>,
    capability: Option<String>,
) -> Result<Value, BridgeError> {
    let mut params = json!({"message": message});
    if let Some(session_id) = session_id {
        params["session_id"] = json!(session_id);
    }
    if let Some(capability) = capability {
        params["capability"] = json!(capability);
    }
    manager.call("chat.send", params).await
}

#[tauri::command]
async fn request_cancel(
    manager: State<'_, BridgeManager>,
    turn_id: String,
) -> Result<Value, BridgeError> {
    manager
        .call("request.cancel", json!({"turn_id": turn_id}))
        .await
}

#[tauri::command]
async fn chat_resume(
    manager: State<'_, BridgeManager>,
    turn_id: String,
    text: Option<String>,
    answers: Option<Vec<Value>>,
) -> Result<Value, BridgeError> {
    let mut params = json!({"turn_id": turn_id});
    if let Some(text) = text {
        params["text"] = json!(text);
    }
    if let Some(answers) = answers {
        params["answers"] = json!(answers);
    }
    manager.call("chat.resume", params).await
}

#[tauri::command]
async fn session_list(
    manager: State<'_, BridgeManager>,
    limit: Option<u64>,
    offset: Option<u64>,
) -> Result<Value, BridgeError> {
    let mut params = json!({});
    if let Some(limit) = limit {
        params["limit"] = json!(limit);
    }
    if let Some(offset) = offset {
        params["offset"] = json!(offset);
    }
    manager.call("session.list", params).await
}

#[tauri::command]
async fn session_get(
    manager: State<'_, BridgeManager>,
    session_id: String,
) -> Result<Value, BridgeError> {
    manager
        .call("session.get", json!({"session_id": session_id}))
        .await
}

/// Stop the embedded stack when the process is terminated by a signal.
///
/// SIGTERM/SIGINT bypass Tauri's `RunEvent::Exit`, which would otherwise
/// orphan the detached `deeptutor start` launcher and its children.
///
/// SIGTERM/SIGINT 不会触发 Tauri 的 `RunEvent::Exit`; 不在此处处理的话,
/// detached 的 `deeptutor start` launcher 及其子进程会成为孤儿。
#[cfg(unix)]
fn install_signal_shutdown(handle: AppHandle, stack: StackManager) {
    use tokio::signal::unix::{signal, SignalKind};

    tauri::async_runtime::spawn(async move {
        let Ok(mut term) = signal(SignalKind::terminate()) else {
            return;
        };
        let Ok(mut interrupt) = signal(SignalKind::interrupt()) else {
            return;
        };
        tokio::select! {
            _ = term.recv() => {}
            _ = interrupt.recv() => {}
        }
        eprintln!("[deeptutor] shutdown signal received; stopping embedded stack");
        stack.stop(&handle).await;
        handle.exit(0);
    });
}

#[cfg(not(unix))]
fn install_signal_shutdown(_handle: AppHandle, _stack: StackManager) {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(BridgeManager::default())
        .manage(StackManager::default())
        .invoke_handler(tauri::generate_handler![
            stack_start,
            stack_stop,
            stack_status,
            stack_theme,
            bridge_start,
            bridge_stop,
            bridge_status,
            bridge_info,
            bridge_health,
            chat_send,
            request_cancel,
            chat_resume,
            session_list,
            session_get,
        ])
        .setup(|app| {
            // Boot the embedded DeepTutor stack as soon as the window exists;
            // the renderer shows a loading state until `deeptutor://state`
            // reports the ready URL, then navigates to the full web UI.
            //
            // 窗口创建后立即启动内嵌 DeepTutor 栈; Renderer 先显示加载态,
            // 收到 `deeptutor://state` 的就绪 URL 后跳转到完整 Web UI。
            let stack = app.state::<StackManager>().inner().clone();
            tauri::async_runtime::spawn({
                let handle = app.app_handle().clone();
                let stack = stack.clone();
                async move {
                    stack.start(&handle).await;
                }
            });
            install_signal_shutdown(app.app_handle().clone(), stack);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building DeepTutor Desktop")
        .run(|app, event| {
            // Stop the sidecar and the embedded stack when the app exits so no
            // orphan process remains.
            // 应用退出时停止 sidecar 与内嵌栈, 避免遗留孤儿进程。
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(manager) = app.try_state::<BridgeManager>() {
                    if let Err(error) = tauri::async_runtime::block_on(manager.stop()) {
                        eprintln!("[bridge] shutdown on exit failed: {error}");
                    }
                }
                if let Some(stack) = app.try_state::<StackManager>() {
                    let handle = app.app_handle().clone();
                    tauri::async_runtime::block_on(stack.stop(&handle));
                }
            }
        });
}
