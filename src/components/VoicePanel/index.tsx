// 语音面板：非 RN 端占位实现（H5 / 小程序）
// 职责：与 index.rn.tsx 同名配对提供 openVoicePanel() 入口；
// 非 RN 平台语音搜索暂不支持（首页入口已用 IS_RN 拦截并 toast 提示），
// 此处为空实现与 null 组件占位，保证跨端构建不报错。
export function openVoicePanel(): void {
  // 空实现：语音搜索暂仅支持 App 端，入口处已拦截
}

/** 语音面板组件（非 RN 端不渲染） */
export default function VoicePanel() {
  return null
}