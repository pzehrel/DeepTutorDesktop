import type { BridgeEvent, BridgeInfo, TransportError } from './transport'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createTransport } from './transport'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

type BridgePhase = 'idle' | 'starting' | 'running' | 'streaming' | 'error'

let messageSeq = 0
function nextMessageId(): string {
  messageSeq += 1
  return `msg-${messageSeq}`
}

export default function App() {
  const [phase, setPhase] = useState<BridgePhase>('idle')
  const [info, setInfo] = useState<BridgeInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [draft, setDraft] = useState('')
  const activeTurn = useRef<string | null>(null)
  const streamBuffer = useRef('')

  useEffect(() => {
    const transport = createTransport()

    const handleEvent = (event: BridgeEvent) => {
      if (event.event === 'chat.delta' && typeof event.text === 'string') {
        // Deltas arrive as small fragments; buffer then flush per render.
        // delta 是小片段; 先缓冲再按渲染周期刷新。
        streamBuffer.current += event.text
        setStreamingText(streamBuffer.current)
        return
      }
      if (event.event === 'chat.done' || event.event === 'chat.error') {
        const text = streamBuffer.current
        if (text) {
          setMessages(prev => [...prev, { id: nextMessageId(), role: 'assistant', text }])
        }
        if (event.event === 'chat.error') {
          const message = typeof event.message === 'string' ? event.message : 'turn failed'
          setError(message)
        }
        streamBuffer.current = ''
        setStreamingText('')
        activeTurn.current = null
        setPhase(p => (p === 'streaming' ? 'running' : p))
      }
    }

    const subscriptions: Array<() => void> = []
    let cancelled = false

    void (async () => {
      try {
        subscriptions.push(await transport.onEvent(handleEvent))
        subscriptions.push(await transport.onStatus((status) => {
          if (status.status === 'exited') {
            activeTurn.current = null
            streamBuffer.current = ''
            setStreamingText('')
            setPhase('idle')
            setInfo(null)
          }
        }))
      }
      catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }
    })()

    return () => {
      cancelled = true
      for (const unsubscribe of subscriptions) {
        unsubscribe()
      }
    }
  }, [])

  const startBridge = useCallback(async () => {
    setError(null)
    setPhase('starting')
    try {
      const transport = createTransport()
      const handshake = await transport.start()
      setInfo(handshake)
      setPhase('running')
    }
    catch (cause) {
      setPhase('error')
      setError(formatError(cause))
    }
  }, [])

  const sendMessage = useCallback(async () => {
    const text = draft.trim()
    if (!text || phase === 'idle' || phase === 'starting' || phase === 'streaming') {
      return
    }
    setDraft('')
    setMessages(prev => [...prev, { id: nextMessageId(), role: 'user', text }])
    setPhase('streaming')
    try {
      const transport = createTransport()
      const result = await transport.sendChat({ message: text })
      activeTurn.current = result.turn_id
    }
    catch (cause) {
      setPhase('running')
      setError(formatError(cause))
    }
  }, [draft, phase])

  const cancelTurn = useCallback(async () => {
    const turnId = activeTurn.current
    if (!turnId) {
      return
    }
    try {
      await createTransport().cancel(turnId)
    }
    catch (cause) {
      setError(formatError(cause))
    }
  }, [])

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">TAURI DESKTOP SHELL</p>
        <h1>DeepTutor Desktop</h1>
        <p className="lede">
          Chat with the packaged DeepTutor runtime through the Tauri-managed
          stdio bridge.
        </p>
      </section>

      <section className="status-card" aria-live="polite">
        <div className="status-row">
          <h2>Runtime status</h2>
          <span className={`pill pill-${phase}`}>{phase}</span>
        </div>
        {info && (
          <p className="status-detail">
            agent
            {' '}
            {info.agent_version ?? 'unknown'}
            {' · '}
            bridge v
            {info.bridge_version}
            {' · '}
            protocol v
            {info.protocol_version}
            {' · '}
            {info.runtime_target}
          </p>
        )}
        <div className="status-actions">
          {phase === 'idle' || phase === 'error'
            ? (
                <button type="button" onClick={() => void startBridge()}>
                  Start bridge
                </button>
              )
            : phase === 'streaming'
              ? (
                  <button type="button" className="danger" onClick={() => void cancelTurn()}>
                    Cancel turn
                  </button>
                )
              : null}
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="chat-card">
        <h2>Chat</h2>
        <div className="chat-log">
          {messages.map(message => (
            <div key={message.id} className={`bubble bubble-${message.role}`}>
              {message.text}
            </div>
          ))}
          {streamingText && (
            <div className="bubble bubble-assistant bubble-streaming">
              {streamingText}
              <span className="cursor" aria-hidden>▍</span>
            </div>
          )}
          {messages.length === 0 && !streamingText && (
            <p className="chat-empty">Start the bridge and send a message.</p>
          )}
        </div>
        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault()
            void sendMessage()
          }}
        >
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder={phase === 'running' ? 'Ask DeepTutor…' : 'Start the bridge first…'}
            disabled={phase !== 'running'}
            aria-label="Message"
          />
          <button type="submit" disabled={phase !== 'running' || draft.trim().length === 0}>
            Send
          </button>
        </form>
      </section>
    </main>
  )
}

function formatError(cause: unknown): string {
  if (cause instanceof Error && 'code' in cause) {
    const typed = cause as TransportError
    return `${typed.code}: ${typed.message}`
  }
  return cause instanceof Error ? cause.message : String(cause)
}
