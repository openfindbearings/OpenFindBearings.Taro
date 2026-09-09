// 智能模式聊天窗（DeepSeek 式）—— P1 前端 UI，回复走 services/assistant 占位
// RN-first：只用 Taro 跨端组件 + flex 列（消息列表 ScrollView flex:1 + 底部输入栏），
// 无 fixed/渐变/vh（vh 仅 H5 内联用于算高度，RN 走 flex:1）。
import { useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Icon from '../Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { IS_RN } from '../../utils/platform'
import { askAssistant, SUGGESTED_PROMPTS, type ChatMessage } from '../../services/assistant'
import './index.scss'

// 消息 id 生成（时间戳 + 自增，避免同毫秒重复）
let _seq = 0
const genId = () => `m${Date.now()}_${_seq++}`

export default function ChatWindow() {
  const t = useTheme()
  const fs = useFs()
  // 初始仅一条助手问候语
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: genId(), role: 'assistant', text: '你好，我是轴承智能助手，想查什么型号或选型问题都可以问我。' }
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  // 新消息 id 作为 ScrollView scrollIntoView 目标，实现自动滚到底
  const [anchor, setAnchor] = useState('')

  // 发送一条提问：入队用户消息 → 置发送中 → 调助手 → 入队回复
  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || sending) return
    const userMsg: ChatMessage = { id: genId(), role: 'user', text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setSending(true)
    setAnchor(userMsg.id)
    try {
      const reply = await askAssistant(text, next)
      const aiMsg: ChatMessage = { id: genId(), role: 'assistant', text: reply }
      setMessages((prev) => [...prev, aiMsg])
      setAnchor(aiMsg.id)
    } catch {
      const errMsg: ChatMessage = { id: genId(), role: 'assistant', text: '抱歉，刚才出错了，请重试。' }
      setMessages((prev) => [...prev, errMsg])
      setAnchor(errMsg.id)
    } finally {
      setSending(false)
    }
  }

  // 仅问候语时展示快捷提问建议
  const isEmpty = messages.length <= 1

  return (
    // RN 靠 flex:1 在 PageLayout(scrollY=false) 内撑满；H5 文档流下用 calc 算可视高（顶栏44+底栏56）
    <View className='chat' style={IS_RN ? { flex: 1 } : { height: 'calc(100vh - 100px)' }}>
      <ScrollView className='chat-list' scrollY scrollIntoView={anchor} scrollWithAnimation>
        {messages.map((m) => (
          <View
            key={m.id}
            id={m.id}
            className={`chat-row ${m.role === 'user' ? 'chat-row-user' : 'chat-row-ai'}`}
          >
            {m.role === 'assistant' && (
              <View className='chat-avatar' style={{ backgroundColor: t.primary }}>
                <Icon name="sparkles" size={18} color={t.textOnPrimary} />
              </View>
            )}
            <View
              className='chat-bubble'
              style={{ backgroundColor: m.role === 'user' ? t.primary : t.bgCard }}
            >
              <Text
                className='chat-bubble-text'
                style={{ ...fs(15), color: m.role === 'user' ? t.textOnPrimary : t.textPrimary }}
              >
                {m.text}
              </Text>
            </View>
          </View>
        ))}

        {sending && (
          <View className='chat-row chat-row-ai'>
            <View className='chat-avatar' style={{ backgroundColor: t.primary }}>
              <Icon name="sparkles" size={18} color={t.textOnPrimary} />
            </View>
            <View className='chat-bubble' style={{ backgroundColor: t.bgCard }}>
              <Text className='chat-bubble-text' style={{ ...fs(15), color: t.textTertiary }}>思考中…</Text>
            </View>
          </View>
        )}

        {isEmpty && (
          <View className='chat-suggest'>
            {SUGGESTED_PROMPTS.map((p) => (
              <View
                key={p}
                className='chat-suggest-item'
                style={{ backgroundColor: t.bgCard, borderColor: t.border }}
                onClick={() => send(p)}
              >
                <Text className='chat-suggest-text' style={{ ...fs(14), color: t.textSecondary }}>{p}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 底部输入栏：输入框 + 发送按钮 */}
      <View className='chat-input-bar' style={{ borderTopColor: t.border, backgroundColor: t.bgCard }}>
        <Input
          className='chat-input'
          style={{ backgroundColor: t.bgInput, color: t.textPrimary }}
          value={input}
          placeholder='问我轴承型号、选型、商家…'
          placeholderTextColor={t.textTertiary}
          confirmType='send'
          onInput={(e) => setInput(e.detail.value)}
          onConfirm={() => send(input)}
        />
        <View
          className='chat-send'
          style={{ backgroundColor: sending ? t.border : t.primary }}
          onClick={() => send(input)}
        >
          <Icon name="send" size={20} color={t.textOnPrimary} />
        </View>
      </View>
    </View>
  )
}
