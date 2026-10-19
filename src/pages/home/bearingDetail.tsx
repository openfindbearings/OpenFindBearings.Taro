// 轴承详情页：基本信息 + 参数 + 在售商家 + 替代品。收藏/纠错为登录门槛（未登录提示）。
// 数据来自 BFF public 端点：/bearings/{id}、/bearings/{id}/merchants、/bearings/{id}/interchanges。
// v1.6.0 搜索寻货联动：查到不等于结束——在售认证商家可「邀标」（预勾选该家），底部「发布寻货」预填 bearingId；
//   参数来源为互联网时标「仅供参考」；新增「分享货源」（分享"谁家真实有货"引流回平台）。
// v1.8.0 公开招标/邀标：按钮统一「发布寻货」（公开/邀标在发布页二选一），在售认证家数改由说明行承载，
//   未认证在售归"其他在售·仅供参考"段（只读不导流），让"在售"与"可邀标"的差别可见。
import { useState } from 'react'
import CorrectionSheet from '../../components/CorrectionSheet'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import ShareButton from '../../components/ShareButton'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { useShareMessage } from '../../hooks/useShareMessage'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useAuthStore } from '../../stores/auth'
import { setObject } from '../../utils/storage'
import { checkFavorite, toggleFavorite, recordBearingView } from '../../services/user'
import {
  getBearingDetail, getBearingMerchants, getBearingInterchanges, interchangeTone, isReferenceSource,
  type BearingDetail, type BearingMerchant, type Interchange
} from '../../services/bearing'
import MediaImage from '../../components/MediaImage'
import './bearingDetail.scss'

/** 发布寻货预填 storage 键（轴承详情 → 发布页跨页传参，RN 兼容的异步存取对象） */
const PREFILL_KEY = 'sourcing_publish_prefill'

export default function BearingDetailPage() {
  const router = useRouter()
  const id = router.params.id || ''
  // v1.6.0 分享落地：view=supply 时"货源视角"——在售认证商家置顶、参数退居次位
  const supplyView = router.params.view === 'supply'
  const t = useTheme()
  const fs = useFs()

  const [detail, setDetail] = useState<BearingDetail | null>(null)
  const [merchants, setMerchants] = useState<BearingMerchant[]>([])
  const [interchanges, setInterchanges] = useState<Interchange[]>([])
  // 登录态由订阅 auth store（access 只存内存，旧写法恒判未登录）
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [isFav, setIsFav] = useState(false)
  const [correctVisible, setCorrectVisible] = useState(false)

  /** 认证商家（可信数据：可询价、计入"真实有货"家数） */
  const verifiedMerchants = merchants.filter((m) => m.isVerified)
  /** 其他在售商家（未认证：仅供参考、只读不导流） */
  const otherMerchants = merchants.filter((m) => !m.isVerified)
  /** 认证商家数（分享文案/数显用） */
  const verifiedCount = verifiedMerchants.length

  // v1.6.0 微信/抖音小程序原生分享内容（H5 由框架注入；RN 平台不支持，包装内静默跳过）
  useShareMessage(() => ({
    title: `${detail?.partNumber || ''}${detail?.brandName ? ' · ' + detail.brandName : ''} · ${verifiedCount}家认证商家真实有货`,
    path: `/pages/home/bearingDetail?id=${id}&view=supply`,
  }))

  useDidShow(() => {
    if (!id) return
    getBearingDetail(id).then(setDetail).catch(() => {})
    getBearingMerchants(id).then(r => setMerchants(r?.items || [])).catch(() => {})
    getBearingInterchanges(id).then(setInterchanges).catch(() => {})
    // 收藏状态回显 + 浏览上报（仅登录时；上报尽力而为失败静默）
    if (isLoggedIn) {
      checkFavorite(id).then(setIsFav).catch(() => setIsFav(false))
      recordBearingView(id)
    } else {
      setIsFav(false)
    }
  })

  // 未登录统一提示（收藏/关注/纠错等登录门槛动作复用）
  const requireLogin = () => {
    showConfirmDialog({ title: '提示', content: '该功能需登录后使用', confirmText: '去登录' }).then((ok) => {
      if (ok) Taro.navigateTo({ url: '/pages/auth/login' })
    })
  }

  // 收藏/取消收藏切换（成功后翻转本地状态，失败提示原因）
  const handleFavorite = async () => {
    if (!isLoggedIn) return requireLogin()
    const res = await toggleFavorite(id, isFav).catch(() => null)
    if (res?.success) {
      setIsFav(!isFav)
      Taro.showToast({ title: isFav ? '已取消收藏' : '已收藏', icon: 'none' })
    } else {
      Taro.showToast({ title: res?.message || '操作失败，请稍后重试', icon: 'none' })
    }
  }
  const handleCorrect = () => { if (!isLoggedIn) return requireLogin(); setCorrectVisible(true) }
  const goMerchant = (mid: string) => Taro.navigateTo({ url: `/pages/merchant/merchantDetail?id=${mid}` })
  const goBearing = (bid: string) => Taro.navigateTo({ url: `/pages/home/bearingDetail?id=${bid}` })

  /**
   * 发布寻货（公开招标，默认）：预填型号/品牌/bearingId 后跳发布页（发布页再选公开/邀标）。
   * 登录门槛——查到→进一步联系（寻货）属注册功能。
   * 改动说明（v1.8.0 公开招标/邀标）：原预填 targetMerchantId=null 改为 visibility=0（公开侧），
   *   邀标与否交给发布页选择，详情页只负责"带着轴承上下文进入发布"。
   */
  const handleCreateDemand = () => {
    if (!isLoggedIn) return requireLogin()
    void setObject(PREFILL_KEY, {
      partNumber: detail?.partNumber || '',
      brand: detail?.brandName || '',
      bearingId: id,
      visibility: 0,
    })
    Taro.navigateTo({ url: '/pages/discover/publish' })
  }

  /**
   * 邀标本商家（原"询价"）：仅对认证商家开放（行动门），预填 bearingId + 邀标 + 只勾选该商家后跳发布页。
   * 改动说明（v1.8.0 公开招标/邀标）：由"定向询价单商户"改为"邀标 + 预勾选这一家"，
   *   发布页收件人清单里仅勾该家，用户可再增勾其他在售认证商家。
   */
  const handleInvite = (m: BearingMerchant) => {
    if (!isLoggedIn) return requireLogin()
    void setObject(PREFILL_KEY, {
      partNumber: detail?.partNumber || '',
      brand: detail?.brandName || '',
      bearingId: id,
      visibility: 1,
      invitedMerchantIds: [m.merchantId],
    })
    Taro.navigateTo({ url: '/pages/discover/publish' })
  }

  /** 基本参数卡（含参数来源标注；人工校对不标，互联网三源标"仅供参考"） */
  const specCard = (
    <View className='bd-card' style={{ backgroundColor: t.bgCard }}>
      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text className='bd-card-title' style={{ ...fs(15), color: t.textPrimary }}>基本参数</Text>
        {isReferenceSource(detail?.dataSource) ? (
          <Text style={{ ...fs(11), color: t.textTertiary }}>参数来源：互联网 · 仅供参考</Text>
        ) : null}
      </View>
      <View className='bd-spec-row'>
        <Text className='bd-spec-k' style={{ ...fs(13), color: t.textTertiary }}>内径 d</Text>
        <Text className='bd-spec-v' style={{ ...fs(13), color: t.textPrimary }}>{detail?.innerDiameter ?? '—'} mm</Text>
      </View>
      <View className='bd-spec-row'>
        <Text className='bd-spec-k' style={{ ...fs(13), color: t.textTertiary }}>外径 D</Text>
        <Text className='bd-spec-v' style={{ ...fs(13), color: t.textPrimary }}>{detail?.outerDiameter ?? '—'} mm</Text>
      </View>
      <View className='bd-spec-row'>
        <Text className='bd-spec-k' style={{ ...fs(13), color: t.textTertiary }}>宽度 B</Text>
        <Text className='bd-spec-v' style={{ ...fs(13), color: t.textPrimary }}>{detail?.width ?? '—'} mm</Text>
      </View>
      {detail?.weight != null && (
        <View className='bd-spec-row'>
          <Text className='bd-spec-k' style={{ ...fs(13), color: t.textTertiary }}>重量</Text>
          <Text className='bd-spec-v' style={{ ...fs(13), color: t.textPrimary }}>{detail.weight} kg</Text>
        </View>
      )}
      {detail?.brandCountry ? (
        <View className='bd-spec-row'>
          <Text className='bd-spec-k' style={{ ...fs(13), color: t.textTertiary }}>品牌产地</Text>
          <Text className='bd-spec-v' style={{ ...fs(13), color: t.textPrimary }}>{detail.brandCountry}</Text>
        </View>
      ) : null}
    </View>
  )

  /**
   * 商家行：认证商家带「已认证」徽标并可「询价」（定向寻货，行动门）；
   * 未认证商家只展示、不导流（归"其他在售·仅供参考"后段）
   */
  const merchantRow = (m: BearingMerchant) => (
    <View key={m.merchantId} className='bd-list-row' onClick={() => goMerchant(m.merchantId)}>
      <View className='bd-list-avatar' style={{ backgroundColor: t.primaryLight }}>
        <Icon name="store" size={18} color={t.primary} />
      </View>
      <View className='bd-list-main'>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <Text className='bd-list-name' style={{ ...fs(15), color: t.textPrimary }}>{m.merchantName}</Text>
          {/* v1.6.0 数据可信联动：认证商家徽标（可信信号；询价行动门依据） */}
          {m.isVerified ? (
            <Text style={{ ...fs(10), color: t.primary, borderWidth: 1, borderColor: t.primary, borderRadius: 4, paddingLeft: 4, paddingRight: 4, marginLeft: 6 }}>已认证</Text>
          ) : null}
          {/* v2.3.0 商城置顶卡：置顶商家角标 */}
          {m.isPinned ? (
            <Text style={{ ...fs(10), color: '#FFFFFF', backgroundColor: '#F59E0B', borderRadius: 4, paddingLeft: 5, paddingRight: 5, marginLeft: 6 }}>置顶</Text>
          ) : null}
          {m.saleState === 2 ? (
            <Text style={{ ...fs(10), color: '#FFFFFF', backgroundColor: t.warning, borderRadius: 4, paddingLeft: 5, paddingRight: 5, marginLeft: 6 }}>{m.restockEta ? '补货中·' + m.restockEta : '补货中'}</Text>
          ) : null}
        </View>
        {m.price ? <Text className='bd-list-sub' style={{ ...fs(12), color: t.textSecondary }}>{m.price}</Text> : null}
      </View>
      {/* 邀标（v1.8.0 公开招标/邀标，原"询价"）——仅认证商家开放（行动门）；非认证只展示不导流 */}
      {m.isVerified ? (
        <View
          style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 14, backgroundColor: t.primaryLight, marginLeft: 8 }}
          onClick={(e) => { e.stopPropagation(); handleInvite(m) }}
        >
          <Text style={{ ...fs(12), color: t.primary }}>邀标</Text>
        </View>
      ) : null}
      <Icon name="chevron_right" size={18} color={t.textTertiary} />
    </View>
  )

  /**
   * 在售商家卡（货源）：认证商家在前（可信、可询价），未认证归后段"仅供参考"（只读）；
   * 标题用"N 家认证商家真实有货"取代中性的"在售商家"，让"在售"与"可询价"的差别可见
   */
  const merchantsCard = (
    <View className='bd-card' style={{ backgroundColor: t.bgCard }}>
      <Text className='bd-card-title' style={{ ...fs(15), color: t.textPrimary }}>
        {verifiedCount > 0 ? `${verifiedCount} 家认证商家真实有货` : `在售商家（${merchants.length}）`}
      </Text>
      {merchants.length === 0 && <Text className='bd-empty' style={{ ...fs(13), color: t.textTertiary }}>暂无在售商家</Text>}
      {verifiedMerchants.map((m) => merchantRow(m))}
      {/* v1.7.0 数据可信联动：未认证在售归"仅供参考"分段（标灰口径、不提供询价），与认证商家可信段分开 */}
      {otherMerchants.length > 0 ? (
        <>
          <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 10 }}>其他在售 · 仅供参考（未认证商家，暂不提供邀请报价）</Text>
          {otherMerchants.map((m) => merchantRow(m))}
        </>
      ) : null}
      {/* v1.6.0 搜索寻货联动：查到→进一步联系（发布寻货 / 分享真实货源），而非查完就结束 */}
      {/* v1.8.0 公开招标/邀标：按钮统一"发布寻货"（公开/邀标在发布页选），在售认证家数改由下方说明行承载 */}
      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <View
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 20, backgroundColor: t.primary, marginRight: 10 }}
          onClick={handleCreateDemand}
        >
          <Icon name="search" size={16} color={t.textOnPrimary} />
          <Text style={{ ...fs(14), color: t.textOnPrimary, marginLeft: 6 }}>
            {isLoggedIn ? '发布寻货' : '登录后发布寻货'}
          </Text>
        </View>
        <ShareButton
          title={`${detail?.partNumber || ''}${detail?.brandName ? ' · ' + detail.brandName : ''} · ${verifiedCount}家认证商家真实有货，来平台邀请报价`}
          path={`/s/bearing/${id}?view=supply`}
          label="分享货源"
        />
      </View>
      {/* v1.8.0 路径说明：讲清发布后会发生什么（公开发布进大厅 / 只邀请认证商家），消解"在售≠可联系"的困惑 */}
      <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 8 }}>
        {!isLoggedIn
          ? '登录后可发布寻货、邀请认证商家报价'
          : verifiedCount > 0
            ? `当前 ${verifiedCount} 家认证商家有货：可公开发布（进大厅），也可只邀请他们报价`
            : '暂无认证商家在售，公开招标后如有匹配商家会收到通知'}
      </Text>
    </View>
  )

  return (
    <PageLayout nav={<NavBar title="轴承详情" showBack />}>
      <View className='bd'>
        {/* 头部：图片 + 型号 + 品牌类型 */}
        <View className='bd-hero' style={{ backgroundColor: t.bgCard }}>
          <MediaImage
            url={detail?.image3DUrl || detail?.image2DUrl}
            fallbacks={[detail?.image2DUrl]}
            className='bd-img'
            mode='aspectFit'
            fallback={
              <View className='bd-img-placeholder' style={{ backgroundColor: t.bgInput }}>
                <Icon name="package" size={40} color={t.textTertiary} />
              </View>
            }
          />
          <Text className='bd-part' style={{ ...fs(22), color: t.textPrimary }}>{detail?.partNumber || '—'}</Text>
          {detail?.oldNumber ? <Text className='bd-old' style={{ ...fs(13), color: t.textTertiary }}>旧型号：{detail.oldNumber}</Text> : null}
          <Text className='bd-sub' style={{ ...fs(14), color: t.textSecondary }}>{detail?.bearingType}{detail?.brandName ? ` · ${detail.brandName}` : ''}</Text>
        </View>

        {/* 货源视角（view=supply，来自分享）：在售商家置顶，参数退居次位 */}
        {supplyView ? (
          <>
            {merchantsCard}
            {specCard}
          </>
        ) : (
          <>
            {specCard}
            {merchantsCard}
          </>
        )}

        {/* 替代品（v2.16.0 三级治理：标准等效替代 / 条件替代（需评估） / 仅供参考；含责任提示） */}
        {interchanges.length > 0 && (
          <View className='bd-card' style={{ backgroundColor: t.bgCard }}>
            <Text className='bd-card-title' style={{ ...fs(15), color: t.textPrimary }}>替代品</Text>
            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2, marginBottom: 6 }}>替代关系由平台维护；“需评估/仅供参考”档请人工确认工况适配</Text>
            {interchanges.map((it) => {
              const badgeColor = interchangeTone(it.interchangeType, t)
              return (
                <View key={it.id} className='bd-list-row' onClick={() => it.bearingId && goBearing(it.bearingId)}>
                  <View className='bd-list-main'>
                    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                      <Text className='bd-list-name' style={{ ...fs(15), color: t.textPrimary }}>{it.partNumber}</Text>
                      <Text style={{ ...fs(10), color: '#FFFFFF', backgroundColor: badgeColor, borderRadius: 4, paddingLeft: 5, paddingRight: 5, marginLeft: 6 }}>{it.typeLabel}</Text>
                    </View>
                    <Text className='bd-list-sub' style={{ ...fs(12), color: t.textTertiary }}>
                      {it.brandName || '—'} · {it.innerDiameter}×{it.outerDiameter}×{it.width}
                    </Text>
                    {it.remarks ? <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>{it.remarks}</Text> : null}
                  </View>
                  <Icon name="chevron_right" size={18} color={t.textTertiary} />
                </View>
              )
            })}
            {/* v2.17.0 替代品字典化：替代关系报告入口——复用纠错表单（字段含"替代关系"），由平台核实后维护 */}
            <View className='bd-list-row' onClick={handleCorrect}>
              <View className='bd-list-main'>
                <Text style={{ ...fs(13), color: t.primary }}>替代关系有误或缺失？点此报告</Text>
              </View>
              <Icon name="edit" size={16} color={t.primary} />
            </View>
          </View>
        )}

        {/* 操作：收藏（状态驱动，已收藏可取消） / 纠错（登录门槛） */}
        <View className='bd-actions'>
          <View className='bd-btn' style={{ backgroundColor: isFav ? t.danger : t.primary }} onClick={handleFavorite}>
            <Icon name={isFav ? 'heart' : 'heart'} size={18} color={t.textOnPrimary} />
            <Text className='bd-btn-text' style={{ ...fs(15), color: t.textOnPrimary }}>{isFav ? '已收藏' : '收藏'}</Text>
          </View>
          <View className='bd-btn-ghost' style={{ borderColor: t.border }} onClick={handleCorrect}>
            <Icon name="edit" size={18} color={t.textSecondary} />
            <Text className='bd-btn-ghost-text' style={{ ...fs(15), color: t.textSecondary }}>纠错</Text>
          </View>
        </View>
      </View>
      <CorrectionSheet visible={correctVisible} targetType='Bearing' targetId={id} onClose={() => setCorrectVisible(false)} />
    </PageLayout>
  )
}