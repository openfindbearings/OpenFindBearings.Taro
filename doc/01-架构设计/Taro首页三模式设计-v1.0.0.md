# Taro 首页三模式设计

- 版本：v1.0.0
- 日期：2026-09-08
- 状态：智能模式为 P1（前端 UI + 占位回复），后端大模型接入见第 6 节路线图
- 关联：`Taro架构设计-v1.0.0`、`界面设计规范-v1.3.0`、`跨端适配说明-v1.2.0`

## 1. 背景与目标

首页支持三种模式，用户在「设置 - 外观 - 首页模式」中三选一，选择持久化到本地：

1. 普通模式（normal）：默认。顶部固定搜索栏 + 快捷三钮 + 搜索历史 / 热门搜索 / 热门轴承 / 推荐商家，信息密度高，适合浏览与检索。
2. 简洁模式（simple）：无顶栏，搜索框 + 快捷三钮在内容区垂直居中，隐藏历史/热门，只保留底栏。适合只想快速搜一下的极简用户。
3. 智能模式（smart）：全屏 AI 聊天窗（类 DeepSeek），用自然语言问型号、选型、替代、商家等。面向"知道自己要什么但不知型号"的对话式查询。

三模式共用同一套色调、图标、字号、主题与数据服务，只有首页主体布局与交互不同。

## 2. 模式存储与切换

### 2.1 存储字段
本地 `app_settings` 对象新增主字段 `homeMode`：

```
homeMode: 'normal' | 'simple' | 'smart'
```

为兼容旧版本，保留旧字段 `simpleHome: boolean` 作为镜像写入（`homeMode==='simple'` 时为 true）。读取时优先 `homeMode`，缺失则由 `simpleHome` 迁移（true 转 simple，false 转 normal）。

### 2.2 读写位置
- 首页 `pages/home/index.tsx`：`useDidShow` 读 `app_settings`，解析出 `homeMode`，据此渲染三种分支之一。
- 设置页 `pages/my/settings.tsx`：三按钮分段选择器（普通/简洁/智能），`handleHomeMode(mode)` 写 `homeMode` + `simpleHome`。

### 2.3 登录门槛
沿用既有策略：普通、智能始终可选；简洁需登录（未登录点击弹「请先登录/去登录」）。智能模式是查询辅助，不要求登录。

## 3. 各模式界面规格

### 3.1 普通模式（不变）
NavBar 搜索态（搜索框铺满）+ 快捷三钮（讲语音/拍轴承/扫条码）+ 搜索历史 + 热门搜索 + 热门轴承（横向卡）+ 推荐商家（竖向卡）。PageLayout 走内容滚动。

### 3.2 简洁模式（不变）
无 NavBar；搜索框 + 三钮作为一组在内容区垂直居中；隐藏历史/热门；保留底栏。

### 3.3 智能模式（新增）
组件：`components/ChatWindow`。整体为 flex 列：

```
NavBar「智能助手」
  |
消息滚动区 ScrollView（flex:1，内部滚动）
  - 助手消息：左对齐，头像圆点(sparkles) + 气泡（bgCard 底、主文字色）
  - 用户消息：右对齐，气泡（primary 底、反色文字）
  - 发送中：追加一条「思考中…」助手气泡
  - 空状态（仅问候语时）：问候气泡下方展示 4 条快捷提问建议卡，点击即发送
  |
输入栏（顶部分隔线）
  - Input（占位「问我轴承型号、选型、商家…」，confirmType=send）
  - 发送圆形按钮（send 图标；发送中置灰禁用）
  |
CustomTabBar（底栏）
```

交互：
- 输入回车或点发送 → 追加用户气泡 → 置发送中 → 调 `askAssistant` → 追加助手气泡 → 滚动到底。
- 消息仅存内存（组件 state），不落本地、不发后端（P1）。
- 自动滚到底：新消息 id 作为 ScrollView 的 `scrollIntoView` 目标。

## 4. 跨端实现要点（RN-first）

- 只用 Taro 跨端组件（View/Text/ScrollView/Input）+ flex 布局；无 position:fixed/sticky、无 linear-gradient、无 gap、无百分比圆角（RN 限制）。
- 聊天窗高度按平台给：RN 用 `flex:1`（配合 PageLayout `scrollY={false}` 关闭外层滚动、由消息列表内部滚动）；H5 用内联 `height: calc(100vh - 100px)`（顶栏 44 + 底栏 56），文档流下自算可视高。
- PageLayout 已按平台拆分（`platforms/PageLayout.rn.tsx` 纯 RN、`platforms/PageLayout.tsx` H5/小程序），智能模式复用之，仅传 `scrollY={false}`。
- 颜色/字号全部经 `useTheme()` / `useFs()` 内联，随深浅色与主题预设实时切换。
- 图标经 `components/Icon` 抽象层（H5=lucide-react，RN=lucide-react-native），用到 `sparkles`、`send`。

## 5. 服务层接口（预留后端）

`services/assistant.ts`：

```
interface ChatMessage { id: string; role: 'user' | 'assistant'; text: string }
askAssistant(question: string, history: ChatMessage[]): Promise<string>
SUGGESTED_PROMPTS: string[]
```

P1 为本地占位实现（固定引导文案 + 模拟延迟）。将来接真模型时，仅替换 `askAssistant` 内部为 `request('/mobile/chat', { method:'POST', data:{ question, history } })`，UI 与调用点零改动。

## 6. 智能模式后端路线图

当前全项目无任何 AI/LLM 集成。聊天能力需新增后端，分三阶段：

### P1 通用问答（UI 先行，本设计）
- 前端聊天 UI + 占位回复。
- BFF 预留 `POST /mobile/chat`（请求 { question, history }，响应 { reply }），暂返回占位。

### P2 领域增强（通用模型 + RAG）
用一家通用大模型即可，无需微调/专用模型。增强分三层，按需叠加：
1. 系统提示词：设定「轴承选型助手」角色与回答规范（零基建）。
2. RAG 检索增强：提问 → 先查本站轴承/商家（复用现有 search 接口：关键词 + 品牌/类型 + 尺寸筛选）→ 把命中的真实数据注入 prompt → 模型基于真实数据回答。起步用关键词召回即可，不必先上向量库。
3. Function Calling：支持 tools 的模型自行决定调用检索接口再作答（比 RAG 更灵活，依赖模型能力）。

安全与成本：模型 API Key 只放 BFF 服务端（K8s Secret），绝不下发前端；加限流与单次 token 上限；对模型输出做「仅供参考、以商家实际报价为准」免责标注。

### P3 流式
H5 用 SSE 流式打字机效果；RN/小程序流式受限，先整段返回，后按端能力渐进。

### 待决策（实施 P2 前需产品拍板）
- 模型供应商与 Key（DeepSeek / 通义千问 / 智谱 / OpenAI 兼容）。
- 领域范围：通用问答 vs 轴承选型助手（RAG）。
- 是否要会话持久化（存后端，跨设备）。

## 7. 影响文件清单（P1）

- 新增 `src/services/assistant.ts`
- 新增 `src/components/ChatWindow/index.tsx` + `index.scss`
- 改 `src/pages/home/index.tsx`（homeMode 三态 + 迁移 + 智能分支）
- 改 `src/pages/my/settings.tsx`（三按钮模式选择器 + handleHomeMode）
- 关联既有：`src/platforms/PageLayout.*`（骨架，已按平台拆分）

## 8. 版本历史

- v1.0.0（2026-09-08）：首版。定义三模式（普通/简洁/智能）规格、homeMode 存储与迁移、智能模式聊天 UI 与跨端实现、服务层预留接口、后端 P1/P2/P3 路线图。
