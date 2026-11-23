// 全局返回守卫（非 RN 端占位）：H5/小程序由页面内 NavBar 返回按钮与系统手势接管，无需额外订阅
export default function GlobalBackGuard() {
  return null
}