import { request } from './request'
import { API, setMediaBaseUrl } from './config'

/** 站点配置 */
export interface SiteConfig {
  siteName?: string
  siteDescription?: string
  siteBeiAn?: string
  customerService?: string
  /** 媒体源公网 base（末尾无斜杠），拉到后写入运行时覆盖 */
  mediaBaseUrl?: string
}

/** 获取站点配置（公开接口） */
export async function getSiteConfig() {
  return request<SiteConfig>(API.CONFIG, { auth: false })
}

/**
 * 启动时拉取站点配置并应用到运行时（目前消费媒体源 base）。
 * 改动说明：失败静默——getMediaBase 会回落编译期默认，不阻塞启动。
 */
export async function applySiteConfigOnLaunch(): Promise<void> {
  try {
    const cfg = await getSiteConfig()
    if (cfg?.mediaBaseUrl) setMediaBaseUrl(cfg.mediaBaseUrl)
  } catch {
    /* 拉取失败忽略，回落编译期默认媒体 base */
  }
}
