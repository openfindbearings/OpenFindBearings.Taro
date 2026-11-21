// 轻提示（H5 / 小程序）：走 Taro.showToast。
// 改动说明（v1.4.25）：Taro.showToast 在 RN 未实现，调用后无任何反馈；
// 按 .rn 后缀提供原生实现，调用方统一走 showTip。
import Taro from '@tarojs/taro'

/** 显示一条无图标轻提示 */
export function showTip(message: string): void {
  Taro.showToast({ title: message, icon: 'none' })
}