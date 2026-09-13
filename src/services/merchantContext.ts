// 当前商户上下文模块（一人多商户的 X-Merchant-Id 来源）
// 独立成模块的原因：request.ts 需要读取当前商户，而 stores/merchant 依赖 services，
// 若 request.ts 直接 import store 会形成循环依赖（store → services → request → store）
// 改动说明：配合 B5 修复打通 Taro → BFF → API 的 X-Merchant-Id 全链路
let currentMerchantId: string | null = null

/** 设置当前选中商户（商户切换器调用；持久化由 store 负责，冷启动恢复后再 set） */
export function setCurrentMerchantId(id: string | null): void {
  currentMerchantId = id
}

/** 读取当前选中商户（request.ts 注入 X-Merchant-Id 头用；null 则后端按首个成员商户处理） */
export function getCurrentMerchantId(): string | null {
  return currentMerchantId
}
