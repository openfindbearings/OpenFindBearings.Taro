// 语音识别服务工厂：RN 端 Vosk 离线实现（.rn.tsx 由 Metro 平台解析自动选中）
// 职责：封装 react-native-vosk@0.3.3，加载 Android assets 下的中文小模型 model-cn，
// 实现 AsrService 接口；start 触发录音并自动请求麦克风权限，stop 后经 onFinalResult 返回识别文本。
// 说明：该版本为旧 bridge 架构（无 Turbo Module），兼容 RN 0.70；未来切换后端 ASR 时
// 调整本文件或新增 Cloud Provider 即可，调用方（useAsr）无感知。
import Vosk from 'react-native-vosk'
import type { AsrService } from './types'

/** Android assets 中的模型目录名（对应 android/app/src/main/assets/model-cn） */
const MODEL_NAME = 'model-cn'
/** 单次录音上限 60 秒，超时由底层触发 onTimeout 自动停止 */
const RECOGNIZE_TIMEOUT = 60000

/** Vosk 离线识别 Provider：实现 AsrService 接口 */
export class VoskAsrProvider implements AsrService {
  /** Vosk 引擎实例（react-native-vosk 默认导出类） */
  private vosk = new Vosk()
  /** 模型是否已加载完成 */
  private modelLoaded = false
  /** 加载中的 Promise，避免并发重复加载 */
  private loadingPromise: Promise<void> | null = null

  isAvailable(): boolean {
    return true
  }

  load(): Promise<void> {
    if (this.modelLoaded) return Promise.resolve()
    const pending = this.loadingPromise
    if (pending) return pending
    // 首次加载：从 assets 解压模型到应用存储并载入内存，完成后更新标志
    const task = this.vosk
      .loadModel(MODEL_NAME)
      .then(() => {
        this.modelLoaded = true
      })
      .catch((e: unknown) => {
        throw e
      })
      .finally(() => {
        this.loadingPromise = null
      })
    this.loadingPromise = task
    return task
  }

  async start(): Promise<void> {
    await this.load()
    await this.vosk.start({ timeout: RECOGNIZE_TIMEOUT })
  }

  stop(): void {
    this.vosk.stop()
  }

  onResult(cb: (text: string) => void): () => void {
    // 最终结果：stop 后由底层触发，文本为识别出的完整语句
    const sub = this.vosk.onFinalResult(cb)
    return () => sub.remove()
  }

  onError(cb: (message: string) => void): () => void {
    const sub = this.vosk.onError((e: unknown) => cb(String(e)))
    return () => sub.remove()
  }

  dispose(): void {
    // 卸载模型并复位标志，下次使用需重新加载
    this.vosk.unload()
    this.modelLoaded = false
    this.loadingPromise = null
  }
}

/** 创建 RN 端的语音识别 Provider 实例（Vosk 离线实现） */
export function createAsrProvider(): AsrService {
  return new VoskAsrProvider()
}
