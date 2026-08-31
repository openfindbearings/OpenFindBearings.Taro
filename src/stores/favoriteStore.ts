import { create } from 'zustand'

/** 收藏/关注状态 */
interface FavoriteState {
  /** 已收藏的轴承 ID 集合 */
  favoriteBearingIds: Set<string>
  /** 已关注的商家 ID 集合 */
  followedMerchantIds: Set<string>
  /** 设置收藏列表 */
  setFavoriteBearings: (ids: string[]) => void
  /** 切换收藏 */
  toggleFavoriteBearing: (id: string) => void
  /** 设置关注列表 */
  setFollowedMerchants: (ids: string[]) => void
  /** 切换关注 */
  toggleFollowedMerchant: (id: string) => void
}

export const useFavoriteStore = create<FavoriteState>((set) => ({
  favoriteBearingIds: new Set(),
  followedMerchantIds: new Set(),

  setFavoriteBearings: (ids) => set({ favoriteBearingIds: new Set(ids) }),

  toggleFavoriteBearing: (id) =>
    set((state) => {
      const next = new Set(state.favoriteBearingIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { favoriteBearingIds: next }
    }),

  setFollowedMerchants: (ids) => set({ followedMerchantIds: new Set(ids) }),

  toggleFollowedMerchant: (id) =>
    set((state) => {
      const next = new Set(state.followedMerchantIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { followedMerchantIds: next }
    }),
}))
