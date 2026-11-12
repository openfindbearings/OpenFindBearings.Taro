// 商家页统一跳转入口
// 改动说明：店主从搜索结果、商城、在售商家行或关注/浏览历史点到自己名下的商户时，
//   原先会落到公开详情页，还要再点一次「本店 · 管理店铺」才进后台；统一在此判断意图，
//   点击自己商户直接进经营工作台（多商户场景先切换当前商户上下文），其他商户仍进公开主页。
import Taro from '@tarojs/taro'
import { useMerchantStore } from '../stores/merchant'

/** 打开方式：auto=按是否自己商户判断，detail=强制公开主页，workbench=强制经营工作台 */
export type MerchantOpenMode = 'auto' | 'detail' | 'workbench'

/**
 * 打开商家页面
 * @param merchantId 目标商户 id
 * @param mode 打开方式，默认 auto
 */
export async function openMerchant(merchantId: string, mode: MerchantOpenMode = 'auto'): Promise<void> {
  if (!merchantId) return

  const state = useMerchantStore.getState()
  // 自己商户判定：优先用 Active 列表；冷启动尚未拉完时退回全量申请里状态为 Active 的行
  const isOwn = mode === 'workbench'
    || (mode === 'auto' && (
      state.merchants.some((m) => m.merchantId === merchantId)
      || state.applications.some((m) => m.merchantId === merchantId && m.status === 'Active')
    ))

  if (!isOwn) {
    Taro.navigateTo({ url: `/pages/merchant/merchantDetail?id=${merchantId}` })
    return
  }

  // 多商户：先切换当前商户上下文，保证工作台展示的就是被点进来的这家（切换失败不阻塞跳转）
  if (state.currentMerchantId !== merchantId) {
    await state.switchMerchant(merchantId).catch(() => {})
  }
  Taro.navigateTo({ url: '/pages/merchant/home' })
}
