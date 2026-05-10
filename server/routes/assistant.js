import { Router } from 'express'
import { sendMessage } from '../ai/claude-client.js'

const router = Router()

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return []
  return messages
    .filter((message) => ['user', 'assistant'].includes(message?.role) && typeof message.content === 'string')
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 3000),
    }))
}

function buildAssistantUserPrompt({ context = {}, messages = [] }) {
  const safeContext = JSON.stringify(context || {}, null, 2).slice(0, 8000)
  const history = normalizeMessages(messages)
    .map((message) => `${message.role === 'user' ? '用户' : '助手'}：${message.content}`)
    .join('\n\n')

  return `页面上下文：
${safeContext || '{}'}

对话历史：
${history || '无'}

请根据最后一条用户消息回复。`
}

router.post('/chat', async (req, res) => {
  const messages = normalizeMessages(req.body?.messages)
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'messages must end with a user message' })
  }

  const result = await sendMessage(
    [
      '你是一个中文微课视频创作助手。',
      '你帮助用户梳理选题、资料收集要求、分镜结构、旁白和可视化想法。',
      '优先给出可以直接放进当前表单或分镜里的具体建议。',
      '不要替用户编造事实；不确定时提示需要核实。',
      '回复简洁，默认用中文。',
    ].join(' '),
    buildAssistantUserPrompt({ context: req.body?.context, messages }),
    { maxTokens: 1800, temperature: 0.4 },
  )

  if (result.error) return res.status(502).json({ error: result.error })
  return res.json({ message: { role: 'assistant', content: result.text } })
})

export { buildAssistantUserPrompt, normalizeMessages }
export default router
