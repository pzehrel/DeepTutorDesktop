/**
 * Placeholder transport for a future browser deployment.
 *
 * 面向未来浏览器部署的占位 transport。
 *
 * DeepTutor's HTTP/WebSocket API is deliberately not wired here yet: the
 * desktop security model forbids local TCP listeners, and the web deployment
 * shape is still undecided. Every method fails fast instead of silently
 * pretending to work.
 *
 * DeepTutor 的 HTTP/WebSocket API 尚未接入: 桌面安全模型禁止本地 TCP
 * 监听, web 部署形态也未定。所有方法都会快速失败, 而不是假装可用。
 */
import type { Transport } from './types'
import { TransportError } from './types'

function unsupported(method: string): never {
  throw new TransportError(
    'WEB_TRANSPORT_UNIMPLEMENTED',
    `WebTransport does not implement ${method} yet`,
    false,
  )
}

export class WebTransport implements Transport {
  async start() {
    return unsupported('start')
  }

  async stop() {
    return unsupported('stop')
  }

  async getInfo() {
    return unsupported('getInfo')
  }

  async health() {
    return unsupported('health')
  }

  async sendChat() {
    return unsupported('sendChat')
  }

  async cancel() {
    return unsupported('cancel')
  }

  async resume() {
    return unsupported('resume')
  }

  async listSessions() {
    return unsupported('listSessions')
  }

  async getSession() {
    return unsupported('getSession')
  }

  async onEvent() {
    return unsupported('onEvent')
  }

  async onStatus() {
    return unsupported('onStatus')
  }
}
