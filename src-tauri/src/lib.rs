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

use bridge::{BridgeError, BridgeManager};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, State};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(BridgeManager::default())
        .invoke_handler(tauri::generate_handler![
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
        .build(tauri::generate_context!())
        .expect("error while building DeepTutor Desktop")
        .run(|app, event| {
            // Stop the sidecar when the app exits so no orphan process remains.
            // 应用退出时停止 sidecar, 避免遗留孤儿进程。
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(manager) = app.try_state::<BridgeManager>() {
                    if let Err(error) = tauri::async_runtime::block_on(manager.stop()) {
                        eprintln!("[bridge] shutdown on exit failed: {error}");
                    }
                }
            }
        });
}
