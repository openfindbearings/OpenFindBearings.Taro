// 轻提示（RN）：Android 用原生 ToastAndroid，iOS 用 Alert 兜底。
// 改动说明（v1.4.25）：Taro.showToast 在 RN 未实现，调用后无反馈。
import { Alert, Platform, ToastAndroid } from 'react-native'

/** 显示一条无图标轻提示 */
export function showTip(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT)
    return
  }
  Alert.alert('提示', message)
}