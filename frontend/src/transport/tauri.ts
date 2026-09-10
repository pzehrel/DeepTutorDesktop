import type { UnlistenFn } from '@tauri-apps/api/event'
import type {
  BridgeEvent,
  BridgeHealth,
  BridgeInfo,
  BridgeStatus,
  CancelResult,
  ChatSendParams,
  ChatSendResult,
  ResumeResult,
  SessionPage,
  Transport,
} from './types'

/**
 * Tauri IPC transport: calls allowlisted commands, receives forwarded events.
 *
 * Tauri IPC transport: 调用白名单 command, 接收转发的事件。
 *
 * The renderer never touches the bridge process directly; the Rust core owns
 * the sidecar lifecycle and emits `bridge://event` / `bridge://status`.
 *
 * Renderer 不直接接触 bridge 进程; Rust 核心独占 sidecar 生命周期,
 * 并通过 `bridge://event` / `bridge://status` 转发事件。
 */
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { TransportError } from './types'

const BRIDGE_EVENT = 'bridge://event'
const BRIDGE_STATUS_EVENT = 'bridge://status'

/** Normalize a rejected invoke() into a structured TransportError. */
/** 将 invoke() 的 rejection 归一化为结构化 TransportError。 */
function toTransportError(cause: unknown): TransportError {
  if (cause instanceof TransportError) {
    return cause
  }
  if (isBridgeErrorPayload(cause)) {
    return new TransportError(cause.code, cause.message, cause.retryable)
  }
  const message = cause instanceof Error ? cause.message : String(cause)
  return new TransportError('IPC_ERROR', message)
}

function isBridgeErrorPayload(value: unknown): value is { code: string, message: string, retryable?: boolean } {
  return typeof value === 'object'
    && value !== null
    && 'code' in value
    && 'message' in value
    && typeof (value as { code: unknown }).code === 'string'
    && typeof (value as { message: unknown }).message === 'string'
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args)
  }
  catch (cause) {
    throw toTransportError(cause)
  }
}

export class TauriTransport implements Transport {
  async start(): Promise<BridgeInfo> {
    return call<BridgeInfo>('bridge_start')
  }

  async stop(): Promise<void> {
    await call<unknown>('bridge_stop')
  }

  async getInfo(): Promise<BridgeInfo> {
    return call<BridgeInfo>('bridge_info')
  }

  async health(): Promise<BridgeHealth> {
    return call<BridgeHealth>('bridge_health')
  }

  async sendChat(params: ChatSendParams): Promise<ChatSendResult> {
    return call<ChatSendResult>('chat_send', { ...params })
  }

  async cancel(turnId: string): Promise<CancelResult> {
    return call<CancelResult>('request_cancel', { turnId })
  }

  async resume(
    turnId: string,
    text?: string | null,
    answers?: Array<{ id: string }> | null,
  ): Promise<ResumeResult> {
    return call<ResumeResult>('chat_resume', { turnId, text, answers })
  }

  async listSessions(limit?: number, offset?: number): Promise<SessionPage> {
    return call<SessionPage>('session_list', { limit, offset })
  }

  async getSession(sessionId: string): Promise<{ session: unknown }> {
    return call<{ session: unknown }>('session_get', { sessionId })
  }

  async onEvent(listener: (event: BridgeEvent) => void): Promise<() => void> {
    return subscribe(BRIDGE_EVENT, listener)
  }

  async onStatus(listener: (status: BridgeStatus) => void): Promise<() => void> {
    return subscribe(BRIDGE_STATUS_EVENT, listener)
  }
}

async function subscribe<T>(
  eventName: string,
  listener: (payload: T) => void,
): Promise<UnlistenFn> {
  return listen<T>(eventName, event => listener(event.payload))
}
