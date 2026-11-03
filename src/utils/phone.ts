// 拨打电话工具（H5 / 小程序）：互联网来源商家的公开号码可直接拨打。
// 号码先清掉空格、连字符等格式字符——带分隔符传给拨号接口在部分机型上会失败；
// 失败静默（用户取消系统拨号确认不算错误）。
import Taro from '@tarojs/taro'

/**
 * 拨打电话：空号码直接忽略；H5 用 tel: 协议唤起拨号，小程序走 Taro.makePhoneCall。
 * @param phone 原始号码（可含空格、连字符、括号）
 */
export function callPhone(phone?: string | null) {
  if (!phone) return
  const number = phone.replace(/[^\d+]/g, '')
  if (!number) return
  if (process.env.TARO_ENV === 'h5') {
    window.location.href = `tel:${number}`
    return
  }
  Taro.makePhoneCall({ phoneNumber: number }).catch(() => {})
}
