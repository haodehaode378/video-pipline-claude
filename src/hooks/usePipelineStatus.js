import { useState, useEffect, useRef, useCallback } from 'react'

export function usePipelineStatus(slug) {
  const [episode, setEpisode] = useState(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const reconnectRef = useRef(null)

  const connect = useCallback(() => {
    if (!slug) return

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
      } catch {}
    }

    ws.onclose = () => {
      setConnected(false)
      // Reconnect after 2 seconds
      reconnectRef.current = setTimeout(connect, 2000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [slug])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  return { episode, connected }
}
