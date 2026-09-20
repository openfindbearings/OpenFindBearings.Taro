// 入驻/商家页（Tab 根页）——v1.8.0 现代化改版：顶部对齐的"商户卡片列表"
// 改动说明：
//   1. 原占位居中式布局对"一人多商户 + 申请状态可见"承载不足且视觉过时，改为商户卡片流；
//   2. 每商户一行带状态徽标（已生效/审核中/未通过），审核中不再露出"申请入驻"大按钮（防重复提交），
//      但仍保留"＋ 申请入驻其他商户"入口（一人多商户天然成立）；
//   3. 当前生效商户内联展示"商品/成员/信息维护"操作与认证/执照入口；点击其它生效商户卡即切换为当前；
//   4. 数据来源 stores/merchant 的 applications（全量非 Draft），后端零改动；
//   5. 撤回申请改为京东购物车式左滑操作条（SwipeCell），移除卡底独立"撤回申请"按钮，卡面更精简；
//   6. Badge/MerchantCard 由"页面函数内定义"提升为模块级组件——函数内定义使每次父级重渲染都生成
//      新组件类型，React 按类型变化整棵子树 remount，SwipeCell 内部拖拽态被清零，正是"滑出后缩回
//      定不住"的根因（松手 onOpenChange 触发页面 setState 即重渲染）；提升后组件实例稳定。
import Icon from '../../components/Icon'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { useAuthStore } from '../../stores/auth'
import { useMerchantStore } from '../../stores/merchant'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
import SwipeCell, { type SwipeCellAction } from '../../components/SwipeCell'
import { withdrawApplication, deleteApplication, type MerchantApplication } from '../../services/merchant'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { usableImage } from '../../services/config'
import './index.scss'

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

/** 角色码转中文 */
function roleLabel(role?: string | null): string {
  if (role === 'MerchantAdmin') return '管理员'
  if (role === 'MerchantStaff') return '员工'
  return ''
}

/** 状态徽标元数据（文案 + 语义色），主题 token 由调用方传入 */
function statusMeta(t: ReturnType<typeof useTheme>, s: string): { label: string; color: string } {
  if (s === 'Active') return { label: '已生效', color: t.success }
  if (s === 'Pending') return { label: '审核中', color: t.warning }
  if (s === 'Suspended') return { label: '未通过', color: t.danger }
  return { label: s, color: t.textTertiary }
}

/** 状态徽标（圆点 + 文字，胶囊底）。模块级组件：见文件头改动说明 6 */
function Badge({ status }: { status: string }) {
  const t = useTheme()
  const fs = useFs()
  const meta = statusMeta(t, status)
  return (
    <View className='mch-badge' style={{ backgroundColor: t.bgBadge }}>
      <View className='mch-badge-dot' style={{ backgroundColor: meta.color }} />
      <Text className='mch-badge-text' style={{ ...fs(12), color: meta.color }}>{meta.label}</Text>
    </View>
  )
}

interface MerchantCardProps {
  m: MerchantApplication
  /** 当前处于左滑展开态的商户 id（页面级互斥） */
  swipeOpenId: string | null
  /** 展开态变化：open 传该卡 id，close 传 null */
  onSwipeOpenChange: (id: string | null) => void
}

/**
 * 单个商户卡：Pending 卡外包 SwipeCell（左滑露出撤回），Suspended 卡外包 SwipeCell（左滑露出删除、
 * 点击进修改重提编辑页），其余状态直接渲染。
 * 模块级组件：见文件头改动说明 6（防 remount 丢 SwipeCell 状态）。
 */
function MerchantCard({ m, swipeOpenId, onSwipeOpenChange }: MerchantCardProps) {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const currentMerchantId = useMerchantStore((s) => s.currentMerchantId)
  const fetchApplications = useMerchantStore((s) => s.fetchApplications)
  const switchMerchant = useMerchantStore((s) => s.switchMerchant)

  const isCurrent = m.merchantId === currentMerchantId
  const isActive = m.status === 'Active'
  // 改动说明（v2.6.0）：Pending 左滑=撤回、Suspended 左滑=删除，两态都外包 SwipeCell
  const swipeable = m.status === 'Pending' || m.status === 'Suspended'
  const src = m.logoUrl ? usableImage(m.logoUrl) : ''

  // 卡片通用阴影（RN：iOS shadow 四件套 + Android elevation）
  const cardShadow = {
    shadowColor: t.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: 1,
    elevation: 2
  } as const

  // 改动说明（v2.6.0）：Suspended 卡点击已改为带 merchantId 进编辑页，原卡内 goApply（跳空白向导）移除

  /** 删除被驳回申请：二次确认后调 BFF，成功后刷新列表（self 卡消失 / claim 退回公共池） */
  const onDelete = () => {
    showConfirmDialog({
      title: '删除被驳回申请',
      content: '删除后该驳回记录将被清除，之后可重新申请入驻。确定删除？',
      confirmColor: '#EF4444'
    })
      .then(async (ok) => {
        if (!ok) return
        try {
          const r = await deleteApplication(m.merchantId)
          Taro.showToast({ title: r?.message || '已删除', icon: 'none' })
          void fetchApplications()
        } catch (e) {
          Taro.showToast({ title: (e as { message?: string })?.message || '删除失败', icon: 'none' })
        }
      })
  }

  /** 点击商户卡：生效商户切换为当前；未通过则带商户 id 进"修改并重新提交"编辑页（v2.6.0，原为跳空白向导） */
  const onCardTap = () => {
    if (m.status === 'Active' && m.merchantId !== currentMerchantId) void switchMerchant(m.merchantId)
    else if (m.status === 'Suspended') {
      if (!isLoggedIn) { Taro.showToast({ title: '请先登录', icon: 'none' }); return }
      Taro.navigateTo({ url: `/pages/merchant/apply?merchantId=${m.merchantId}` })
    }
  }

  /** 撤回待审核申请：二次确认后调 BFF，成功后刷新列表（self 卡消失回申请态 / claim 退回公共池） */
  const onWithdraw = () => {
    showConfirmDialog({
      title: '撤回入驻申请',
      content: '撤回后该待审核申请将被取消，可稍后重新申请。确定撤回？',
      confirmColor: '#EF4444'
    })
      .then(async (ok) => {
        if (!ok) return
        try {
          const r = await withdrawApplication(m.merchantId)
          Taro.showToast({ title: r?.message || '已撤回', icon: 'none' })
          void fetchApplications()
        } catch (e) {
          Taro.showToast({ title: (e as { message?: string })?.message || '撤回失败', icon: 'none' })
        }
      })
  }

  const card = (
    <View
      className='mch-card'
      // 改动说明：swipeable 时阴影/下边距上移到 SwipeCell 容器（容器 overflow:hidden 会裁掉卡片自身阴影），
      //   卡片自身置 marginBottom:0 防撑高容器导致操作条底部漏出
      style={{ backgroundColor: t.bgCard, ...(swipeable ? { marginBottom: 0 } : cardShadow) }}
      onClick={onCardTap}
    >
      <View className='mch-card-row'>
        <View className='mch-avatar' style={{ backgroundColor: t.primary }}>
          {src
            ? <Image className='mch-avatar' src={src} mode='aspectFill' style={{ width: 44, height: 44 }} />
            : <Text style={{ ...fs(18), color: t.textOnPrimary, fontWeight: '600' }}>{(m.merchantName || '商').slice(0, 1)}</Text>}
        </View>
        <View className='mch-mid'>
          {/* v1.7.2 认证徽标上移至名称旁（金色小标，主流电商店铺式）：替代卡底重复提示行 */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text className='mch-name' style={{ ...fs(15), color: t.textPrimary }} numberOfLines={1}>{m.merchantName}</Text>
            {isActive && m.isVerified && (
              <View style={{ marginLeft: 6, paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1, borderRadius: 4, backgroundColor: '#F59E0B' }}>
                <Text style={{ ...fs(10), color: '#FFFFFF' }}>已认证</Text>
              </View>
            )}
          </View>
          {/* Pending 副标题两行（用户确认的版式）：首行状态+左滑提示、次行审核时长；
              用两个 Text 叠放而非 \n+pre-line（RN 不支持 white-space，flex column 三端一致） */}
          {m.status === 'Pending' ? (
            <>
              <Text className='mch-sub' style={{ ...fs(12), color: t.textTertiary }}>已提交，左滑可撤回</Text>
              <Text className='mch-sub' style={{ ...fs(12), color: t.textTertiary }}>预计 1–3 个工作日完成审核</Text>
            </>
          ) : (
            <Text className='mch-sub' style={{ ...fs(12), color: t.textTertiary }}>
              {isActive
                ? (m.isVerified ? `${roleLabel(m.role)} · 已认证` : `${roleLabel(m.role)} · 未认证`)
                // 改动说明（v2.6.0）：被拒副标题改为操作指引（驳回原因已由下方红条展示，不再重复）
                : '审核未通过，点击修改重新提交，左滑可删除'}
            </Text>
          )}
        </View>
        <Badge status={m.status} />
      </View>

      {/* 未通过：给出驳回原因条 */}
      {m.status === 'Suspended' && m.rejectReason && (
        <View className='mch-reason' style={{ backgroundColor: t.bgInput }}>
          <Text style={{ ...fs(12), color: t.danger }}>驳回原因：{m.rejectReason}</Text>
        </View>
      )}

      {/* 当前生效商户：内联操作区（v1.7.2：四按钮同权灰底——商品/成员/信息维护平级无主次；
          未认证且管理员多一个"申请认证"入口，跳信息维护证照材料区补件即申请） */}
      {isActive && isCurrent && (
        <View className='mch-actions' style={{ borderTopWidth: 1, borderTopColor: t.borderLight }}>
          <View className='mch-action' style={{ backgroundColor: t.bgInput }} onClick={() => Taro.navigateTo({ url: '/pages/merchant/manage' })}>
            <Text style={{ ...fs(13), color: t.textPrimary }}>商品管理</Text>
          </View>
          <View className='mch-action' style={{ backgroundColor: t.bgInput }} onClick={() => Taro.navigateTo({ url: '/pages/merchant/members' })}>
            <Text style={{ ...fs(13), color: t.textPrimary }}>成员管理</Text>
          </View>
          {m.role === 'MerchantAdmin' && (
            <View className='mch-action' style={{ backgroundColor: t.bgInput }} onClick={() => Taro.navigateTo({ url: '/pages/merchant/profile' })}>
              <Text style={{ ...fs(13), color: t.textPrimary }}>信息维护</Text>
            </View>
          )}
          {m.role === 'MerchantAdmin' && !m.isVerified && (
            <View className='mch-action' style={{ backgroundColor: t.bgInput }} onClick={() => Taro.navigateTo({ url: '/pages/merchant/profile' })}>
              <Text style={{ ...fs(13), color: t.primary }}>申请认证</Text>
            </View>
          )}
        </View>
      )}

      {/* 非当前的生效商户：引导切换 */}
      {isActive && !isCurrent && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <Text style={{ ...fs(12), color: t.primaryText }}>点击设为当前商户</Text>
          <Icon name='chevron-right' size={14} color={t.primaryText} />
        </View>
      )}
    </View>
  )

  if (!swipeable) return card

  // 审核中卡：左滑露出撤回操作条；被拒卡：左滑露出删除操作条（京东购物车式，替代独立按钮）
  const actions: SwipeCellAction[] = [{
    key: m.status === 'Pending' ? 'withdraw' : 'delete',
    label: m.status === 'Pending' ? '撤回' : '删除',
    color: t.textOnPrimary,
    bg: t.danger,
    onPress: () => { onSwipeOpenChange(null); if (m.status === 'Pending') onWithdraw(); else onDelete() }
  }]
  return (
    <SwipeCell
      actions={actions}
      opened={swipeOpenId === m.merchantId}
      onOpenChange={(o) => onSwipeOpenChange(o ? m.merchantId : null)}
      containerStyle={{ ...cardShadow, marginBottom: 12 }}
    >
      {card}
    </SwipeCell>
  )
}

export default function MerchantPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const merchants = useMerchantStore((s) => s.merchants)
  const applications = useMerchantStore((s) => s.applications)
  const pendingCount = useMerchantStore((s) => s.pendingCount)
  const fetchApplications = useMerchantStore((s) => s.fetchApplications)

  // 左滑互斥：全页同时只允许一张卡处于展开态，记录展开卡的 merchantId
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null)

  useDidShow(() => {
    if (isLoggedIn) fetchApplications().catch(() => { /* 拉取失败保持当前状态 */ })
  })

  const goApply = () => {
    if (!isLoggedIn) { Taro.showToast({ title: '请先登录', icon: 'none' }); return }
    Taro.navigateTo({ url: '/pages/merchant/apply' })
  }

  // 卡片通用阴影（RN：iOS shadow 四件套 + Android elevation），页面级空态/引导卡使用
  const cardShadow = {
    shadowColor: t.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: 1,
    elevation: 2
  } as const

  return (
    <PageLayout nav={<NavBar title='商家' />} tabbar={<CustomTabBar />}>
      <View className='mch-body'>
        {/* 顶部品牌区 */}
        <View className='mch-hero'>
          <View className='mch-hero-icon' style={{ backgroundColor: t.primaryLight }}>
            <Icon name='store' size={26} color={t.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text className='mch-hero-title' style={{ ...fs(17), color: t.textPrimary }}>
              {applications.length > 0 ? '我的商户' : '开设轴承店铺'}
            </Text>
            <Text className='mch-hero-desc' style={{ ...fs(13), color: t.textTertiary }}>
              {applications.length > 0 ? '一个账号可管理多家商户' : '提交入驻申请，审核通过即可上架经营'}
            </Text>
          </View>
        </View>

        {/* 未登录引导 */}
        {!isLoggedIn ? (
          <View className='mch-card' style={{ backgroundColor: t.bgCard, ...cardShadow, alignItems: 'center', padding: 24 }}>
            <Text style={{ ...fs(14), color: t.textSecondary, textAlign: 'center' }}>登录后可申请入驻与管理店铺</Text>
            <View className='mch-primary' style={{ backgroundColor: t.primary, alignSelf: 'stretch' }}
              onClick={() => Taro.navigateTo({ url: '/pages/auth/login' })}>
              <Text style={{ ...fs(15), color: t.textOnPrimary }}>去登录</Text>
            </View>
          </View>
        ) : applications.length > 0 ? (
          <>
            <View className='mch-section'>
              <Text className='mch-section-title' style={{ ...fs(14), color: t.textPrimary }}>我的商户</Text>
              <Text className='mch-section-count' style={{ ...fs(12), color: t.textTertiary }}>
                {merchants.length} 家已生效{pendingCount > 0 ? ` · ${pendingCount} 家审核中` : ''}
              </Text>
            </View>

            {applications.map((m) => (
              <MerchantCard key={m.merchantId} m={m} swipeOpenId={swipeOpenId} onSwipeOpenChange={setSwipeOpenId} />
            ))}

            {/* 虚线新增卡：一人多商户，始终可再申请一家 */}
            <View className='mch-add' style={{ borderColor: t.border }} onClick={goApply}>
              <Icon name='plus' size={16} color={t.primary} />
              <Text style={{ ...fs(14), color: t.primaryText, marginLeft: 6 }}>申请入驻其他商户</Text>
            </View>
          </>
        ) : (
          /* 空状态：无任何申请 */
          <View className='mch-card' style={{ backgroundColor: t.bgCard, ...cardShadow, alignItems: 'center', padding: 24 }}>
            <Text style={{ ...fs(14), color: t.textSecondary, textAlign: 'center' }}>你还没有入驻任何商户</Text>
            <View className='mch-primary' style={{ backgroundColor: t.primary, alignSelf: 'stretch' }} onClick={goApply}>
              <Text style={{ ...fs(15), color: t.textOnPrimary }}>申请入驻</Text>
            </View>
          </View>
        )}
      </View>
    </PageLayout>
  )
}
