// 语音识别服务入口（单例工厂）
// 职责：统一对外暴露 createAsrService()，内部按平台委托给 asrProvider.ts（非 RN）
// 或 asrProvider.rn.tsx（RN/Vosk）；跨页面复用同一实例，避免重复加载模型。
import { createAsrProvider } from './asrProvider'
import type { AsrService } from './types'

/** 单例实例：跨页面复用同一引擎，避免每次进入页面重复加载模型 */
let instance: AsrService | null = null

/** 创建（或复用）语音识别服务实例 */
export function createAsrService(): AsrService {
  if (!instance) {
    instance = createAsrProvider()
  }
  return instance
}
