// 应用级触感反馈工具（v1.7.13）
// 开关价值：系统触感开着，用户仍可在本 App 内强制关闭震动（iOS 键盘触感同思路）；
// 关闭时完全不调 Taro 震动 API，零开销。三端支持：H5 navigator.vibrate / RN Vibration / 小程序 vibrateShort。
import Taro from '@tarojs/taro'
import { getObject } from './storage'

/** 设置页存储键（与 pages/my/settings.tsx 的 SETTINGS_KEY 一致） */
const SETTINGS_KEY = 'app_settings'

/**
 * 震动开关是否开启：读 app_settings.vibrateEnabled，未设置默认开
 */
async function vibrateOn(): Promise<boolean> {
  try {
    const s = await getObject<{ vibrateEnabled?: boolean }>(SETTINGS_KEY)
    return s?.vibrateEnabled !== false
  } catch {
    // 存储读取异常不打扰操作，按默认开处理
    return true
  }
}

/**
 * 轻触感：滑出动作菜单 / 弹sheet 等即时反馈（短震）
 */
export async function vibrateTap(): Promise<void> {
  if (!(await vibrateOn())) return
  Taro.vibrateShort({ type: 'light' }).catch(() => {})
}

/**
 * 成功触感：提交申请 / 保存资料 / 成员操作成功等关键操作的正反馈（长震）
 */
export async function vibrateSuccess(): Promise<void> {
  if (!(await vibrateOn())) return
  Taro.vibrateLong().catch(() => {})
}
