// 语音识别 hook：useAsr
// 职责：封装 AsrService 生命周期与状态机（idle / recording / processing），
// 提供 startListening / stopListening 对，供"按住说话"（onTouchStart / onTouchEnd）交互使用。
// 说明：识别结果通过 startListening 传入的 onResult 回调返回，stop 后事件异步到达，
// 因此内置兜底定时器，超时未收到结果则按空结果结束；组件卸载时释放引擎资源。
import { useCallback, useEffect, useRef, useState } from 'react'
import { createAsrService } from '../services/asr'
import type { AsrService, AsrState } from '../services/asr/types'

/** stop 后等待识别结果事件的兜底时长（毫秒）：底层事件异步派发，超时视为无结果。
 *  改动说明：1500→600，空录音（Vosk 不触发事件）更快复位；真录音走事件通道不受影响 */
const RESULT_SETTLE_TIMEOUT = 600

/** 语音识别事件处理句柄 */
export interface AsrHandlers {
  /** 识别到最终文本时回调（可能是空字符串，需调用方过滤） */
  onResult: (text: string) => void
  /** 识别出错时回调（权限拒绝 / 模型缺失 / 引擎异常） */
  onError?: (message: string) => void
}

/** useAsr 返回值 */
export interface UseAsrResult {
  /** 当前识别状态：idle 空闲 / recording 录音中 / processing 停止后结果处理中 */
  state: AsrState
  /** 当前平台是否可用（H5 / 小程序恒 false，调用方据此提示） */
  available: boolean
  /** 开始录音（按住调用）：成功进入 recording 并返回 true；不可用 / 已占用返回 false */
  startListening: (handlers: AsrHandlers) => Promise<boolean>
  /** 停止录音（松手调用）：触发最终结果回调，随后回到 idle */
  stopListening: () => void
  /** 取消录音（误触调用）：立即停止并复位到 idle，不等识别结果、不触发回调 */
  cancelListening: () => void
  /** 预热模型（打开语音面板时调用）：加载识别模型，使首次按住即可录音，不动状态机 */
  warmup: () => Promise<void>
}

/** 语音识别 hook：管理引擎生命周期与按住说话状态机 */
export function useAsr(): UseAsrResult {
  // 懒初始化单例引擎（跨页面复用，避免重复加载模型）
  const svcRef = useRef<AsrService | null>(null)
  if (svcRef.current === null) {
    svcRef.current = createAsrService()
  }

  const [state, setState] = useState<AsrState>('idle')
  // 状态 ref：回调闭包内读取最新状态，避免闭包过期
  const stateRef = useRef<AsrState>('idle')
  const handlersRef = useRef<AsrHandlers | null>(null)
  const cleanupRef = useRef<() => void>(() => {})
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 改动说明：标记"用户已松手"（stopListening 已调用），用于 start 异步完成后补停，
  // 避免 TS 对 ref.current 在 async 边界窄化导致的状态字面量误判，语义也更清晰
  const cancelledRef = useRef(false)

  const setStateBoth = useCallback((s: AsrState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
  }, [])

  const cleanupListeners = useCallback(() => {
    cleanupRef.current()
    cleanupRef.current = () => {}
  }, [])

  // 结束一次识别流程：清定时器 / 清监听 / 复位句柄与状态
  const finish = useCallback(() => {
    clearSettleTimer()
    cleanupListeners()
    handlersRef.current = null
    setStateBoth('idle')
  }, [clearSettleTimer, cleanupListeners, setStateBoth])

  useEffect(() => {
    // 组件卸载：清理监听与定时器并释放引擎
    return () => {
      clearSettleTimer()
      cleanupListeners()
      svcRef.current?.dispose()
      svcRef.current = null
    }
  }, [clearSettleTimer, cleanupListeners])

  const startListening = useCallback(
    async (handlers: AsrHandlers): Promise<boolean> => {
      const svc = svcRef.current
      if (!svc || !svc.isAvailable() || stateRef.current !== 'idle') return false
      handlersRef.current = handlers
      // 注册最终结果与错误监听，stop 后事件到达即结束流程
      const unResult = svc.onResult((text) => {
        handlersRef.current?.onResult(text)
        finish()
      })
      const unError = svc.onError((message) => {
        handlersRef.current?.onError?.(message)
        finish()
      })
      cleanupRef.current = () => {
        unResult()
        unError()
      }
      setStateBoth('recording')
      cancelledRef.current = false
      try {
        await svc.start()
        // 改动说明：start 为异步（含权限申请），期间用户可能已松手触发 stopListening；
        // 此时底层录音服务尚未就绪，stop 为空操作，需在此补停，防止残留持续录音
        if (cancelledRef.current) {
          svc.stop()
        }
        return true
      } catch (e) {
        // 启动失败（权限拒绝 / 模型缺失）：通知调用方并复位
        handlersRef.current?.onError?.(String(e))
        finish()
        return false
      }
    },
    [finish, setStateBoth]
  )

  const stopListening = useCallback(() => {
    const svc = svcRef.current
    if (!svc || stateRef.current !== 'recording') return
    // 标记已松手：start 异步完成时据此补停，防止残留录音
    cancelledRef.current = true
    setStateBoth('processing')
    svc.stop()
    // 兜底：底层事件异步派发，超时未收到结果则按空结果结束流程
    settleTimerRef.current = setTimeout(() => finish(), RESULT_SETTLE_TIMEOUT)
  }, [finish, setStateBoth])

  // 误触取消：立即停止并复位（空录音不触发 Vosk 事件，若不取消会空等兜底定时器）
  const cancelListening = useCallback(() => {
    const svc = svcRef.current
    if (!svc || stateRef.current !== 'recording') return
    cancelledRef.current = true
    svc.stop()
    finish()
  }, [finish])

  // 预热模型：打开语音面板时调用，加载过程与状态机解耦，失败由 start 时再报错提示
  const warmup = useCallback(() => {
    return svcRef.current?.load() ?? Promise.resolve()
  }, [])

  return {
    state,
    available: svcRef.current?.isAvailable() ?? false,
    startListening,
    stopListening,
    cancelListening,
    warmup
  }
}
