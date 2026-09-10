import type { Transport } from './types'
/**
 * Transport selection for the renderer.
 *
 * Renderer 的 transport 选择入口。
 */
import { TauriTransport } from './tauri'
import { WebTransport } from './web'

export { TransportError } from './types'
export type * from './types'
export { TauriTransport, WebTransport }

/**
 * Pick the transport for the current host.
 *
 * Pick the transport for the current host.
 *
 * 根据宿主环境选择 transport: Tauri WebView 内走 IPC, 其他环境保留给
 * 未来的 WebTransport。
 */
export function createTransport(): Transport {
  // window.__TAURI_INTERNALS__ is injected by every Tauri WebView.
  // window.__TAURI_INTERNALS__ 由 Tauri WebView 注入。
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    return new TauriTransport()
  }
  return new WebTransport()
}
