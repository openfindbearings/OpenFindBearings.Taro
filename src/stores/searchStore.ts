import { create } from 'zustand'

/** 搜索状态 */
interface SearchState {
  /** 当前搜索关键词 */
  keyword: string
  /** 搜索类型：bearing | merchant */
  searchType: 'bearing' | 'merchant'
  /** 设置关键词 */
  setKeyword: (keyword: string) => void
  /** 设置搜索类型 */
  setSearchType: (type: 'bearing' | 'merchant') => void
  /** 清空 */
  clear: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  keyword: '',
  searchType: 'bearing',
  setKeyword: (keyword) => set({ keyword }),
  setSearchType: (searchType) => set({ searchType }),
  clear: () => set({ keyword: '', searchType: 'bearing' }),
}))
