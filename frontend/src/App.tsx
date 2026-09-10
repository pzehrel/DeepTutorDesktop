import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useCallback, useEffect, useState } from 'react'

type StackState
  = | { status: 'stopped' }
    | { status: 'starting' }
    | { status: 'ready', url: string }
    | { status: 'failed', message: string }

type Theme = 'snow' | 'light' | 'dark' | 'glass'

/**
 * Boot loader for the embedded DeepTutor web app.
 *
 * The Rust core starts `deeptutor start` against a bundled Python + Node
 * runtime and emits `deeptutor://state`. Once the packaged Next.js frontend is
 * reachable on the loopback interface, this shell navigates the window to it —
 * from that point on the user is inside the full DeepTutor interface.
 *
 * The loader mirrors DeepTutor's persisted interface theme
 * (`data/user/settings/interface.json`) so the launch experience matches the
 * app that follows; switching themes inside DeepTutor carries over to the
 * next launch.
 *
 * 内嵌 DeepTutor Web 应用的启动加载页。Rust 核心会用内嵌的 Python + Node
 * 运行时启动 `deeptutor start`, 并通过 `deeptutor://state` 广播状态; 内置
 * Next.js 前端在回环地址就绪后, 本页面把窗口跳转过去 —— 之后用户就一直
 * 处在完整的 DeepTutor 界面里。
 *
 * 加载页会镜像 DeepTutor 持久化的界面主题
 * (`data/user/settings/interface.json`), 启动体验与随后打开的应用一致;
 * 在 DeepTutor 内切换主题后, 下次启动加载页会跟随新主题。
 */
export default function App() {
  const [state, setState] = useState<StackState>({ status: 'stopped' })

  useEffect(() => {
    let cancelled = false

    function apply(next: StackState) {
      if (cancelled) {
        return
      }
      setState(next)
      if (next.status === 'ready') {
        // Replace this loader with the full DeepTutor web UI.
        // 用完整 DeepTutor Web UI 替换本加载页。
        window.location.replace(next.url)
      }
    }

    void (async () => {
      // Match DeepTutor's saved theme before first paint of the loader.
      // 在加载页首次绘制前对齐 DeepTutor 已保存的主题。
      try {
        const theme = await invoke<Theme>('stack_theme')
        document.documentElement.dataset.theme = theme
      }
      catch {
        // Theme lookup is cosmetic; the default stylesheet applies.
        // 主题读取仅影响外观; 失败时使用默认样式。
      }
      await listen<StackState>('deeptutor://state', event => apply(event.payload))
      try {
        apply(await invoke<StackState>('stack_status'))
      }
      catch {
        // Status command unavailable (e.g. not inside Tauri); keep stopped.
        // 取不到状态时(如不在 Tauri 内), 保持 stopped。
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const retry = useCallback(async () => {
    try {
      setState(await invoke<StackState>('stack_start'))
    }
    catch (cause) {
      setState({
        status: 'failed',
        message: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }, [])

  return (
    <main className="loader">
      <img src="/icon.png" alt="" className="loader-logo" />
      <h1>DeepTutor</h1>
      {state.status === 'failed'
        ? (
            <div className="loader-error">
              <p>{state.message}</p>
              <button type="button" onClick={() => void retry()}>Retry</button>
            </div>
          )
        : (
            <p className="loader-status">
              <span className="spinner" aria-hidden />
              Starting the embedded DeepTutor runtime…
            </p>
          )}
    </main>
  )
}
