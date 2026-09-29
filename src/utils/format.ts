/** 通用格式化工具函数 */

/**
 * 两位补零（内部工具）
 * 改动说明（v1.7.19 真机修复）：原实现走 toLocaleString('zh-CN')，
 *   Android 微信 JSCore 无完整 Intl → 回落成 "Tue Sep 29 2026 07:22:00 GMT+0800 (CST)" 生英文串；
 *   改手写补零，三端一致且展示层仍按浏览器/容器本地时区渲染（Date 的本地 getter 通用可用）
 */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** 格式化时间：将 UTC ISO 字符串转为本地 "YYYY-MM-DD HH:mm" */
export function formatTime(utcString?: string | null): string {
  if (!utcString) return '-'
  try {
    const d = new Date(utcString.endsWith('Z') ? utcString : utcString + 'Z')
    if (isNaN(d.getTime())) return '-'
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  } catch {
    return '-'
  }
}

/** 格式化日期：将 UTC ISO 字符串转为本地 "YYYY-MM-DD"（只要日期的场合用，如勋章获得日） */
export function formatDate(utcString?: string | null): string {
  return formatTime(utcString).slice(0, 10)
}

/** 格式化价格 */
export function formatPrice(price?: number | null, negotiable?: boolean): string {
  if (price == null || price === 0) return negotiable ? '议价' : '-'
  return `¥${price.toFixed(2)}${negotiable ? ' (议价)' : ''}`
}

/** 截断文本 */
export function truncate(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text || ''
  return text.slice(0, maxLen) + '...'
}
