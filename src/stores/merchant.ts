// 商户入驻状态 store（一人多商户的真实事实源，取代本地 storage merchant_approved 假 key）
// 登录后 fetchApplications 拉取 BFF /mobile/merchants/application，以 Active 商户判定已入驻
// 改动说明：B5/G1 修复——增加 currentMerchantId 当前商户上下文（持久化 + 同步 merchantContext 模块），
// 请求层从 merchantContext 读取并注入 X-Merchant-Id，实现多商户切换
import { create } from 'zustand'
import { getMerchantApplication, type MerchantApplication } from '../services/merchant'
import { setCurrentMerchantId } from '../services/merchantContext'
import { getItem, setItem, removeItem } from '../utils/storage'

const CURRENT_KEY = 'current_merchant_id'

/** 商户入驻状态与动作 */
interface MerchantState {
  /** 已生效（Active）商户列表，一人可多个 */
  merchants: MerchantApplication[]
  /** 是否已入驻（存在生效商户） */
  approved: boolean
  /** 当前选中商户ID（多商户操作上下文） */
  currentMerchantId: string | null
  loading: boolean
  /** 拉取入驻状态（需登录） */
  fetchApplications: () => Promise<void>
  /** 切换当前商户（商户切换器调用） */
  switchMerchant: (merchantId: string) => Promise<void>
  /** 当前商户对象（无则 null） */
  currentMerchant: () => MerchantApplication | null
  /** 退出登录时清空 */
  reset: () => void
}

export const useMerchantStore = create<MerchantState>((set, get) => ({
  merchants: [],
  approved: false,
  currentMerchantId: null,
  loading: false,

  fetchApplications: async () => {
    set({ loading: true })
    try {
      const list = await getMerchantApplication()
      const active = list?.filter((x) => x.status === 'Active') ?? []
      // 当前选中失效（不在列表/未选）时回退首个，并同步到请求上下文模块
      const stored = await getItem(CURRENT_KEY)
      const valid = active.some((m) => m.merchantId === stored) ? stored : null
      const current = valid ?? active[0]?.merchantId ?? null
      setCurrentMerchantId(current)
      if (current) await setItem(CURRENT_KEY, current)
      // 改动说明 G1：merchant_approved/merchant_name/merchant_logo 降级为"真实状态的派生缓存"，
      // 仅供 CustomTabBar/appShared 冷启动首帧读取；每次拉取/切换后覆盖，杜绝假 key 漂移
      const first = active.find((m) => m.merchantId === current) ?? active[0]
      await setItem('merchant_approved', active.length > 0 ? 'true' : 'false')
      if (first) {
        await setItem('merchant_name', first.merchantName)
        await setItem('merchant_logo', first.logoUrl || '')
      }
      set({ merchants: active, approved: active.length > 0, currentMerchantId: current, loading: false })
    } catch {
      // 拉取失败保留现状（未登录/网络异常不阻塞页面）
      set({ loading: false })
    }
  },

  switchMerchant: async (merchantId: string) => {
    const target = get().merchants.find((m) => m.merchantId === merchantId)
    if (!target) return
    setCurrentMerchantId(merchantId)
    await setItem(CURRENT_KEY, merchantId)
    // 改动说明：切换当前商户时同步刷新派生缓存，供 TabBar 冷启动首帧与外部读取一致
    await setItem('merchant_name', target.merchantName)
    await setItem('merchant_logo', target.logoUrl || '')
    set({ currentMerchantId: merchantId })
  },

  currentMerchant: () => {
    const { merchants, currentMerchantId } = get()
    return merchants.find((m) => m.merchantId === currentMerchantId) ?? merchants[0] ?? null
  },

  reset: () => {
    // 退出登录清商户上下文（storage 持久选择一并清除，防止换账号串商户）
    setCurrentMerchantId(null)
    void removeItem(CURRENT_KEY)
    // 改动说明 G1：同步清派生缓存，避免下一个账号首帧读到上一账号的入驻状态
    void removeItem('merchant_approved')
    void removeItem('merchant_name')
    set({ merchants: [], approved: false, currentMerchantId: null, loading: false })
  }
}))
