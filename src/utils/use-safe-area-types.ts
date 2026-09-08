// 安全区结果类型（跨平台共享，无运行时依赖，避免平台文件互相 import 解析歧义）
export interface UseSafeAreaResult {
  /** 顶部状态栏高度 */
  top: number
  /** 底部手势条 / Home Indicator 内缩量 */
  bottom: number
}