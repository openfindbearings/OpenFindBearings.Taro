// 积分商城页（v2.3.0 商城虚拟权益）：虚拟权益目录 + 我的兑换订单。
// 一期上架置顶卡（商户买曝光）；兑换入口在商品管理页"置顶"按钮（需选定具体商品），
// 本页承担"看得见价格与库存"的橱窗职责 + 订单凭据查询。
// 合规三纪律沿用：积分不可充值、不可提现、不可转让；虚拟权益非实物商品。
// RN 约束：仅 flex 布局、无 fixed/vh、Text 包裹、lineHeight 数值、无多值简写。
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
import LoginGuide from '../../components/LoginGuide'
import { useAuthStore } from '../../stores/auth'
import { useMerchantStore } from '../../stores/merchant'
import { getMallItems, getMallOrders, MALL_CATEGORY, MALL_ORDER_STATUS, type MallCatalog, type MallOrder } from '../../services/mall'
import { formatTime } from '../../utils/format'

// 编译期配置：禁用外层 ScrollView，滚动由页内 ScrollView 统一提供
definePageConfig({ disableScroll: true })

/** 订单状态中文名（与 API MallOrderStatus 对齐） */
function statusText(s: number): string {
  switch (s) {
    case MALL_ORDER_STATUS.FULFILLED: return '已生效'
    case MALL_ORDER_STATUS.FAILED: return '失败已退分'
    case MALL_ORDER_STATUS.REFUNDED: return '已退款'
    default: return '处理中'
  }
}

/** 订单状态色（已生效绿、失败/退款橙、处理中灰） */
function statusColor(s: number, t: any): string {
  if (s === MALL_ORDER_STATUS.FULFILLED) return '#16A34A'
  if (s === MALL_ORDER_STATUS.FAILED || s === MALL_ORDER_STATUS.REFUNDED) return '#F59E0B'
  return t.textTertiary
}

/** 积分商城页：虚拟权益橱窗 + 我的订单 */
export default function MallPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [catalog, setCatalog] = useState<MallCatalog | null>(null)
  const [orders, setOrders] = useState<MallOrder[]>([])

  // 进页/回页刷新（兑换后返回本页余额与订单需同步）
  useDidShow(() => {
    if (!isLoggedIn) { setCatalog(null); setOrders([]); return }
    void getMallItems().then((r) => setCatalog(r || null)).catch(() => { /* 静默 */ })
    void getMallOrders(1, 10).then((r) => setOrders(r?.items || [])).catch(() => { /* 静默 */ })
  })

  /** 置顶卡兑换入口：跳商品管理页选具体商品（无在职商户则引导入驻） */
  const goPin = () => {
    const m = useMerchantStore.getState().currentMerchant()
    if (!m) {
      Taro.showToast({ title: '入驻商户后才能买置顶', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: '/pages/merchant/manage' })
  }

  return (
    <PageLayout nav={<NavBar title='积分商城' />} tabbar={<CustomTabBar />}>
      {!isLoggedIn && <LoginGuide icon='gift' text='登录后即可用积分兑换权益' />}
      {isLoggedIn && (
        <ScrollView style={{ flex: 1 }}>
          {/* 余额条：兑换能力前置可见，不足直接引导去赚 */}
          <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...fs(24), color: t.primary, fontWeight: '700' }}>{catalog?.balance ?? 0}</Text>
              <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 2 }}>我的积分</Text>
            </View>
            <View
              style={{ backgroundColor: t.primary, borderRadius: 16, paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7 }}
              onClick={() => Taro.navigateTo({ url: '/pages/my/tasks' })}
            >
              <Text style={{ ...fs(13), color: '#FFFFFF', fontWeight: '600' }}>去赚积分</Text>
            </View>
          </View>

          {/* 权益目录 */}
          <View style={{ marginLeft: 12, marginRight: 12, marginTop: 12 }}>
            <Text style={{ ...fs(13), color: t.textSecondary }}>可兑换权益</Text>
            {(catalog?.items || []).map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: t.bgCard, borderRadius: 12, padding: 12, marginTop: 10,
                  display: 'flex', flexDirection: 'row', alignItems: 'center',
                  opacity: item.soldOut ? 0.6 : 1
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={item.icon || 'gift'} size={22} color={t.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>{item.name}</Text>
                    {item.flashing && (
                      <View style={{ backgroundColor: '#EF4444', borderRadius: 4, paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1, marginLeft: 6 }}>
                        <Text style={{ ...fs(10), color: '#FFFFFF' }}>闪购</Text>
                      </View>
                    )}
                    {item.soldOut && (
                      <View style={{ backgroundColor: t.textTertiary, borderRadius: 4, paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1, marginLeft: 6 }}>
                        <Text style={{ ...fs(10), color: '#FFFFFF' }}>已兑完</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>{item.description}</Text>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Text style={{ ...fs(15), color: t.primary, fontWeight: '700' }}>{item.price}</Text>
                    <Text style={{ ...fs(11), color: t.textTertiary, marginLeft: 4 }}>积分</Text>
                    {item.flashing && item.originalPrice != null && (
                      <Text style={{ ...fs(11), color: t.textTertiary, marginLeft: 6, textDecoration: 'line-through' }}>原价 {item.originalPrice}</Text>
                    )}
                    {item.stock > 0 && (
                      <Text style={{ ...fs(11), color: t.textTertiary, marginLeft: 8 }}>限量 {item.stock} 份·已兑 {item.soldCount}</Text>
                    )}
                  </View>
                </View>
                <View
                  style={{
                    backgroundColor: item.soldOut ? t.bgInput : t.primary,
                    borderRadius: 16, paddingLeft: 12, paddingRight: 12, paddingTop: 7, paddingBottom: 7
                  }}
                  onClick={() => {
                    if (item.soldOut) return
                    if (item.category === MALL_CATEGORY.PIN_CARD) goPin()
                    else Taro.showToast({ title: '该权益即将上线', icon: 'none' })
                  }}
                >
                  <Text style={{ ...fs(12), color: item.soldOut ? t.textTertiary : '#FFFFFF', fontWeight: '600' }}>
                    {item.soldOut ? '兑完' : item.category === MALL_CATEGORY.PIN_CARD ? '去置顶' : '兑换'}
                  </Text>
                </View>
              </View>
            ))}
            {(catalog?.items || []).length === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 24 }}>
                <Text style={{ ...fs(13), color: t.textTertiary }}>暂无上架权益</Text>
              </View>
            )}
          </View>

          {/* 我的订单：兑换凭据（失败/退款可见，减少客服问询） */}
          <View style={{ marginLeft: 12, marginRight: 12, marginTop: 16 }}>
            <Text style={{ ...fs(13), color: t.textSecondary }}>我的兑换</Text>
            {orders.map((o) => (
              <View key={o.id} style={{ backgroundColor: t.bgCard, borderRadius: 10, padding: 12, marginTop: 8, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...fs(14), color: t.textPrimary }}>{o.itemName}</Text>
                  <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 3 }}>{formatTime(o.createdAt)}</Text>
                  {o.remark ? <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>{o.remark}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ ...fs(14), color: t.textPrimary }}>-{o.pointsSpent}</Text>
                  <Text style={{ ...fs(11), color: statusColor(o.status, t), marginTop: 3 }}>{statusText(o.status)}</Text>
                </View>
              </View>
            ))}
            {orders.length === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 16 }}>
                <Text style={{ ...fs(12), color: t.textTertiary }}>还没有兑换记录</Text>
              </View>
            )}
          </View>

          <Text style={{ ...fs(11), color: t.textTertiary, textAlign: 'center', marginTop: 16, marginBottom: 8 }}>
            积分不可充值、不可提现、不可转让，仅可在平台内兑换权益
          </Text>
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </PageLayout>
  )
}
