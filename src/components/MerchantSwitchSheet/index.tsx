// 商户切换 bottom sheet（H5/小程序端）：命令式 showMerchantSwitchSheet()，
//   本文件用 Taro.showActionSheet 承载（原生列表 + 系统样式），与 RN 端 index.rn.tsx
//   同名导出接口保持一致；RN 端由 Metro 解析命中 index.rn.tsx 走自绘 bottom sheet
//   （每行 logo + 角色 + 当前对勾），跨端语义一致。
import Taro from '@tarojs/taro'

/** 切换器商户条目 */
export interface MerchantSwitchItem {
  id: string
  name: string
  logoUrl?: string | null
  /** MerchantAdmin / MerchantStaff，用于行内副标题 */
  role?: string
}

/** 切换动作语义：switch 选中他人 / add 申请新商户 / none 取消或选当前项 */
export type MerchantSwitchAction = 'switch' | 'add' | 'none'

/** 切换结果 */
export interface MerchantSwitchResult {
  action: MerchantSwitchAction
  merchantId?: string
}

/** 附加行文案：申请入驻其他商户 */
const ADD_LABEL = '＋ 申请入驻其他商户'

/**
 * 弹出商户切换 sheet。resolve 用户选择：
 * - 选中非当前商户 → switch + merchantId
 * - 选中当前商户 → none（无切换）
 * - 选"申请入驻其他商户" → add
 * - 取消/关闭 → none
 */
export function showMerchantSwitchSheet(
  items: MerchantSwitchItem[],
  currentId: string | null
): Promise<MerchantSwitchResult> {
  if (items.length === 0) return Promise.resolve({ action: 'none' })
  const labels = items.map((m) => (m.id === currentId ? '✓ ' : '') + m.name)
  labels.push(ADD_LABEL)
  return Taro.showActionSheet({ itemList: labels })
    .then((res) => {
      const idx = res.tapIndex
      if (idx === labels.length - 1) return { action: 'add' as const }
      const picked = items[idx]
      if (!picked || picked.id === currentId) return { action: 'none' as const }
      return { action: 'switch' as const, merchantId: picked.id }
    })
    .catch(() => ({ action: 'none' as const }))
}

/** 非 RN 端组件占位：由命令式 showMerchantSwitchSheet 承载，无需挂载 */
export default function MerchantSwitchSheet() {
  return null
}
