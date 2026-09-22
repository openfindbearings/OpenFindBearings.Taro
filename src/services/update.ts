// 版本更新服务：启动每日检查 + 应用内下载安装（RN/Android）+ 小程序 updateManager + H5 提示刷新
// 改动说明：设置页原 checkVersion 为硬编码"已是最新版本"，接入后端 /mobile/version/check 后
// 走真实比较。三端策略：RN 走应用内 DownloadManager 下载并拉起安装；小程序用原生 updateManager
// 自动更包；H5 部署即最新，仅提示刷新。版本比较语义已由后端 SemVer 处理，此处只做展示与下载。
import Taro from '@tarojs/taro'
import { request } from './request'
import { API, buildQuery } from './config'
import { getItem, setItem } from '../utils/storage'
import { showConfirmDialog } from '../components/ConfirmDialog'
import {
  getAppVersion,
  getAppPlatform,
  getMainAbi,
  getApkUpdateModule,
  addApkProgressListener,
  openExternalUrl
} from '../utils/version'

/** 后端版本检查结果（与 API VersionCheckResult 对齐，camelCase） */
export interface VersionCheckResult {
  hasUpdate: boolean
  latestVersion: string
  isForceUpdate: boolean
  updateMessage?: string | null
  downloadUrl?: string | null
}

/**
 * "以后再说"已忽略版本存储键（v1.7.14）：节流从"请求层"挪到"弹窗层"——
 * 启动检查每次都查（一个轻量 GET 可忽略，主流 App 均如此），仅对"用户明确忽略过的
 * 同一版本"不再重复弹窗；服务端宣告更新版本即重新提醒。
 * 改动说明（v1.7.14 修根因）：原 24h 时间戳节流有两个坑：① 宣告新版本后最长 24h 才提示；
 *   ② 手动检查（force）也会写时间戳，把随后的启动检查堵死（实测 rc.11 宣告当天不弹即此因）
 */
const DISMISSED_VERSION_KEY = 'update_dismissed_version'
/** 启动自动检查开关存储键（设备级本地设置，默认开；改动说明：v1.7.6 设置页新增开关项） */
const AUTO_CHECK_KEY = 'auto_update_check'
/** 当前 TARO_ENV */
const ENV = process.env.TARO_ENV

/** 读取"启动时自动检查更新"开关（未设置过默认开启） */
export async function isAutoUpdateEnabled(): Promise<boolean> {
  const v = await getItem(AUTO_CHECK_KEY).catch(() => null)
  return v !== 'false'
}

/** 设置"启动时自动检查更新"开关 */
export async function setAutoUpdateEnabled(on: boolean): Promise<void> {
  await setItem(AUTO_CHECK_KEY, on ? 'true' : 'false')
}

/**
 * 向后端请求版本检查
 * 改动说明（v1.7.14）：移除 force 参数与 24h 时间戳节流——启动检查每次真实查询，
 * 重复打扰问题改由"已忽略版本"在弹窗层拦截（见 DISMISSED_VERSION_KEY 注释）
 */
async function fetchVersionCheck(): Promise<VersionCheckResult | null> {
  try {
    const url = `${API.VERSION_CHECK}?${buildQuery({
      currentVersion: getAppVersion(),
      platform: getAppPlatform()
    })}`
    return await request<VersionCheckResult>(url, { auth: false })
  } catch {
    // 版本检查失败静默，不打扰用户
    return null
  }
}

/**
 * 小程序原生更新管理：新版包下载就绪后弹窗重启
 * 改动说明：小程序无需后端判断——微信平台自身检测发布版本，启动即注册监听；
 * 手动检查路径（设置页）也复用本函数
 */
function setupWeappUpdate(): void {
  const um = Taro.getUpdateManager?.()
  if (!um) return
  um.onUpdateReady(() => {
    showConfirmDialog({
      title: '版本更新',
      content: '新版本已就绪，是否重启应用？',
      confirmText: '立即重启',
      showCancel: false
    }).then((ok) => {
      if (ok) um.applyUpdate()
    })
  })
  um.onUpdateFailed(() => {
    Taro.showToast({ title: '新版本下载失败，请稍后重试', icon: 'none' })
  })
}

/**
 * 触发下载并弹窗（含进度），三端分支
 * @param result 版本检查结果
 */
async function performUpdate(result: VersionCheckResult): Promise<void> {
  const { latestVersion, downloadUrl } = result

  // 小程序：注册原生 updateManager（有新包系统自动下载，重启即生效）
  if (ENV === 'weapp') {
    setupWeappUpdate()
    return
  }

  // H5：部署即最新，提示刷新
  if (ENV === 'h5') {
    showConfirmDialog({
      title: '版本更新',
      content: `新版本 ${latestVersion} 已发布，刷新页面即可体验`,
      confirmText: '刷新页面',
      showCancel: false
    }).then(() => {
      if (typeof window !== 'undefined') window.location.reload()
    })
    return
  }

  // RN/Android：应用内 DownloadManager 下载并拉起安装
  const native = getApkUpdateModule()
  if (!native) {
    // 原生模块缺失（iOS 或未链接）时回退浏览器打开下载地址
    if (downloadUrl) openExternalUrl(downloadUrl)
    return
  }

  // 服务端 downloadUrl 为目录（以 / 结尾），客户端按 app-<version>-<abi>.apk 拼文件名。
  // 版本号补 v 前缀归一（CI 产物命名为 app-v<版本>-<abi>.apk，配置漏 v 也能对上）
  const base = (downloadUrl || '').replace(/\/+$/, '')
  if (!base) {
    Taro.showToast({ title: '未配置下载地址', icon: 'none' })
    return
  }
  const tag = latestVersion.startsWith('v') ? latestVersion : `v${latestVersion}`
  const fileName = `app-${tag}-${getMainAbi()}.apk`
  const url = `${base}/${fileName}`

  // 改动说明（v1.7.8 经典两段式）：原文案"正在下载…将自动拉起安装"是下载态描述，
  //   却配"取消/开始下载"确认按钮——文案与按钮语义矛盾。改为标准更新确认弹窗
  //   （发现新版本 + 以后再说/立即更新），点"立即更新"后才进入下载 loading 与进度
  const confirmed = await showConfirmDialog({
    title: `发现新版本 ${latestVersion}`,
    content: result.updateMessage || '新版本已发布，下载完成后将自动进入安装。',
    confirmText: '立即更新',
    cancelText: '以后再说',
    // 改动说明：强制更新时不给取消机会（后端 ForceUpdate 开且低于 MinVersion 才为 true）
    showCancel: !result.isForceUpdate
  })
  if (!confirmed) {
    // 改动说明（v1.7.14）：用户点"以后再说"→ 记录已忽略版本，启动检查对该版本静默
    //   （强制更新不记录——不给取消机会，理论不可达，防御性排除）
    if (!result.isForceUpdate) await setItem(DISMISSED_VERSION_KEY, latestVersion).catch(() => {})
    return
  }

  trackDownloadProgress()
  try {
    const status = await native.downloadAndInstall(url, fileName)
    // "downloading" 仅代表入队成功：后续进度与收尾（hideLoading/注销监听）由进度监听处理
    if (status === 'need-permission') {
      stopProgressTracking()
      Taro.showToast({ title: '请允许安装未知应用后重试', icon: 'none' })
    }
  } catch {
    stopProgressTracking()
    Taro.showToast({ title: '下载启动失败', icon: 'none' })
  }
}

/** 下载进度监听退订函数（模块级单例，避免重复订阅） */
let progressUnsub: (() => void) | null = null

/**
 * 开始跟踪下载进度：showLoading 实时刷新百分比，终态（success/failed）自动收尾退订
 * 改动说明：downloadAndInstall 的 Promise 在入队后即 resolve（非下载完成），
 * 真正的进度与结束由原生 ApkUpdateProgress 事件驱动，故监听生命周期独立于 Promise
 */
function trackDownloadProgress(): void {
  if (progressUnsub) return
  progressUnsub = addApkProgressListener((e) => {
    if (e.status === 'success' || e.status === 'failed') {
      Taro.hideLoading()
      stopProgressTracking()
    } else {
      Taro.showLoading({ title: `下载中 ${e.progress}%`, mask: true })
    }
  })
  Taro.showLoading({ title: '准备下载…', mask: true })
}

/** 停止进度跟踪并退订原生事件 */
function stopProgressTracking(): void {
  if (progressUnsub) {
    progressUnsub()
    progressUnsub = null
  }
}

/**
 * 启动时静默检查：仅发现更新才弹窗，不阻塞、不打扰（v1.7.14 起每次启动都查，仅对已忽略版本静默）
 * 改动说明：H5 部署即最新无需检查；小程序走原生 updateManager（微信自检测，不经后端）。
 * 未同意隐私政策前不发网络请求（合规），且避免与首启隐私弹窗争用同一弹窗总线
 */
export async function checkUpdateOnLaunch(): Promise<void> {
  if (ENV === 'h5') return
  // 改动说明（v1.7.6）：设置页"启动时自动检查更新"关闭时跳过（手动检查不受影响）
  if (!(await isAutoUpdateEnabled())) return
  const consent = await getItem('privacy_consent').catch(() => null)
  if (consent !== 'true') return
  if (ENV === 'weapp') {
    setupWeappUpdate()
    return
  }
  const result = await fetchVersionCheck()
  if (result && result.hasUpdate) {
    // 改动说明（v1.7.14）：用户此前对同一版本点过"以后再说"则启动静默（新版本自动恢复提醒）
    const dismissed = await getItem(DISMISSED_VERSION_KEY).catch(() => null)
    if (dismissed && (dismissed === result.latestVersion || `v${dismissed}` === result.latestVersion)) return
    await performUpdate(result)
  }
}

/**
 * 设置页手动检查：无更新也反馈。
 * 改动说明：后端版本比较只对 RN APK 有意义（H5/小程序发布链路不同源），
 * 两端分别给确定性反馈：H5 提示刷新、小程序提示自动更新，RN 走真实检查
 */
export async function checkUpdateManually(): Promise<void> {
  const current = `v${getAppVersion()}`
  if (ENV === 'h5') {
    showConfirmDialog({
      title: '版本更新',
      content: `当前版本 ${current}。网页版每次部署即最新版，如有异常请强制刷新（Ctrl+F5）。`,
      showCancel: false,
      confirmText: '知道了'
    })
    return
  }
  if (ENV === 'weapp') {
    setupWeappUpdate()
    showConfirmDialog({
      title: '版本更新',
      content: `当前版本 ${current}。小程序由微信自动保持最新版本。`,
      showCancel: false,
      confirmText: '知道了'
    })
    return
  }

  Taro.showLoading({ title: '检查中', mask: true })
    const result = await fetchVersionCheck()
  Taro.hideLoading()
  if (!result) {
    Taro.showToast({ title: '检查失败，请稍后重试', icon: 'none' })
    return
  }
  if (!result.hasUpdate) {
    showConfirmDialog({
      title: '版本更新',
      content: `当前版本 ${current}，已是最新版本。`,
      showCancel: false,
      confirmText: '知道了'
    })
    return
  }
  await performUpdate(result)
}
