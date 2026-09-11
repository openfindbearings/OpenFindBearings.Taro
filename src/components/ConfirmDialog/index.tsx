// 确认对话框：非 RN 端实现（H5 / 小程序）
// 职责：与 index.rn.tsx 同名配对提供 showConfirmDialog() 命令式接口，
// 本文件用 Taro.showModal 承载（浏览器/小程序确认框），跨端行为与既有一致。
// 说明：RN 端由 Metro 解析命中 index.rn.tsx（react-native 原生 Modal 自绘），
// 规避 Taro showModal 在 Android 真机按钮触摸失效的缺陷，并统一全站弹窗视觉。
import Taro from '@tarojs/taro'

/** 确认对话框参数 */
export interface ConfirmDialogOptions {
  /** 标题，缺省为"提示" */
  title?: string
  /** 正文内容 */
  content: string
  /** 确认按钮文案，缺省"确定" */
  confirmText?: string
  /** 取消按钮文案，缺省"取消" */
  cancelText?: string
  /** 是否显示取消按钮，缺省 true */
  showCancel?: boolean
  /** 确认按钮颜色（可用于危险操作提示红），缺省跟随系统 */
  confirmColor?: string
}

/** 弹出确认对话框，resolve 用户是否确认（true=确认） */
export function showConfirmDialog(opts: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Taro.showModal({
      title: opts.title ?? '提示',
      content: opts.content,
      showCancel: opts.showCancel ?? true,
      confirmText: opts.confirmText ?? '确定',
      cancelText: opts.cancelText ?? '取消',
      confirmColor: opts.confirmColor,
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false)
    })
  })
}

/** 确认对话框组件（非 RN 端占位，实际由命令式 showConfirmDialog 承载） */
export default function ConfirmDialog() {
  return null
}