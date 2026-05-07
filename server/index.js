import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import episodesRouter from './routes/episodes.js'
import { listTemplates, getTemplateContent } from './utils/templates.js'
import { setBroadcaster } from './pipeline/orchestrator.js'

const app = express()
const PORT = process.env.PORT || 3000
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(cors())
app.use(express.json())

// Serve generated video files
app.use('/videos', express.static(path.join(__dirname, '..', 'videos')))

app.use('/api/episodes', episodesRouter)

app.get('/api/templates', (req, res) => {
  res.json(listTemplates())
})

app.get('/api/templates/:slug', (req, res) => {
  const t = getTemplateContent(req.params.slug)
  if (!t) return res.status(404).json({ error: 'not found' })
  res.json(t)
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

// Store clients subscribed to each slug
const subscribers = new Map()

wss.on('connection', (ws) => {
  let subscribedSlug = null

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw)
      if (msg.type === 'subscribe' && msg.slug) {
        subscribedSlug = msg.slug
        if (!subscribers.has(msg.slug)) {
          subscribers.set(msg.slug, new Set())
        }
        subscribers.get(msg.slug).add(ws)
      }
    } catch {}
  })

  ws.on('close', () => {
    if (subscribedSlug && subscribers.has(subscribedSlug)) {
      subscribers.get(subscribedSlug).delete(ws)
      if (subscribers.get(subscribedSlug).size === 0) {
        subscribers.delete(subscribedSlug)
      }
    }
  })
})

// Export for orchestrator to call
export function broadcastEpisodeUpdate(slug, episode) {
  const clients = subscribers.get(slug)
  if (!clients) return
  const data = JSON.stringify({ type: 'update', slug, episode })
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(data)
  }
}

setBroadcaster(broadcastEpisodeUpdate)

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
