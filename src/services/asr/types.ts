// 语音识别服务抽象层：类型与接口定义
// 职责：定义 AsrService 接口契约，隔离底层识别引擎（当前 Vosk 离线 / 未来后端 ASR），
// 使调用方（useAsr hook、首页语音按钮）不感知具体实现，未来切换引擎时 UI 零改动。
// 说明：该抽象同时兼容 H5 / 小程序端占位实现（isAvailable=false），保证跨端构建不报错。

/** 语音识别状态：idle 空闲 / recording 录音中 / processing 停止后结果处理中 */
export type AsrState = 'idle' | 'recording' | 'processing'

/** 语音识别服务接口：所有识别引擎（Vosk、云端 ASR 等）必须实现该契约 */
export interface AsrService {
  /** 当前平台是否支持语音识别（H5 / 小程序返回 false，由调用方提示） */
  isAvailable(): boolean
  /** 加载识别模型（Vosk 场景为加载 assets 小模型；云端场景可为空实现），失败抛出异常 */
  load(): Promise<void>
  /** 开始识别：自动申请录音权限，成功后持续采集音频直到 stop */
  start(): Promise<void>
  /** 停止识别：结束后触发一次 onResult（若有有效文本）或 onError */
  stop(): void
  /** 注册最终识别结果回调，返回退订函数 */
  onResult(cb: (text: string) => void): () => void
  /** 注册错误回调，返回退订函数 */
  onError(cb: (message: string) => void): () => void
  /** 释放引擎资源（卸载模型、清理监听），页面卸载时调用 */
  dispose(): void
}
