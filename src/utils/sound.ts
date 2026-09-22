// 新消息提示音工具（v1.7.13）：轮询发现未读数增加时提醒，三端分策实现。
// 音效开关（app_settings.soundEnabled，默认开）关闭时完全静默。
// 平台策略：H5 用 Web Audio 现场合成双音（零音频资产）；微信小程序用内嵌 base64 wav
//   + InnerAudioContext（小程序不支持 Web Audio）；RN 无音频原生库（不为此加 expo-av
//   重依赖），以长震动替代提醒——将来接入推送时统一换系统通知渠道的声音。
import Taro from '@tarojs/taro'
import { getObject } from './storage'

const SETTINGS_KEY = 'app_settings'

/** 双音提示 wav（8kHz/16bit/mono，880Hz→1175Hz 各 180ms，约 7.7KB base64，小程序端用） */
const BEEP_B64 = 'data:audio/wav;base64,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'

/** 音效开关是否开启（未设置默认开） */
async function soundOn(): Promise<boolean> {
  try {
    const s = await getObject<{ soundEnabled?: boolean }>(SETTINGS_KEY)
    return s?.soundEnabled !== false
  } catch {
    return true
  }
}
/** H5：Web Audio 合成双音提示（不依赖任何音频文件资产） */
function playH5Beep(): void {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const t0 = ctx.currentTime
    ;[[880, 0], [1175, 0.2]].forEach(([freq, offset]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const start = t0 + offset
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
      osc.start(start)
      osc.stop(start + 0.2)
    })
    // 播完释放（Safari 需 close 回收，否则多次触发累积）
    setTimeout(() => { ctx.close().catch(() => {}) }, 600)
  } catch { /* 浏览器策略限制（未交互前禁声）时静默 */ }
}

/**
 * 新消息提醒（fire-and-forget）：按平台分策，音效开关关闭时零动作
 */
export async function notifyNewMessage(): Promise<void> {
  if (!(await soundOn())) return
  const env = process.env.TARO_ENV
  if (env === 'h5') {
    playH5Beep()
    return
  }
  if (env === 'rn') {
    // RN 无音频原生库，长震动替代（见文件头说明）
    Taro.vibrateLong().catch(() => {})
    return
  }
  // 小程序及其他端：InnerAudioContext 播内嵌 wav
  try {
    const audio = Taro.createInnerAudioContext()
    audio.src = BEEP_B64
    audio.onEnded(() => audio.destroy())
    audio.onError(() => audio.destroy())
    audio.play()
  } catch { /* 播放失败不打扰 */ }
}