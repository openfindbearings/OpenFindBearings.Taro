/**
 * 表单校验工具。
 * 职责：集中管理跨页复用的输入格式校验（与 BFF 端同规则，双端一致防漂移）。
 */

/** 中国大陆手机号：11 位、1 开头、第二位 3-9（与 BFF AuthEndpoints.IsChineseMobile 同规则） */
export function isChineseMobile(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone)
}
