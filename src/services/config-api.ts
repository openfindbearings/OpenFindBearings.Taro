import { request } from './request'
import { API, setMediaBaseUrl } from './config'

/** 站点配置 */
export interface SiteConfig {
  siteName?: string
  siteDescription?: string
  siteBeiAn?: string
  /** App 备案号（工信部 App/小程序/网站独立备案，RN 端关于页用） */
  beiAnApp?: string
  /** 小程序备案号（微信端关于页用） */
  beiAnMini?: string
  customerService?: string
  /** 媒体源公网 base（末尾无斜杠），拉到后写入运行时覆盖 */
  mediaBaseUrl?: string
}

/** 获取站点配置（公开接口） */
export async function getSiteConfig() {
  return request<SiteConfig>(API.CONFIG, { auth: false })
}

// 启动拉取的站点配置内存缓存：客服电话/备案号等低频读取字段复用，避免逐页重新请求
let siteConfigCache: SiteConfig | null = null

/** 读取缓存的站点配置（启动拉取失败时返回 null，调用方自行兜底） */
export function getCachedSiteConfig(): SiteConfig | null {
  return siteConfigCache
}

/**
 * 按平台取"本页应展示的备案号"：微信端=小程序备案、RN=App 备案、其余(H5)=网站备案；
 * 对应键未配置时回退网站备案号（早期只有 Site.BeiAn 一键的历史兼容）
 */
export function getBeiAnForPlatform(cfg: SiteConfig | null): string {
  if (!cfg) return ''
  const env = process.env.TARO_ENV
  const pick = env === 'weapp' ? cfg.beiAnMini : env === 'rn' ? cfg.beiAnApp : cfg.siteBeiAn
  return pick || cfg.siteBeiAn || ''
}

/**
 * 启动时拉取站点配置并应用到运行时（目前消费媒体源 base）。
 * 改动说明：失败静默——getMediaBase 会回落编译期默认，不阻塞启动。
 */
export async function applySiteConfigOnLaunch(): Promise<void> {
  try {
    const cfg = await getSiteConfig()
    if (cfg?.mediaBaseUrl) setMediaBaseUrl(cfg.mediaBaseUrl)
    // 改动说明（v1.7.24）：整份缓存供设置页热线/关于页备案号同步读取，免各页重复请求
    if (cfg) siteConfigCache = cfg
  } catch {
    /* 拉取失败忽略，回落编译期默认媒体 base */
  }
}
