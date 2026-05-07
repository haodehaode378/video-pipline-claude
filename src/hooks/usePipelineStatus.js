import { useState, useEffect, useRef } from 'react'

export function usePipelineStatus(slug) {
  const [episode, setEpisode] = useState(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const reconnectRef = useRef(null)

  useEffect(() => {
    if (!slug) return undefined

    let disposed = false

    const connect = () => {
      if (disposed) return

      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${location.host}/ws`

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        ws.send(JSON.stringify({ type: 'subscribe', slug }))
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'update' && msg.episode) {
            setEpisode(msg.episode)
          }
        } catch {
          // Ignore malformed websocket messages.
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (!disposed) reconnectRef.current = setTimeout(connect, 2000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      disposed = true
      clearTimeout(reconnectRef.current)
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [slug])

  return { episode, connected }
}
