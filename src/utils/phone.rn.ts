// 拨打电话工具（RN）：Taro.makePhoneCall 在 RN 无落地实现，改用 Linking 打开系统拨号。
// Metro 按 .rn.ts 后缀解析本文件替代 phone.ts；号码清掉格式字符后再交给系统，失败静默。
import { Linking } from 'react-native'

/**
 * 拨打电话（RN）：空号码直接忽略，打开系统拨号盘。
 * @param phone 原始号码（可含空格、连字符、括号）
 */
export function callPhone(phone?: string | null) {
  if (!phone) return
  const number = phone.replace(/[^\d+]/g, '')
  if (!number) return
  Linking.openURL(`tel:${number}`).catch(() => {})
}
