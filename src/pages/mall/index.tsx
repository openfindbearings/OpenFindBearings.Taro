// 积分商城页（v2.3.0 商城虚拟权益）：虚拟权益目录 + 我的兑换订单。
// 一期上架置顶卡（商户买曝光）；兑换入口在商品管理页"置顶"按钮（需选定具体商品），
// 本页承担"看得见价格与库存"的橱窗职责 + 订单凭据查询。
// 合规三纪律沿用：积分不可充值、不可提现、不可转让；虚拟权益非实物商品。
// RN 约束：仅 flex 布局、无 fixed/vh、Text 包裹、lineHeight 数值、无多值简写。
import { useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
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
import { getMallItems, getMallOrders, redeemGift, confirmReceipt, MALL_CATEGORY, MALL_ORDER_STATUS, type MallCatalog, type MallOrder, type MallItem } from '../../services/mall'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { vibrateSuccess } from '../../utils/haptics'
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

  // ===== v2.4.0 商家挂礼：收货信息弹层 + 托管兑换 =====
  const user = useAuthStore((s) => s.user)
  const [giftItem, setGiftItem] = useState<MallItem | null>(null)
  const [gName, setGName] = useState('')
  const [gPhone, setGPhone] = useState('')
  const [gAddr, setGAddr] = useState('')
  const [gBusy, setGBusy] = useState(false)

  /** 打开收货弹层：昵称/电话从登录资料预填省输入 */
  const openGift = (item: MallItem) => {
    setGiftItem(item)
    setGName(user?.nickname || user?.userName || '')
    setGPhone(user?.phoneNumber || '')
    setGAddr('')
  }

  /** 提交礼品兑换（托管扣分；失败原因直接 toast） */
  const doRedeemGift = async () => {
    if (!giftItem) return
    if (!gName.trim() || !gPhone.trim() || !gAddr.trim()) {
      Taro.showToast({ title: '收货人/电话/地址都要填哦', icon: 'none' })
      return
    }
    setGBusy(true)
    try {
      const r = await redeemGift(giftItem.id, gName.trim(), gPhone.trim(), gAddr.trim(), `gift-${giftItem.id}-${Date.now()}`)
      setGiftItem(null)
      void vibrateSuccess()
      Taro.showToast({ title: `兑换成功 -${r.pointsSpent} 积分`, icon: 'success' })
      const list = await getMallOrders(1, 10).catch(() => null)
      if (list) setOrders(list.items || [])
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '兑换失败', icon: 'none' })
    } finally {
      setGBusy(false)
    }
  }

  /** 确认收货：积分结算进商家金库（二次确认防误点） */
  const doConfirm = async (o: MallOrder) => {
    const ok = await showConfirmDialog({
      title: '确认收货',
      content: `确认已收到「${o.itemName}」？确认后 ${o.pointsSpent} 积分将结算给商家。若未收到请勿确认，可联系平台处理。`
    })
    if (!ok) return
    try {
      const r = await confirmReceipt(o.id)
      void vibrateSuccess()
      Taro.showToast({ title: r.settled > 0 ? '已确认收货' : '已确认收货', icon: 'success' })
      const list = await getMallOrders(1, 10).catch(() => null)
      if (list) setOrders(list.items || [])
      void getMallItems().then((c2) => setCatalog(c2 || null)).catch(() => { /* 静默 */ })
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '操作失败', icon: 'none' })
    }
  }

  /** 礼品物流态文案（与 API ShipStatus 对齐） */
  const shipText = (s?: number) => {
    if (s === 1) return '待商家发货'
    if (s === 2) return '已发货·待确认'
    if (s === 3) return '已收货'
    if (s === 4) return '已退款'
    return ''
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

          {/* v2.4.0 挂礼收货信息面板：RN 不支持 fixed，作为常规块内嵌于目录之上 */}
          {giftItem && (
            <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12, padding: 14 }}>
              <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>兑换：{giftItem.name}</Text>
              <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
                {giftItem.price} 积分 · 确认收货后才会结算给商家，收货前可联系平台退款
              </Text>
              <Input
                style={{ ...fs(15), backgroundColor: t.bgInput, borderRadius: 8, padding: 10, marginTop: 10, color: t.textPrimary }}
                placeholder='收货人姓名'
                placeholderTextColor={t.textTertiary}
                value={gName}
                onInput={(e: any) => setGName(e.detail.value)}
              />
              <Input
                style={{ ...fs(15), backgroundColor: t.bgInput, borderRadius: 8, padding: 10, marginTop: 8, color: t.textPrimary }}
                placeholder='联系电话'
                placeholderTextColor={t.textTertiary}
                type='number'
                value={gPhone}
                onInput={(e: any) => setGPhone(e.detail.value)}
              />
              <Input
                style={{ ...fs(15), backgroundColor: t.bgInput, borderRadius: 8, padding: 10, marginTop: 8, color: t.textPrimary }}
                placeholder='详细收货地址'
                placeholderTextColor={t.textTertiary}
                value={gAddr}
                onInput={(e: any) => setGAddr(e.detail.value)}
              />
              <View style={{ display: 'flex', flexDirection: 'row', marginTop: 12 }}>
                <View
                  style={{ flex: 1, borderRadius: 18, paddingTop: 9, paddingBottom: 9, alignItems: 'center', backgroundColor: t.bgInput }}
                  onClick={() => setGiftItem(null)}
                >
                  <Text style={{ ...fs(14), color: t.textSecondary }}>取消</Text>
                </View>
                <View
                  style={{ flex: 1, marginLeft: 10, borderRadius: 18, paddingTop: 9, paddingBottom: 9, alignItems: 'center', backgroundColor: gBusy ? t.textTertiary : t.primary }}
                  onClick={() => { if (!gBusy) doRedeemGift() }}
                >
                  <Text style={{ ...fs(14), color: '#FFFFFF', fontWeight: '600' }}>{gBusy ? '提交中…' : `花 ${giftItem.price} 积分兑换`}</Text>
                </View>
              </View>
            </View>
          )}

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
                  {/* v2.4.0 挂礼：展示来源商户（信任来自具体商家而非平台） */}
                  {item.ownerMerchantName ? (
                    <Text style={{ ...fs(11), color: t.primary, marginTop: 3 }}>来自 {item.ownerMerchantName}</Text>
                  ) : null}
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
                    else if (item.category === MALL_CATEGORY.GIFT) openGift(item)
                    else Taro.showToast({ title: '该权益即将上线', icon: 'none' })
                  }}
                >
                  <Text style={{ ...fs(12), color: item.soldOut ? t.textTertiary : '#FFFFFF', fontWeight: '600' }}>
                    {item.soldOut ? '兑完' : item.category === MALL_CATEGORY.PIN_CARD ? '去置顶' : item.category === MALL_CATEGORY.GIFT ? '兑换' : '即将上线'}
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
                  <Text style={{ ...fs(11), color: statusColor(o.status, t), marginTop: 3 }}>
                    {o.shipStatus ? `${statusText(o.status)}·${shipText(o.shipStatus)}` : statusText(o.status)}
                  </Text>
                  {/* v2.4.0 挂礼：已发货未收货提供确认收货入口 */}
                  {o.shipStatus === 2 && (
                    <View
                      style={{ backgroundColor: t.primary, borderRadius: 12, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, marginTop: 6 }}
                      onClick={() => doConfirm(o)}
                    >
                      <Text style={{ ...fs(11), color: '#FFFFFF', fontWeight: '600' }}>确认收货</Text>
                    </View>
                  )}
                  {o.shipStatus === 2 && o.shipTracking ? (
                    <Text style={{ ...fs(10), color: t.textTertiary, marginTop: 4 }}>单号 {o.shipTracking}</Text>
                  ) : null}
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
