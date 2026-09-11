// 语音识别服务工厂：非 RN 端占位实现（H5 / 小程序）
// 职责：为不支持语音识别的平台返回占位 Provider（isAvailable=false），
// 保证跨端构建（webpack / 小程序）不因引用了 RN 原生库而报错。
// 说明：与 asrProvider.rn.tsx 同名配对，Metro（RN）自动解析 .rn.tsx 版本，
// webpack / 小程序解析本文件；index.ts 以无后缀路径 import，两端各自命中。
import type { AsrService } from './types'

/** 不支持平台的占位实现：isAvailable 恒 false，所有方法为空操作 */
export class UnsupportedAsrProvider implements AsrService {
  isAvailable(): boolean {
    return false
  }
  load(): Promise<void> {
    return Promise.resolve()
  }
  start(): Promise<void> {
    return Promise.resolve()
  }
  stop(): void {
    // 空实现：平台不支持时不执行任何操作
  }
  onResult(): () => void {
    return () => {
      // 空实现：占位退订函数
    }
  }
  onError(): () => void {
    return () => {
      // 空实现：占位退订函数
    }
  }
  dispose(): void {
    // 空实现：无可释放资源
  }
}

/** 创建非 RN 端的语音识别 Provider 实例 */
export function createAsrProvider(): AsrService {
  return new UnsupportedAsrProvider()
}
