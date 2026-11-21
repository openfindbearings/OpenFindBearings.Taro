// 剪贴板工具（RN）：react-native 核心 Clipboard（0.70 仍内置，后续版本需迁 @react-native-clipboard/clipboard）。
// 改动说明（v1.4.23）：Taro.setClipboardData 在 RN 未实现，改用原生 Clipboard.setString。
import { Clipboard } from 'react-native'

/** 复制文本到剪贴板（同步写入系统剪贴板） */
export async function copyText(text: string): Promise<void> {
  Clipboard.setString(text)
}