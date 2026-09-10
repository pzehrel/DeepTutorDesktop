//! Embedded DeepTutor full-stack runtime manager.
//!
//! 内嵌 DeepTutor 全栈运行时管理。
//!
//! The desktop shell ships the pinned `deeptutor` wheel inside an embedded
//! Python runtime plus a Node.js runtime (see `docs/packaging.md`). This module
//! launches `deeptutor start` against a per-application home directory, waits
//! for the packaged Next.js frontend to answer on the loopback interface, and
//! tells the renderer to navigate to it. The renderer never spawns processes
//! or touches the runtime itself.
//!
//! 桌面壳按 `docs/packaging.md` 将锁定版本的 `deeptutor` wheel 与 Python、
//! Node.js 运行时一同分发。本模块在应用数据目录下启动 `deeptutor start`,
//! 等待内置 Next.js 前端在回环地址就绪后, 通知 Renderer 跳转过去。
//! Renderer 不创建进程, 也不直接接触运行时。
//!
//! Note: unlike the stdio bridge (`bridge.rs`), the full web UI requires the
//! backend/frontend pair that only speak HTTP. Both bind to the loopback
//! interface on ports recorded in the home directory's `system.json`; this is
//! the documented exception recorded in ADR-0003.
//!
//! 说明: 与 stdio bridge (`bridge.rs`) 不同, 完整 Web UI 依赖只能讲 HTTP 的
//! 前后端。两者都绑定在回环地址, 端口记录在 home 目录的 `system.json`;
//! 这是 ADR-0003 记录的已批准例外。

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};
use tokio::process::Command;
use tokio::sync::Mutex;

/// Renderer event carrying the ready frontend URL (and state changes).
/// 携带就绪前端 URL 与状态变化的 Renderer 事件名。
pub const STACK_EVENT: &str = "deeptutor://state";

/// How long to wait for the frontend to answer before reporting failure.
/// 等待前端就绪的超时时间, 超时后报告失败。
const READY_TIMEOUT: Duration = Duration::from_secs(180);
const PROBE_INTERVAL: Duration = Duration::from_millis(750);

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum StackState {
    Stopped,
    Starting,
    Ready { url: String },
    Failed { message: String },
}

struct StackInner {
    state: StackState,
}

impl Default for StackInner {
    fn default() -> Self {
        Self {
            state: StackState::Stopped,
        }
    }
}

/// Shared manager for the embedded DeepTutor stack lifecycle.
/// 内嵌 DeepTutor 栈生命周期的共享管理器。
#[derive(Clone, Default)]
pub struct StackManager {
    inner: Arc<Mutex<StackInner>>,
}

impl StackManager {
    pub async fn state(&self) -> StackState {
        self.inner.lock().await.state.clone()
    }

    /// Launch the embedded stack and notify the renderer on every transition.
    ///
    /// Launch the embedded stack and notify the renderer on every transition.
    ///
    /// 启动内嵌栈, 并在每次状态变化时通知 Renderer。
    pub async fn start(&self, app: &AppHandle) {
        {
            let mut inner = self.inner.lock().await;
            if matches!(inner.state, StackState::Starting | StackState::Ready { .. }) {
                return;
            }
            inner.state = StackState::Starting;
        }
        emit_state(app, &StackState::Starting);

        match start_stack(app).await {
            Ok(url) => {
                let state = StackState::Ready { url };
                {
                    let mut inner = self.inner.lock().await;
                    inner.state = state.clone();
                }
                emit_state(app, &state);
            }
            Err(message) => {
                let state = StackState::Failed {
                    message: message.clone(),
                };
                {
                    let mut inner = self.inner.lock().await;
                    inner.state = state.clone();
                }
                emit_state(app, &state);
            }
        }
    }

    /// Ask the launcher for a graceful stop of every backend/frontend process.
    ///
    /// Ask the launcher for a graceful stop of every backend/frontend process.
    ///
    /// 通过 launcher 优雅停止所有后端/前端进程。
    pub async fn stop(&self, app: &AppHandle) {
        if let Some(home) = app
            .path()
            .app_data_dir()
            .ok()
            .map(|dir| dir.join("deeptutor"))
        {
            if let Some((python, runtime_dir)) = resolve_runtime(app) {
                let _ = run_cli(
                    &python,
                    &["stop", "--home", &home.to_string_lossy()],
                    &runtime_dir,
                    &home,
                )
                .await;
            }
        }
        let mut inner = self.inner.lock().await;
        inner.state = StackState::Stopped;
        drop(inner);
        emit_state(app, &StackState::Stopped);
    }
}

fn emit_state(app: &AppHandle, state: &StackState) {
    if let Err(error) = app.emit(STACK_EVENT, state) {
        eprintln!("[deeptutor] failed to emit state: {error}");
    }
}

/// The default loader theme when DeepTutor has not persisted one yet.
/// DeepTutor 尚未持久化主题设置时, 加载页使用的默认主题。
const DEFAULT_THEME: &str = "snow";

/// Read DeepTutor's persisted interface theme (`snow|light|dark|glass`).
///
/// DeepTutor writes its theme switch to
/// `<home>/data/user/settings/interface.json`; the boot loader reads the same
/// value so both surfaces always agree, including after in-app switches.
///
/// 读取 DeepTutor 持久化的界面主题 (`snow|light|dark|glass`)。DeepTutor
/// 切换主题时会写入 `<home>/data/user/settings/interface.json`; 启动加载页
/// 读取同一份数据, 保证两个界面始终一致, 应用内切换后也会跟随。
pub fn persisted_theme(app: &AppHandle) -> String {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join("deeptutor"))
        .map(|home| theme_from_home(&home))
        .unwrap_or_else(|| DEFAULT_THEME.to_string())
}

/// Pure home-dir variant of [`persisted_theme`], unit-testable without an app.
/// [`persisted_theme`] 的纯函数版本, 无需 AppHandle 即可单测。
fn theme_from_home(home: &Path) -> String {
    let settings = home
        .join("data")
        .join("user")
        .join("settings")
        .join("interface.json");
    let Ok(raw) = std::fs::read_to_string(settings) else {
        return DEFAULT_THEME.to_string();
    };
    let Ok(value) = serde_json::from_str::<Value>(&raw) else {
        return DEFAULT_THEME.to_string();
    };
    match value.get("theme").and_then(Value::as_str) {
        Some(theme) if ["snow", "light", "dark", "glass"].contains(&theme) => theme.to_string(),
        _ => DEFAULT_THEME.to_string(),
    }
}

/// Seed the interface language on first launch from the OS locale.
///
/// DeepTutor persists its UI language in `data/user/settings/interface.json`
/// and otherwise defaults to English. To honor the user's system language on
/// first launch, write the detected language (`zh` for any Chinese locale,
/// `en` for everything else) before the stack boots — only when the file does
/// not exist yet, so in-app language choices are never overwritten.
///
/// 首次启动时按系统语言预置界面语言。DeepTutor 的界面语言持久化在
/// `data/user/settings/interface.json`, 缺省为英文。为保证首次启动跟随
/// 系统语言, 在栈启动前写入检测到的语言 (任意中文 locale 为 `zh`,
/// 其余一律 `en`) —— 仅在文件不存在时写入, 不会覆盖应用内的语言选择。
fn seed_interface_language(home: &Path) {
    let settings = home
        .join("data")
        .join("user")
        .join("settings")
        .join("interface.json");
    if settings.exists() {
        return;
    }
    let language = match sys_locale::get_locale() {
        Some(locale) if locale.to_lowercase().starts_with("zh") => "zh",
        _ => "en",
    };
    if let Some(parent) = settings.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(&settings, format!("{{\"language\": \"{language}\"}}"));
}

/// Locate the bundled runtime directory and its Python interpreter.
///
/// Resolution order:
/// 1. `DEEPTUTOR_RUNTIME_DIR` override (expects `python/` and `node/` inside);
/// 2. the bundled Tauri resources (`Resources/runtime` in a packaged app);
/// 3. the repository checkout's `runtime/darwin-arm64` (development mode).
///
/// 解析内嵌 runtime 目录: 环境变量覆盖 > Tauri resources > 仓库 runtime 目录。
pub fn resolve_runtime(app: &AppHandle) -> Option<(PathBuf, PathBuf)> {
    if let Ok(dir) = std::env::var("DEEPTUTOR_RUNTIME_DIR") {
        if !dir.trim().is_empty() {
            let dir = PathBuf::from(dir);
            if let Some(python) = python_in(&dir) {
                return Some((python, dir));
            }
        }
    }

    if let Ok(resources) = app.path().resource_dir() {
        // Bundled layout: Resources/runtime/{python,node}.
        // 打包布局: Resources/runtime/{python,node}。
        let dir = resources.join("runtime");
        if let Some(python) = python_in(&dir) {
            return Some((python, dir));
        }
    }

    // Development fallback: walk up from the executable to the repo checkout.
    // 开发回退: 从可执行文件目录向上查找仓库中的 runtime 目录。
    if let Ok(exe) = std::env::current_exe() {
        for ancestor in exe.ancestors().skip(1) {
            for target in ["runtime/darwin-arm64", "runtime"] {
                let dir = ancestor.join(target);
                if let Some(python) = python_in(&dir) {
                    return Some((python, dir));
                }
            }
        }
    }
    None
}

fn python_in(runtime_dir: &Path) -> Option<PathBuf> {
    // python-build-standalone keeps the interpreter under `bin/` on every
    // platform (including Windows); `Scripts/` only appears in venv layouts.
    //
    // python-build-standalone 在所有平台(含 Windows)都把解释器放在
    // `bin/` 下; `Scripts/` 只出现在 venv 布局中。
    let candidates: &[&str] = if cfg!(windows) {
        &["python/bin/python.exe", "python/Scripts/python.exe"]
    } else {
        &["python/bin/python3", "python/bin/python3.13"]
    };
    candidates
        .iter()
        .map(|relative| runtime_dir.join(relative))
        .find(|path| path.is_file())
}

/// `DEEPTUTOR_HOME` must be set as an environment variable, not only passed
/// as `--home`: the CLI configures logging at import time, before argument
/// parsing, and would otherwise derive the workspace from the (possibly
/// read-only) working directory of a Finder-launched app.
///
/// `DEEPTUTOR_HOME` 必须以环境变量形式提供, 不能只传 `--home` 参数:
/// CLI 在导入期、参数解析之前就会初始化日志, 否则会从 Finder 启动的
/// 只读工作目录推导 workspace 路径。
async fn run_cli(
    python: &Path,
    args: &[&str],
    runtime_dir: &Path,
    home: &Path,
) -> Result<(), String> {
    let mut command = Command::new(python);
    command
        .args(["-m", "deeptutor"])
        .args(args)
        .env("DEEPTUTOR_HOME", home)
        .env("PATH", prepend_node_bin(runtime_dir))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let child = command
        .spawn()
        .map_err(|error| format!("failed to run deeptutor CLI: {error}"))?;
    let output = child
        .wait_with_output()
        .await
        .map_err(|error| format!("deeptutor CLI failed: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "deeptutor CLI exited with {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

/// The Node runtime must precede PATH so the launcher finds `node`.
///
/// The Node runtime must precede PATH so the launcher finds `node`.
///
/// Node 运行时需要放在 PATH 前, launcher 才能找到 `node`。
fn prepend_node_bin(runtime_dir: &Path) -> String {
    let node_bin = if cfg!(windows) {
        runtime_dir.join("node")
    } else {
        runtime_dir.join("node").join("bin")
    };
    let current = std::env::var("PATH").unwrap_or_default();
    format!("{}:{}", node_bin.to_string_lossy(), current)
}

/// Resolve the frontend port recorded by the launcher in the home settings.
///
/// Resolve the frontend port recorded by the launcher in the home settings.
///
/// 从 home 目录的 system.json 读取 launcher 记录的前端端口。
fn frontend_port(home: &Path) -> Option<u16> {
    let settings = home
        .join("data")
        .join("user")
        .join("settings")
        .join("system.json");
    let raw = std::fs::read_to_string(settings).ok()?;
    let value: Value = serde_json::from_str(&raw).ok()?;
    value
        .get("frontend_port")
        .and_then(Value::as_u64)
        .and_then(|port| u16::try_from(port).ok())
}

/// Start the stack: spawn `deeptutor start --detach`, then probe the frontend.
///
/// Start the stack: spawn `deeptutor start --detach`, then probe the frontend.
///
/// 启动栈: 拉起 `deeptutor start --detach`, 再轮询前端直至就绪。
async fn start_stack(app: &AppHandle) -> Result<String, String> {
    let (python, runtime_dir) = resolve_runtime(app).ok_or_else(|| {
        "DeepTutor runtime not found (bundle resources or DEEPTUTOR_RUNTIME_DIR)".to_string()
    })?;

    let home = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("cannot resolve app data dir: {error}"))?
        .join("deeptutor");
    std::fs::create_dir_all(&home).map_err(|error| format!("cannot create home dir: {error}"))?;
    seed_interface_language(&home);

    run_cli(
        &python,
        &[
            "start",
            "--detach",
            "--no-browser",
            "--home",
            &home.to_string_lossy(),
        ],
        &runtime_dir,
        &home,
    )
    .await?;

    // The launcher writes the resolved ports into system.json once it boots.
    // launcher 启动后会把解析出的端口写入 system.json。
    let port = wait_for_port(&home).await?;
    let url = format!("http://127.0.0.1:{port}");
    wait_for_http(&url).await?;
    Ok(url)
}

async fn wait_for_port(home: &Path) -> Result<u16, String> {
    let deadline = tokio::time::Instant::now() + READY_TIMEOUT;
    loop {
        if let Some(port) = frontend_port(home) {
            return Ok(port);
        }
        if tokio::time::Instant::now() >= deadline {
            return Err("frontend port was not recorded in system.json".to_string());
        }
        tokio::time::sleep(PROBE_INTERVAL).await;
    }
}

async fn wait_for_http(url: &str) -> Result<(), String> {
    let deadline = tokio::time::Instant::now() + READY_TIMEOUT;
    loop {
        if let Ok(response) = http_lite::get(url.to_string()).await {
            if response.is_success_or_redirect() {
                return Ok(());
            }
        }
        if tokio::time::Instant::now() >= deadline {
            return Err(format!("frontend at {url} did not become ready in time"));
        }
        tokio::time::sleep(PROBE_INTERVAL).await;
    }
}

/// Minimal loopback HTTP prober. One GET against 127.0.0.1 does not justify a
/// full HTTP client dependency, so this wraps blocking `TcpStream` I/O in a
/// `spawn_blocking` task. Only used by `wait_for_http`.
///
/// 仅用于回环探测的最小 HTTP 客户端: 一个对 127.0.0.1 的 GET 不值得引入
/// 完整的 HTTP 客户端依赖, 这里用阻塞 `TcpStream` 包一层 `spawn_blocking`,
/// 只供 `wait_for_http` 使用。
mod http_lite {
    pub struct Response {
        status: u16,
    }

    impl Response {
        pub fn is_success_or_redirect(&self) -> bool {
            (200..400).contains(&self.status)
        }
    }

    pub async fn get(url: String) -> Result<Response, String> {
        tokio::task::spawn_blocking(move || get_blocking(&url))
            .await
            .map_err(|e| e.to_string())?
    }

    fn get_blocking(url: &str) -> Result<Response, String> {
        let stripped = url
            .strip_prefix("http://")
            .ok_or_else(|| "only http:// URLs are supported".to_string())?;
        let (host_port, _) = stripped.split_once('/').unwrap_or((stripped, ""));
        let (host, port) = match host_port.rsplit_once(':') {
            Some((host, port)) => (host, port.parse::<u16>().map_err(|e| e.to_string())?),
            None => (host_port, 80),
        };
        let mut stream = std::net::TcpStream::connect((host, port)).map_err(|e| e.to_string())?;
        stream
            .set_read_timeout(Some(std::time::Duration::from_secs(2)))
            .map_err(|e| e.to_string())?;
        use std::io::{Read, Write};
        stream
            .write_all(format!("GET / HTTP/1.0\r\nHost: {host}\r\n\r\n").as_bytes())
            .map_err(|e| e.to_string())?;
        let mut buf = [0_u8; 512];
        let n = stream.read(&mut buf).map_err(|e| e.to_string())?;
        let head = String::from_utf8_lossy(&buf[..n]);
        let status = head
            .split_whitespace()
            .nth(1)
            .and_then(|code| code.parse::<u16>().ok())
            .ok_or_else(|| "malformed HTTP response".to_string())?;
        Ok(Response { status })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_frontend_port_from_system_json() {
        let dir = std::env::temp_dir().join("dt-stack-test-home");
        let settings = dir.join("data").join("user").join("settings");
        std::fs::create_dir_all(&settings).unwrap();
        std::fs::write(
            settings.join("system.json"),
            r#"{"backend_port": 8001, "frontend_port": 3782}"#,
        )
        .unwrap();
        assert_eq!(frontend_port(&dir), Some(3782));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn missing_settings_yield_no_port() {
        assert_eq!(frontend_port(Path::new("/nonexistent-dt-home")), None);
    }

    #[test]
    fn language_seed_writes_only_when_missing() {
        let dir = std::env::temp_dir().join("dt-stack-lang-home");
        let settings = dir.join("data").join("user").join("settings");
        let _ = std::fs::remove_dir_all(&dir);
        seed_interface_language(&dir);
        let seeded = std::fs::read_to_string(settings.join("interface.json")).unwrap();
        assert!(seeded.contains("\"language\""));
        // Existing user choices must survive: rewrite and confirm no overwrite.
        // 已有的用户选择必须保留: 改写后确认不会被覆盖。
        std::fs::write(settings.join("interface.json"), "{\"language\": \"zh\"}").unwrap();
        seed_interface_language(&dir);
        assert_eq!(
            std::fs::read_to_string(settings.join("interface.json")).unwrap(),
            "{\"language\": \"zh\"}"
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn theme_falls_back_to_snow_when_unset() {
        let dir = std::env::temp_dir().join("dt-stack-theme-home");
        let settings = dir.join("data").join("user").join("settings");
        std::fs::create_dir_all(&settings).unwrap();
        std::fs::write(settings.join("interface.json"), r#"{"language": "en"}"#).unwrap();
        assert_eq!(theme_from_home(&dir), "snow");
        std::fs::write(
            settings.join("interface.json"),
            r#"{"theme": "glass", "language": "en"}"#,
        )
        .unwrap();
        assert_eq!(theme_from_home(&dir), "glass");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn node_bin_is_prepended() {
        let path = prepend_node_bin(Path::new("/opt/runtime"));
        assert!(path.starts_with("/opt/runtime/node/bin:"));
    }
}
