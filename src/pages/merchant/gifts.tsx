// 商家金库与挂礼页（v2.4.0 商家经济）：金库余额/流水 + 挂礼申请与管理 + 礼品订单发货。
// 合规三纪律：金库积分只平台内流通（置顶卡等权益），不可提现/转让/折现；
// 挂礼走"商家申请→平台定档→买家托管兑换→确认收货结算"，杜绝定向转移。
// RN 约束：仅 flex 布局、无 fixed、Text 包裹、Input 显式字号、lineHeight 数值。
import { useState } from 'react'
import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useAuthStore } from '../../stores/auth'
import LoginGuide from '../../components/LoginGuide'
import { pickImagePath } from '../../services/pickImage'
import { usableImage } from '../../services/config'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { vibrateSuccess } from '../../utils/haptics'
import {
  getTreasury, getTreasuryTransactions, getMyGifts, createGift, offShelfGift,
  uploadGiftImage, getGiftOrders, shipGiftOrder, treasurySceneText,
  GIFT_AUDIT, SHIP_STATUS,
  type TreasuryAccount, type TreasuryTx, type MyGift, type GiftOrder
} from '../../services/gifts'
import type { Paged } from '../../services/bearing'
import { formatTime } from '../../utils/format'

definePageConfig({ disableScroll: true })

/** 礼品审核态徽章（中文+色） */
function auditBadge(g: MyGift, t: any): { text: string; color: string } {
  if (g.auditState === GIFT_AUDIT.PENDING) return { text: '待审核', color: '#F59E0B' }
  if (g.auditState === GIFT_AUDIT.REJECTED) return { text: '已驳回', color: '#EF4444' }
  if (g.enabled) return { text: `在售 ${g.pointPrice}分`, color: '#16A34A' }
  return { text: '已下架', color: t.textTertiary }
}

/** 商家金库与挂礼页 */
export default function MerchantGiftsPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  const [treasury, setTreasury] = useState<TreasuryAccount | null>(null)
  const [txs, setTxs] = useState<TreasuryTx[]>([])
  const [gifts, setGifts] = useState<MyGift[]>([])
  const [orders, setOrders] = useState<GiftOrder[]>([])
  const [orderFilter, setOrderFilter] = useState<number>(SHIP_STATUS.PENDING)

  // 申请挂礼表单（内嵌展开，RN 无 fixed 弹层）
  const [applyOpen, setApplyOpen] = useState(false)
  const [aName, setAName] = useState('')
  const [aDesc, setADesc] = useState('')
  const [aStock, setAStock] = useState('5')
  const [aImage, setAImage] = useState('')
  const [aBusy, setABusy] = useState(false)

  // 发货输入（一次只操作一单）
  const [shipFor, setShipFor] = useState<string | null>(null)
  const [tracking, setTracking] = useState('')

  const reload = () => {
    void getTreasury().then((r) => setTreasury(r || null)).catch(() => { /* 静默 */ })
    void getTreasuryTransactions(1, 8).then((r) => setTxs(r?.items || [])).catch(() => { /* 静默 */ })
    void getMyGifts().then((r) => setGifts(r || [])).catch(() => { /* 静默 */ })
    void getGiftOrders(orderFilter, 1, 20).then((r) => setOrders((r as Paged<GiftOrder> | null)?.items || [])).catch(() => { /* 静默 */ })
  }
  useDidShow(() => { if (isLoggedIn) reload() })

  /** 选礼品图（相册/拍照统一走平台适配层） */
  const onPickImage = async () => {
    const path = await pickImagePath()
    if (!path) return
    Taro.showLoading({ title: '上传中' })
    try {
      const url = await uploadGiftImage(path)
      setAImage(url)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '图片上传失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  /** 提交挂礼申请（进待审，平台定档后上架） */
  const doCreate = async () => {
    const stock = parseInt(aStock, 10)
    if (!aName.trim() || !aDesc.trim()) {
      Taro.showToast({ title: '名称和描述必填', icon: 'none' })
      return
    }
    if (!stock || stock <= 0 || stock > 999) {
      Taro.showToast({ title: '数量须在 1-999', icon: 'none' })
      return
    }
    setABusy(true)
    try {
      await createGift(aName.trim(), aDesc.trim(), aImage || null, stock)
      void vibrateSuccess()
      setApplyOpen(false)
      setAName(''); setADesc(''); setAStock('5'); setAImage('')
      Taro.showToast({ title: '已提交，平台审核定档后上架', icon: 'success' })
      void getMyGifts().then((r) => setGifts(r || [])).catch(() => { /* 静默 */ })
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '申请失败', icon: 'none' })
    } finally {
      setABusy(false)
    }
  }

  /** 下架礼品（存量订单不受影响） */
  const doOffShelf = async (g: MyGift) => {
    const ok = await showConfirmDialog({ title: '下架礼品', content: `下架「${g.name}」？已兑换的订单不受影响，仅停止新的兑换。` })
    if (!ok) return
    try {
      await offShelfGift(g.id)
      Taro.showToast({ title: '已下架', icon: 'success' })
      void getMyGifts().then((r) => setGifts(r || [])).catch(() => { /* 静默 */ })
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '下架失败', icon: 'none' })
    }
  }

  /** 发货（单号必填；提交后 7 天买家未确认将自动结算） */
  const doShip = async (o: GiftOrder) => {
    if (!tracking.trim()) {
      Taro.showToast({ title: '请填写物流单号', icon: 'none' })
      return
    }
    try {
      await shipGiftOrder(o.id, tracking.trim())
      void vibrateSuccess()
      setShipFor(null)
      setTracking('')
      Taro.showToast({ title: '已发货', icon: 'success' })
      void getGiftOrders(orderFilter, 1, 20).then((r) => setOrders((r as Paged<GiftOrder> | null)?.items || [])).catch(() => { /* 静默 */ })
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '发货失败', icon: 'none' })
    }
  }

  const inputStyle: any = { backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 9, paddingBottom: 9, marginTop: 8, color: t.textPrimary }

  return (
    <PageLayout nav={<NavBar title='金库挂礼' showBack />}>
      {!isLoggedIn && <LoginGuide icon='gift' text='登录后管理商家金库与挂礼' />}
      {isLoggedIn && (
        <ScrollView style={{ flex: 1 }}>
          {/* 金库余额（商家仓库） */}
          <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ ...fs(12), color: t.textTertiary }}>商家金库</Text>
              {/* v2.5.0 商家经济：等级徽章（入驻/认证/活跃供给/金牌——buff 与信任的可视化） */}
              {treasury?.gradeDisplay ? (
                <Text style={{ ...fs(10), color: '#8B5CF6', backgroundColor: t.primaryLight, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, marginLeft: 8 }}>{treasury.gradeDisplay}</Text>
              ) : null}
            </View>
            <Text style={{ ...fs(28), color: t.primary, fontWeight: '700', marginTop: 2 }}>
              {treasury?.balance ?? 0}
              {/* 改动说明（v2.10.0 商家金）：金库货币定名"商家金"，与个人积分彻底区分 */}
              <Text style={{ ...fs(13), color: t.textTertiary }}> 商家金</Text>
            </Text>
            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 4 }}>
              累计入账 {treasury?.totalEarned ?? 0} · 累计支出 {treasury?.totalSpent ?? 0}
            </Text>
            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 6 }}>
              成员赚分上供与礼品结算入此金库，可用于商品置顶等经营支出，不可提现或转让
            </Text>
          </View>

          {/* 金库流水 */}
          {txs.length > 0 && (
            <View style={{ marginLeft: 12, marginRight: 12, marginTop: 12 }}>
              <Text style={{ ...fs(13), color: t.textSecondary }}>金库流水</Text>
              {txs.map((tx, i) => (
                <View key={i} style={{ backgroundColor: t.bgCard, borderRadius: 10, padding: 12, marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...fs(13), color: t.textPrimary }}>{treasurySceneText(tx.scene)}</Text>
                    <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 3 }}>{tx.remark || ''} {formatTime(tx.createdAt)}</Text>
                  </View>
                  <Text style={{ ...fs(15), color: tx.direction === 1 ? '#16A34A' : '#EF4444', fontWeight: '600' }}>
                    {tx.direction === 1 ? '+' : '-'}{tx.amount}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* 挂礼管理 */}
          <View style={{ marginLeft: 12, marginRight: 12, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ ...fs(13), color: t.textSecondary, flex: 1 }}>我的挂礼</Text>
              <View
                style={{ backgroundColor: applyOpen ? t.bgInput : t.primary, borderRadius: 14, paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5 }}
                onClick={() => setApplyOpen(!applyOpen)}
              >
                <Text style={{ ...fs(12), color: applyOpen ? t.textSecondary : '#FFFFFF', fontWeight: '600' }}>{applyOpen ? '收起' : '申请挂礼'}</Text>
              </View>
            </View>

            {applyOpen && (
              <View style={{ backgroundColor: t.bgCard, borderRadius: 12, padding: 12, marginTop: 10 }}>
                <Input style={{ ...inputStyle, fontSize: 15 }} placeholder='礼品名称（如：轴承保养工具套装）' placeholderTextColor={t.textTertiary} value={aName} onInput={(e: any) => setAName(e.detail.value)} />
                <Input style={{ ...inputStyle, fontSize: 15 }} placeholder='礼品描述（成色/规格/发货时效）' placeholderTextColor={t.textTertiary} value={aDesc} onInput={(e: any) => setADesc(e.detail.value)} />
                <Input style={{ ...inputStyle, fontSize: 15 }} placeholder='数量（1-999）' placeholderTextColor={t.textTertiary} type='number' value={aStock} onInput={(e: any) => setAStock(e.detail.value)} />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                  <View style={{ backgroundColor: t.bgInput, borderRadius: 8, padding: 10 }} onClick={onPickImage}>
                    <Text style={{ ...fs(13), color: t.primary }}>{aImage ? '重选图片' : '选礼品图（可选）'}</Text>
                  </View>
                  {aImage ? (
                    <Image src={usableImage(aImage)} style={{ width: 56, height: 56, borderRadius: 8, marginLeft: 10, backgroundColor: '#FFFFFF' }} mode='aspectFit' />
                  ) : null}
                </View>
                <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 8 }}>
                  提交后由平台审核并定积分价（商家不自行定价，防止积分定向转移），通过后自动上架
                </Text>
                <View
                  style={{ backgroundColor: aBusy ? t.textTertiary : t.primary, borderRadius: 18, paddingTop: 10, paddingBottom: 10, alignItems: 'center', marginTop: 10 }}
                  onClick={() => { if (!aBusy) doCreate() }}
                >
                  <Text style={{ ...fs(14), color: '#FFFFFF', fontWeight: '600' }}>{aBusy ? '提交中…' : '提交审核'}</Text>
                </View>
              </View>
            )}

            {gifts.map((g) => {
              const badge = auditBadge(g, t)
              return (
                <View key={g.id} style={{ backgroundColor: t.bgCard, borderRadius: 12, padding: 12, marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ ...fs(14), color: t.textPrimary, flex: 1, fontWeight: '600' }}>{g.name}</Text>
                    <Text style={{ ...fs(11), color: '#FFFFFF', backgroundColor: badge.color, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>{badge.text}</Text>
                  </View>
                  <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>{g.description}</Text>
                  <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 4 }}>库存 {g.stock < 0 ? 999 : g.stock - g.soldCount}/{g.stock} · 已兑 {g.soldCount}</Text>
                  {g.auditState === GIFT_AUDIT.REJECTED && g.auditRemark ? (
                    <Text style={{ ...fs(11), color: '#EF4444', marginTop: 4 }}>驳回原因：{g.auditRemark}</Text>
                  ) : null}
                  {g.auditState === GIFT_AUDIT.APPROVED && g.enabled ? (
                    <View style={{ alignSelf: 'flex-end', marginTop: 8 }} onClick={() => doOffShelf(g)}>
                      <Text style={{ ...fs(12), color: t.textSecondary, textDecoration: 'underline' }}>下架</Text>
                    </View>
                  ) : null}
                </View>
              )
            })}
            {gifts.length === 0 && !applyOpen && (
              <View style={{ alignItems: 'center', paddingTop: 18, paddingBottom: 18 }}>
                <Text style={{ ...fs(12), color: t.textTertiary }}>还没有挂礼，点右上"申请挂礼"把库存好货变成积分收入</Text>
              </View>
            )}
          </View>

          {/* 礼品订单（发货义务） */}
          <View style={{ marginLeft: 12, marginRight: 12, marginTop: 16 }}>
            <Text style={{ ...fs(13), color: t.textSecondary }}>礼品订单</Text>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              {[SHIP_STATUS.PENDING, SHIP_STATUS.SHIPPED].map((s) => (
                <View
                  key={s}
                  style={{ borderRadius: 14, paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, marginRight: 8, backgroundColor: orderFilter === s ? t.primary : t.bgInput }}
                  onClick={() => { setOrderFilter(s); void getGiftOrders(s, 1, 20).then((r) => setOrders((r as Paged<GiftOrder> | null)?.items || [])).catch(() => { /* 静默 */ }) }}
                >
                  <Text style={{ ...fs(12), color: orderFilter === s ? '#FFFFFF' : t.textSecondary }}>{s === SHIP_STATUS.PENDING ? '待发货' : '已发货'}</Text>
                </View>
              ))}
            </View>

            {orders.map((o) => (
              <View key={o.id} style={{ backgroundColor: t.bgCard, borderRadius: 12, padding: 12, marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ ...fs(14), color: t.textPrimary, flex: 1, fontWeight: '600' }}>{o.itemName}</Text>
                  <Text style={{ ...fs(13), color: t.primary, fontWeight: '700' }}>+{o.pointsSpent}</Text>
                </View>
                <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 6 }}>
                  {o.receiverName} {o.receiverPhone}
                </Text>
                <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 2 }}>{o.receiverAddress}</Text>
                <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 4 }}>{formatTime(o.createdAt)} 兑换</Text>
                {o.shipStatus === SHIP_STATUS.SHIPPED && (
                  <Text style={{ ...fs(11), color: '#16A34A', marginTop: 4 }}>已发货 · 单号 {o.shipTracking}（发货满 7 天自动确认结算）</Text>
                )}
                {o.shipStatus === SHIP_STATUS.PENDING && (
                  shipFor === o.id ? (
                    <View style={{ marginTop: 8 }}>
                      <Input style={{ ...inputStyle, fontSize: 15 }} placeholder='物流公司 + 单号' placeholderTextColor={t.textTertiary} value={tracking} onInput={(e: any) => setTracking(e.detail.value)} />
                      <View style={{ flexDirection: 'row', marginTop: 8 }}>
                        <View style={{ flex: 1, borderRadius: 16, paddingTop: 8, paddingBottom: 8, alignItems: 'center', backgroundColor: t.bgInput }} onClick={() => { setShipFor(null); setTracking('') }}>
                          <Text style={{ ...fs(13), color: t.textSecondary }}>取消</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 8, borderRadius: 16, paddingTop: 8, paddingBottom: 8, alignItems: 'center', backgroundColor: t.primary }} onClick={() => doShip(o)}>
                          <Text style={{ ...fs(13), color: '#FFFFFF', fontWeight: '600' }}>确认发货</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={{ alignSelf: 'flex-end', marginTop: 8, backgroundColor: t.primary, borderRadius: 14, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6 }} onClick={() => { setShipFor(o.id); setTracking('') }}>
                      <Text style={{ ...fs(12), color: '#FFFFFF', fontWeight: '600' }}>填写物流发货</Text>
                    </View>
                  )
                )}
              </View>
            ))}
            {orders.length === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 16 }}>
                <Text style={{ ...fs(12), color: t.textTertiary }}>{orderFilter === SHIP_STATUS.PENDING ? '没有待发货订单' : '没有已发货订单'}</Text>
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </PageLayout>
  )
}
