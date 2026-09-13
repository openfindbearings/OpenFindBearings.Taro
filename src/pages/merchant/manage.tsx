// 商户商品管理页
// 展示当前商户在售商品列表，支持上架/下架；Excel 批量导入仅商户管理员可见
// 导入数据标记为商户自管（Manual），不会被爬虫数据覆盖
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useMerchantStore } from '../../stores/merchant'
import {
  getMyBearings, putOnShelf, takeOffShelf, importInventory,
  type MerchantBearingItem
} from '../../services/merchant'

const PAGE_SIZE = 20

export default function MerchantManagePage() {
  const t = useTheme()
  const fs = useFs()
  // 改动说明 B5：按当前选中商户判定角色（原 merchants[0] 写死首个，多商户切换失效）
  const cur = useMerchantStore((s) => s.merchants.find((m) => m.merchantId === s.currentMerchantId) ?? s.merchants[0] ?? null)
  const isAdmin = cur?.role === 'MerchantAdmin'

  const [items, setItems] = useState<MerchantBearingItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const load = (p: number, append: boolean) => {
    if (loading) return
    setLoading(true)
    getMyBearings({ page: p, pageSize: PAGE_SIZE })
      .then((r) => {
        setItems((prev) => (append ? [...prev, ...(r?.items ?? [])] : r?.items ?? []))
        setTotal(r?.totalCount ?? 0)
        setPage(p)
      })
      .catch(() => { /* 拉取失败 */ })
      .finally(() => setLoading(false))
  }

  useDidShow(() => {
    load(1, false)
  })

  const onToggleShelf = (item: MerchantBearingItem) => {
    setBusyId(item.bearingId)
    const action = item.isOnSale ? takeOffShelf : putOnShelf
    action(item.bearingId)
      .then(() => {
        Taro.showToast({ title: '操作成功', icon: 'success' })
        load(page, false)
      })
      .catch((e: any) => Taro.showToast({ title: e?.message || '操作失败', icon: 'none' }))
      .finally(() => setBusyId(null))
  }

  const onImport = () => {
    if (importing) return
    // 文件选择：微信小程序用 chooseMessageFile；其余平台提示走小程序端
    // @ts-ignore 仅小程序存在
    if (!Taro.chooseMessageFile) {
      Taro.showToast({ title: '请在微信小程序端导入 Excel', icon: 'none' })
      return
    }
    // @ts-ignore
    Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['xlsx', 'xls'] })
      .then(async (res: any) => {
        const file = res.tempFiles?.[0]
        if (!file) return
        setImporting(true)
        try {
          const r = await importInventory(file.path)
          Taro.showToast({ title: r?.message || '导入完成', icon: 'none', duration: 2500 })
          load(1, false)
        } catch {
          Taro.showToast({ title: '导入失败', icon: 'none' })
        } finally { setImporting(false) }
      })
      .catch(() => { /* 用户取消 */ })
  }

  return (
    <PageLayout nav={<NavBar title="商品管理" showBack />}>
      {/* 顶部操作：Excel 导入（仅管理员） */}
      {isAdmin && (
        <View style={{ padding: 14 }}>
          <View
            style={{ backgroundColor: importing ? t.textTertiary : t.primary, borderRadius: 24, paddingTop: 11, paddingBottom: 11, alignItems: 'center' }}
            onClick={importing ? undefined : onImport}
          >
            <Text style={{ ...fs(15), color: t.textOnPrimary }}>{importing ? '导入中…' : 'Excel 批量导入在售商品'}</Text>
          </View>
          <Text style={{ ...fs(11), color: t.textTertiary, textAlign: 'center', marginTop: 6 }}>
            模板列：轴承型号 / 品牌 / 价格 / 库存数量 / 最小起订量；导入数据为商户自管，爬虫不覆盖
          </Text>
        </View>
      )}

      <View style={{ paddingLeft: 14, paddingRight: 14 }}>
        {items.length === 0 && !loading ? (
          <View style={{ alignItems: 'center', paddingTop: 50 }}>
            <Icon name="box" size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>暂无在售商品</Text>
          </View>
        ) : (
          <View style={{ borderRadius: 12, overflow: 'hidden' }}>
            {items.map((item) => (
              <View
                key={item.bearingId}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgCard, padding: 12, borderBottomWidth: 1, borderBottomColor: t.border, opacity: busyId === item.bearingId ? 0.5 : 1 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ ...fs(15), color: t.textPrimary }}>{item.bearingPartNumber}</Text>
                  <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
                    {[item.brandName, item.bearingTypeName, item.price].filter(Boolean).join(' · ') || '暂无规格'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 52, height: 20, borderRadius: 10, backgroundColor: item.isOnSale ? '#16A34A' : t.textTertiary, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <Text style={{ ...fs(11), color: '#fff' }}>{item.isOnSale ? '在售' : '下架'}</Text>
                  </View>
                  <View
                    style={{ backgroundColor: t.bgInput, borderRadius: 6, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}
                    onClick={() => onToggleShelf(item)}
                  >
                    <Text style={{ ...fs(12), color: t.primary }}>{item.isOnSale ? '下架' : '上架'}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {items.length < total && (
        <View
          style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 20 }}
          onClick={() => load(page + 1, true)}
        >
          <Text style={{ ...fs(14), color: t.textSecondary }}>{loading ? '加载中…' : '加载更多'}</Text>
        </View>
      )}
    </PageLayout>
  )
}
