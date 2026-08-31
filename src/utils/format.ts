/** 价格格式化：数值 → 带千分位字符串 */
export function formatPrice(value: number | null | undefined): string {
  if (value == null) return '-'
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** UTC 时间字符串 → 本地时间格式化 */
export function formatTime(utcString: string | null | undefined): string {
  if (!utcString) return '-'
  // 补 Z 防止 Razor HTML 编码 + 号
  const s = /[Z]|[+-]\d{2}:\d{2}$/.test(utcString) ? utcString : utcString + 'Z'
  const d = new Date(s)
  if (isNaN(d.getTime())) return utcString
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 短时间格式：仅时分 */
export function formatTimeShort(utcString: string | null | undefined): string {
  if (!utcString) return '-'
  const s = /[Z]|[+-]\d{2}:\d{2}$/.test(utcString) ? utcString : utcString + 'Z'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

/** 数字缩写：万/亿 */
export function formatCount(value: number | null | undefined): string {
  if (value == null) return '0'
  if (value >= 100_000_000) return (value / 100_000_000).toFixed(1) + '亿'
  if (value >= 10_000) return (value / 10_000).toFixed(1) + '万'
  return String(value)
}
