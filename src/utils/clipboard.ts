// 剪贴板工具（H5 / 小程序）：走 Taro.setClipboardData。
// 改动说明（v1.4.23）：RN 端 Taro 未实现 setClipboardData，直接调用会抛
// "undefined is not a function"；按 .rn 后缀拆出 RN 实现，调用方统一走 copyText。
import Taro from '@tarojs/taro'

/** 复制文本到剪贴板（失败时向上抛出，由调用方提示） */
export async function copyText(text: string): Promise<void> {
  await Taro.setClipboardData({ data: text })
}