/**
 * Transport contracts shared by every deployment target.
 *
 * Transport 契约, 所有部署目标共享。
 *
 * The renderer only sees these types; whether calls travel over Tauri IPC or a
 * future web transport is an implementation detail owned by each adapter.
 *
 * Renderer 只看到这些类型; 调用走 Tauri IPC 还是未来的 web transport,
 * 由各适配器实现自行决定。
 */

export interface BridgeInfo {
  protocol_version: number
  agent_name: string
  agent_version: string | null
  bridge_version: string
  runtime_target: string
  agent_available: boolean
  agent_connected: boolean
}

export interface BridgeHealth {
  status: 'ok' | 'unavailable' | string
  agent_available: boolean
  agent_connected: boolean
}

export interface ChatSendParams {
  message: string
  session_id?: string
  capability?: string
}

export interface ChatSendResult {
  session_id: string
  turn_id: string
  status: string
}

export interface CancelResult {
  turn_id: string
  cancelled: boolean
}

export interface ResumeResult {
  turn_id: string
  resumed: boolean
}

export interface SessionSummary {
  id: string
  [key: string]: unknown
}

export interface SessionPage {
  sessions: SessionSummary[]
  limit: number
  offset: number
}

/** One translated bridge stream event (`bridge://event` payload). */
/** 一条转换后的 bridge 流式事件 (`bridge://event` 的 payload)。 */
export interface BridgeEvent {
  event: string
  request_id: string | number | null
  turn_id?: string | null
  session_id?: string | null
  stage?: string | null
  text?: string
  content?: string
  status?: string
  metadata?: Record<string, unknown>
  seq?: number | null
  [key: string]: unknown
}

export interface BridgeStatus {
  status: string
}

export interface Transport {
  /** Spawn the bridge (if needed) and return its handshake info. */
  /** 启动 bridge(如未运行)并返回握手信息。 */
  start: () => Promise<BridgeInfo>
  /** Gracefully stop the bridge process. */
  /** 优雅停止 bridge 进程。 */
  stop: () => Promise<void>
  getInfo: () => Promise<BridgeInfo>
  health: () => Promise<BridgeHealth>
  sendChat: (params: ChatSendParams) => Promise<ChatSendResult>
  cancel: (turnId: string) => Promise<CancelResult>
  resume: (turnId: string, text?: string | null, answers?: Array<{ id: string }> | null) => Promise<ResumeResult>
  listSessions: (limit?: number, offset?: number) => Promise<SessionPage>
  getSession: (sessionId: string) => Promise<{ session: unknown }>
  /** Subscribe to translated stream events; returns an unsubscribe fn. */
  /** 订阅转换后的流式事件; 返回取消订阅函数。 */
  onEvent: (listener: (event: BridgeEvent) => void) => Promise<() => void>
  /** Subscribe to bridge lifecycle status changes; returns an unsubscribe fn. */
  /** 订阅 bridge 生命周期状态变化; 返回取消订阅函数。 */
  onStatus: (listener: (status: BridgeStatus) => void) => Promise<() => void>
}

/** Structured bridge failure raised by every transport method. */
/** 所有 transport 方法抛出的结构化 bridge 错误。 */
export class TransportError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(code: string, message: string, retryable = false) {
    super(message)
    this.name = 'TransportError'
    this.code = code
    this.retryable = retryable
  }
}
