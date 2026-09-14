// 当前应用版本号与平台标识（RN 端实现，Metro 按 .rn 后缀解析本文件）
// 改动说明：RN 读安装包原生版本号（android versionName 已在 build.gradle 与 package.json 对齐），
// 真机显示与实际安装包一致；__APP_VERSION__ 编译期常量作 device-info 异常时的回退
import { Platform, NativeModules, DeviceEventEmitter, Linking } from 'react-native'
// 改动说明：device-info v15 全部 API 为具名导出，用具名导入避免 import/no-named-as-default 告警
import { getVersion, supportedAbisSync } from 'react-native-device-info'

/** 获取当前应用版本号（SemVer，如 1.0.0-rc.1） */
export function getAppVersion(): string {
  try {
    return getVersion() || (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0')
  } catch {
    return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
  }
}

/** 平台标识：版本检查接口按平台取服务端配置 */
export function getAppPlatform(): 'android' | 'ios' {
  return Platform.OS === 'android' ? 'android' : 'ios'
}

/** 主 CPU ABI（决定下载哪个分包；读取失败回退 arm64-v8a 主流机型） */
export function getMainAbi(): string {
  try {
    const abis = supportedAbisSync() || []
    // 64 位优先：arm64-v8a 覆盖当前绝大多数真机
    if (abis.indexOf('arm64-v8a') >= 0) return 'arm64-v8a'
    if (abis.indexOf('armeabi-v7a') >= 0) return 'armeabi-v7a'
    return abis[0] || 'arm64-v8a'
  } catch {
    return 'arm64-v8a'
  }
}

/** APK 应用内下载与安装（原生模块 ApkUpdate，见 android/.../ApkUpdateModule.java） */
export interface ApkUpdateNative {
  /**
   * 下载 APK 并在完成后拉起系统安装界面
   * @returns "downloading" 已入队 / "need-permission" 缺安装权限（已跳设置页）
   */
  downloadAndInstall(url: string, fileName: string): Promise<string>
}

/** 取原生更新模块（iOS 或未链接时返回 null，调用方回退浏览器下载） */
export function getApkUpdateModule(): ApkUpdateNative | null {
  if (Platform.OS !== 'android') return null
  return (NativeModules.ApkUpdate as ApkUpdateNative) || null
}

/** APK 下载进度事件负载（与原生 ApkUpdateModule 的 ApkUpdateProgress 对齐） */
export interface ApkProgressEvent {
  status: 'running' | 'paused' | 'pending' | 'success' | 'failed' | 'unknown'
  downloadedBytes: number
  totalBytes: number
  /** 0-100，总大小未知时为 0 */
  progress: number
}

/**
 * 订阅原生下载进度事件
 * 改动说明：Android 用 DeviceEventEmitter（RCTDeviceEventEmitter.emit 的目标通道），
 * 返回退订函数
 */
export function addApkProgressListener(cb: (e: ApkProgressEvent) => void): () => void {
  if (Platform.OS !== 'android') return () => {}
  const sub = DeviceEventEmitter.addListener('ApkUpdateProgress', (e: ApkProgressEvent) => cb(e))
  return () => sub.remove()
}

/** 打开外部链接（RN 用 Linking，作为无原生模块时的兜底下载入口） */
export function openExternalUrl(url: string): void {
  Linking.openURL(url).catch(() => {})
}
