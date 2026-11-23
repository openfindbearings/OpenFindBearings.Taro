// 全局返回逻辑（三端共用）：返回上一页；已在栈底则回到首页；首页栈底由调用方决定是否退出
// 目的：统一「设置 → 我的」这类逐级返回，以及 Tab 根页返回首页的口径，避免各页各写一套。
import Taro from '@tarojs/taro'

/** 五个底部 Tab 的根路径（去前导斜杠），用于判断当前是否停在 Tab 根页 */
const TAB_ROOTS = [
  'pages/home/index',
  'pages/discover/index',
  'pages/merchant/index',
  'pages/mall/index',
  'pages/my/index'
]

/** 取当前页面路径（去掉前导斜杠，取不到时返回空串） */
export function currentPagePath(): string {
  const path = Taro.getCurrentInstance?.()?.router?.path || ''
  return path.replace(/^\//, '')
}

/** 当前路由栈深度：拿不到栈信息时按 1 处理（视为栈底） */
export function currentStackDepth(): number {
  const pages = (Taro.getCurrentPages && Taro.getCurrentPages()) || []
  return pages.length
}

/** 当前是否停在某个 Tab 根页（含首页） */
export function isTabRoot(): boolean {
  const depth = currentStackDepth()
  if (depth > 1) return false
  return TAB_ROOTS.indexOf(currentPagePath()) >= 0
}

/**
 * 统一返回动作：
 * - 栈内有上一页 → 返回上一页
 * - 栈底且不是首页 → 回首页
 * - 栈底且就是首页 → 不做跳转（由 RN 硬件返回交还系统，触发退出）
 */
export function backOrHome(): void {
  if (currentStackDepth() > 1) {
    Taro.navigateBack({ delta: 1 })
    return
  }
  if (currentPagePath() === 'pages/home/index') return
  Taro.reLaunch({ url: '/pages/home/index' })
}