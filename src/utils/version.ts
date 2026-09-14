// 当前应用版本号与平台标识（H5/小程序默认实现；RN 端 Metro 解析 version.rn.ts 覆盖）
// 改动说明：版本更新功能上线，版本单一来源为 package.json version——
// 编译期经 config/index.ts defineConstants 注入 __APP_VERSION__，运行时从此处统一读取

/** 获取当前应用版本号（SemVer，如 1.0.0-rc.1） */
export function getAppVersion(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
}

/** 平台标识：版本检查接口按平台取服务端配置（h5/weapp/android/ios） */
export function getAppPlatform(): 'weapp' | 'h5' {
  return process.env.TARO_ENV === 'weapp' ? 'weapp' : 'h5'
}

/**
 * 以下为非 RN 端空实现（与 version.rn.ts 保持同一导出面，服务层跨端共用不触雷）：
 * H5/小程序不存在 APK 下载，原生模块与 ABI 均无意义
 */

/** APK 下载进度事件负载（非 RN 端仅为类型占位，不会收到事件） */
export interface ApkProgressEvent {
  status: 'running' | 'paused' | 'pending' | 'success' | 'failed' | 'unknown'
  downloadedBytes: number
  totalBytes: number
  progress: number
}

/** 原生 APK 下载模块接口（非 RN 端恒 null） */
export interface ApkUpdateNative {
  downloadAndInstall(url: string, fileName: string): Promise<string>
}

/** 主 CPU ABI（非 RN 端返回占位，不参与下载 URL 拼接） */
export function getMainAbi(): string {
  return 'h5'
}

/** 取原生更新模块：非 RN 端恒 null（调用方走 updateManager/刷新提示分支） */
export function getApkUpdateModule(): ApkUpdateNative | null {
  return null
}

/** 订阅下载进度：非 RN 端空操作 */
export function addApkProgressListener(_cb: (e: ApkProgressEvent) => void): () => void {
  return () => {}
}

/** 打开外部链接（非 RN 端回退：H5 window.open，小程序不支持下载故仅 H5 有意义） */
export function openExternalUrl(url: string): void {
  if (process.env.TARO_ENV === 'h5' && typeof window !== 'undefined') {
    window.open(url)
  }
}
