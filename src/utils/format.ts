/** 通用格式化工具函数 */

/** 格式化时间：将 UTC ISO 字符串转为本地显示 */
export function formatTime(utcString?: string | null): string {
  if (!utcString) return '-'
  try {
    const d = new Date(utcString.endsWith('Z') ? utcString : utcString + 'Z')
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
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
