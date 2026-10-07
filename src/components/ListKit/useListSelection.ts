// ListKit·useListSelection：长按多选模式的纯状态 hook（v2.12.0 全站列表统一）。
// 语义：enter(id)=长按进选择模式并勾中该条；toggle(id)=模式内点选；exit()=退出；
// 各列表页组合本 hook + ListActionSheet（菜单含"多选"项 → enter）+ BatchBar（底部批量条）成三级手势体系。
import { useCallback, useState } from 'react'

/** 多选模式状态与操作 */
export interface ListSelection {
  /** 是否处于选择模式 */
  selectMode: boolean
  /** 已勾选 ID 集 */
  selected: string[]
  /** 长按进入选择模式（携带首条勾中） */
  enter: (id: string) => void
  /** 模式内切换勾选 */
  toggle: (id: string) => void
  /** 退出并清空 */
  exit: () => void
  /** 批量操作成功后退出 */
  reset: () => void
  /** 当前勾选数 */
  count: number
}

/** 列表多选模式 hook */
export function useListSelection(): ListSelection {
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  const enter = useCallback((id: string) => {
    setSelectMode(true)
    setSelected([id])
  }, [])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const exit = useCallback(() => {
    setSelectMode(false)
    setSelected([])
  }, [])

  const reset = useCallback(() => {
    setSelectMode(false)
    setSelected([])
  }, [])

  return { selectMode, selected, enter, toggle, exit, reset, count: selected.length }
}
