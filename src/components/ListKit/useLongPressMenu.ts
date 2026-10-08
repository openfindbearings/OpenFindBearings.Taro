// ListKit·useLongPressMenu：长按上下文菜单的安全手势封装。
// 改动说明（RN 崩溃修复）：手指仍按住时 onLongPress 里直接 setState 弹层，触摸序列未结束，
// RN legacy UI 操作队列与视图树增删打架，真机原生崩溃（IllegalViewOperationException:
// Trying to add unknown view tag，"我的寻货"页复现）。对齐安卓原生短信"松手弹菜单"行为：
// 长按只记挂起项，松手（onTouchEnd）才触发回调弹菜单，竞态窗口归零；
// 手指移动（滚动开始）撤销挂起，防止滑动列表时误弹。
// 用法：每页建一个实例，卡片上 {...menuHandlers(item, 可长按条件)}。
import { useRef } from 'react'

/** 返回 menuHandlers(item, enabled)：展开到列表卡片 View 上的三个触摸属性 */
export function useLongPressMenu<T>(onSelect: (item: T) => void) {
  // 挂起的长按项（松手时消费；移动即撤销）
  const pending = useRef<{ item: T } | null>(null)
  return (item: T, enabled: boolean) => ({
    onLongPress: () => {
      if (enabled) pending.current = { item }
    },
    onTouchMove: () => {
      pending.current = null
    },
    onTouchEnd: () => {
      const p = pending.current
      pending.current = null
      if (p) onSelect(p.item)
    }
  })
}
