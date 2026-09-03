import { request } from './request'
import { API } from './config'

/** 站点配置 */
export interface SiteConfig {
  siteName?: string
  siteDescription?: string
  siteBeiAn?: string
  customerService?: string
}

/** 获取站点配置（公开接口） */
export async function getSiteConfig() {
  return request<SiteConfig>(API.CONFIG, { auth: false })
}
