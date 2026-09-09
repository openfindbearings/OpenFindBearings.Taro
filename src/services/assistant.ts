// 智能助手服务（P1：前端 UI 先行，暂用本地占位回复）
// 职责：为智能模式聊天窗提供"提问→回复"能力。当前无大模型后端，返回占位文案；
//       接口形状按将来接 BFF POST /mobile/chat 设计，届时仅替换 askAssistant 内部实现，UI 不动。
// 改动说明：智能模式前端 UI 首版新建。

/** 一条聊天消息 */
export interface ChatMessage {
  /** 消息唯一 id */
  id: string
  /** 角色：用户 / 助手 */
  role: 'user' | 'assistant'
  /** 文本内容 */
  text: string
}

/** 会话上下文（一问一答序列），供多轮/未来 RAG 使用 */
export type ChatHistory = ChatMessage[]

/**
 * 向智能助手提问，返回回复文本。
 * P1 占位实现：不接模型，返回固定引导文案（保留接口签名，将来换成真实调用）。
 * @param question 用户本轮输入
 * @param history  既有会话历史（占位实现暂不使用，预留给多轮/RAG）
 */
export async function askAssistant(question: string, history: ChatHistory = []): Promise<string> {
  // TODO(P2): 替换为 await request('/mobile/chat', { method:'POST', data:{ question, history } })
  void history
  // 模拟一点网络延迟，让"发送中"状态可见
  await new Promise((resolve) => setTimeout(resolve, 400))
  return (
    `你好，我是轴承智能助手（预览版）。已收到你的问题：「${question}」。\n` +
    `正式的大模型问答能力即将接入，届时我会结合本站的型号、参数与在售商家为你解答选型、替代、报价等问题。`
  )
}

/** 空状态下的快捷提问建议（点一下直接发送） */
export const SUGGESTED_PROMPTS: string[] = [
  '帮我推荐一款深沟球轴承',
  '6205 是什么型号？',
  'ZWZ 和 NSK 哪个好？',
  '内径 25mm 的轴承有哪些？'
]
