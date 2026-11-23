// 全局返回守卫（RN 端）：统一 Android 实体返回键与左右滑手势的落点
// 规则：栈内有上一页 → 返回上一页；栈底非首页 → 回首页；栈底即首页 → 交还系统（退出 App）
import Taro from '@tarojs/taro'
import { useHardwareBack } from '../../hooks/useHardwareBack'
import { backOrHome, currentPagePath, currentStackDepth } from '../../utils/navBack'

export default function GlobalBackGuard() {
  useHardwareBack(() => {
    // 栈内有上一页：直接回退，交由 Taro 路由处理
    if (currentStackDepth() > 1) {
      Taro.navigateBack({ delta: 1 })
      return true
    }
    // 栈底：非首页先回首页，首页则返回 false 让系统退出 App
    if (currentPagePath() !== 'pages/home/index') {
      backOrHome()
      return true
    }
    return false
  })
  return null
}