// 商家主页（v2.6.0 双界面拆分后=纯公开展示界面）：门面+勋章园+商家信息+在售商品+关注/纠错；
// 自家成员管理界面见 pages/merchant/home.tsx（本页仅给成员一条"进入管理"横幅）。
// 数据来自 BFF public 端点：/merchants/{id}（含成员标记/达成数）、/merchants/{id}/bearings。
// 关注/纠错为登录门槛（未登录提示）。
import { useState } from 'react'
import CorrectionSheet from '../../components/CorrectionSheet'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import MedalImage from '../../components/MedalImage'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useAuthStore } from '../../stores/auth'
import { checkFollow, toggleFollow, recordMerchantView } from '../../services/user'
import { getMerchantDetail, getMerchantBearings, type MerchantDetail, type MerchantBearing } from '../../services/merchant'
import MediaImage from '../../components/MediaImage'
// v2.1.0 成就子系统：商家勋章园（B2B 信任信号）
import { getMerchantAchievements, type AchievementWall } from '../../services/achievements'
import './merchantDetail.scss'

export default function MerchantDetailPage() {
  const router = useRouter()
  const id = router.params.id || ''
  const t = useTheme()
  const fs = useFs()

  const [detail, setDetail] = useState<MerchantDetail | null>(null)
  const [bearings, setBearings] = useState<MerchantBearing[]>([])
  // v2.1.0 成就子系统：商家勋章园数据（信任信号）
  const [mAch, setMAch] = useState<AchievementWall | null>(null)

  // 勋章园随页刷新（失败静默，信任信号缺失不阻断详情）
  useDidShow(() => {
    if (id) void getMerchantAchievements(id).then((r) => setMAch(r || null)).catch(() => setMAch(null))
  })
  // 改动说明：登录态改订阅 auth store（同轴承详情页，access 只存内存旧写法恒判未登录）
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  // 勋章园展示序：最近点亮优先（与个人勋章卡同口径），最多 12 枚
  const medalItems = (mAch?.items ?? [])
    .filter((i) => i.unlocked)
    .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))
    .slice(0, 12)
  const [isFollowed, setIsFollowed] = useState(false)
  // 改动说明（v1.7.14）：纠错面板可见态（结构化纠错 CorrectionSheet）
  const [correctVisible, setCorrectVisible] = useState(false)

  useDidShow(() => {
    if (!id) return
    getMerchantDetail(id).then(setDetail).catch(() => {})
    getMerchantBearings(id).then(r => setBearings(r?.items || [])).catch(() => {})
    // 关注状态回显 + 浏览上报（仅登录时）
    if (isLoggedIn) {
      checkFollow(id).then(setIsFollowed).catch(() => setIsFollowed(false))
      recordMerchantView(id)
    } else {
      setIsFollowed(false)
    }
  })

  const requireLogin = () => {
    showConfirmDialog({ title: '提示', content: '该功能需登录后使用', confirmText: '去登录' }).then((ok) => {
      if (ok) Taro.navigateTo({ url: '/pages/auth/login' })
    })
  }
  // 关注/取消关注切换
  const handleFollow = async () => {
    if (!isLoggedIn) return requireLogin()
    const res = await toggleFollow(id, isFollowed).catch(() => null)
    if (res?.success) {
      setIsFollowed(!isFollowed)
      Taro.showToast({ title: isFollowed ? '已取消关注' : '已关注', icon: 'none' })
    } else {
      Taro.showToast({ title: res?.message || '操作失败，请稍后重试', icon: 'none' })
    }
  }
  // 改动说明（v1.7.14）：纠错从占位 toast 改为打开结构化纠错面板
  const handleCorrect = () => { if (!isLoggedIn) return requireLogin(); setCorrectVisible(true) }
  const goBearing = (bid: string) => Taro.navigateTo({ url: `/pages/home/bearingDetail?id=${bid}` })
  const callPhone = (p?: string | null) => { if (p) Taro.makePhoneCall({ phoneNumber: p }).catch(() => {}) }

  return (
    <PageLayout nav={<NavBar title="商家主页" showBack />}>
      <View className='md'>
        {/* 头部：Logo + 名称 + 认证 + 类型 */}
        <View className='md-hero' style={{ backgroundColor: t.bgCard }}>
          <MediaImage
            url={detail?.logoUrl}
            className='md-logo'
            mode='aspectFit'
            fallback={
              <View className='md-logo-ph' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="store" size={32} color={t.primary} />
              </View>
            }
          />
          <View className='md-hero-info'>
            <View className='md-name-row'>
              <Text className='md-name' style={{ ...fs(18), color: t.textPrimary }} numberOfLines={1}>{detail?.name || '—'}</Text>
              {detail?.isVerified && (
                // 改动说明（v1.7.11）：文案"入驻商家"是认证等级上线前的旧词已失真（入驻=已生效是另一回事），
                //   统一为与商户页同款金色"已认证"徽标（主流：徽标在所有露出点一致）
                // 改动说明（v2.5.0 商家经济）：徽章直接展示商家等级中文名（认证商家/口碑商家/金牌商家，v2.13.0 Lv3 改名口碑），
                //   等级是 B2B 信任资产——金牌琥珀、口碑蓝、认证金，徽标在所有露出点保持一致
                <View style={{ marginLeft: 6, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4, backgroundColor: detail.grade === 'Gold' ? '#D97706' : detail.grade === 'Premium' ? '#8B5CF6' : '#F59E0B', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="badge-check" size={11} color="#FFFFFF" />
                  <Text style={{ ...fs(10), color: '#FFFFFF', fontWeight: 'bold', marginLeft: 3 }}>{detail.gradeDisplay || '已认证'}</Text>
                </View>
              )}
            </View>
            {detail?.companyName ? <Text className='md-sub' style={{ ...fs(13), color: t.textTertiary }} numberOfLines={1}>{detail.companyName}</Text> : null}
            {/* 改动说明：type 脏数据可能是 "0"/空，过滤掉避免眉部显示无意义的 "0" */}
            {detail?.type && detail.type !== '0' ? <Text className='md-sub' style={{ ...fs(12), color: t.textTertiary }}>{detail.type}</Text> : null}
          </View>
        </View>

        {/* v2.6.0 商家勋章园（承 v2.1.0 徽章排升级）：常驻卡——头部"商家勋章园 + 共 N 枚"，
            勋章双环占位排（rare 金环/主题色环，与个人勋章卡同款），
            底部集体任务累计达成次数（帮派"通关史"信任信号） */}
        <View className='md-card' style={{ backgroundColor: t.bgCard }}>
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600', flex: 1 }}>商家勋章园</Text>
            <Text style={{ ...fs(13), color: t.textTertiary }}>共 {mAch?.unlockedCount ?? 0} 枚</Text>
          </View>
          {medalItems.length === 0 ? (
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 8 }}>商家完成签到纠错、上架供给、集体任务等都能点亮勋章</Text>
          ) : (
            <ScrollView scrollX showsHorizontalScrollIndicator={false} style={{ height: 84, marginTop: 10 }}>
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
                {medalItems.map((b) => {
                  return (
                    <View key={b.key} style={{ width: 64, display: 'flex', alignItems: 'center', marginRight: 6 }}>
                      <MedalImage imageKey={b.imageKey} icon={b.icon || 'award'} rare={b.rare} variant='card' primary={t.primary} primaryLight={t.primaryLight} />
                      <Text style={{ ...fs(10), color: t.textTertiary, marginTop: 4 }} numberOfLines={1}>{b.name}</Text>
                    </View>
                  )
                })}
              </View>
            </ScrollView>
          )}
          {(detail?.completedTaskCount ?? 0) > 0 && (
            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 8 }}>集体任务累计达成 {detail?.completedTaskCount} 次</Text>
          )}
        </View>

        {/* 成员横幅（v2.6.0 双界面拆分）：本页回归纯公开展示，自家成员给一条
            进入管理页的导航（建议1 落地：两界面互留导航） */}
        {detail?.isMerchantMember && (
          <View
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', margin: 12, marginTop: 0, paddingTop: 10, paddingBottom: 10, paddingLeft: 14, paddingRight: 14, borderRadius: 10, backgroundColor: 'rgba(139,92,246,0.10)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)' }}
            onClick={() => Taro.navigateTo({ url: '/pages/merchant/home' })}
          >
            <Icon name='shield' size={16} color='#8B5CF6' />
            <Text style={{ ...fs(13), color: '#8B5CF6', flex: 1, marginLeft: 8 }}>这是你经营的商家</Text>
            <Text style={{ ...fs(13), color: '#8B5CF6', fontWeight: '600' }}>进入管理 ›</Text>
          </View>
        )}

        {/* 联系信息 */}
        <View className='md-card' style={{ backgroundColor: t.bgCard }}>
          <Text className='md-card-title' style={{ ...fs(15), color: t.textPrimary }}>商家信息</Text>
          {detail?.contactPerson && (
            <View className='md-row'>
              <Text className='md-k' style={{ ...fs(13), color: t.textTertiary }}>联系人</Text>
              <Text className='md-v' style={{ ...fs(13), color: t.textPrimary }}>{detail.contactPerson}</Text>
            </View>
          )}
          {/* 改动说明：电话行改为始终显示（无值显示"暂无"），避免商家无联系方式时整行消失、用户以为没加载 */}
          <View className='md-row' onClick={() => callPhone(detail?.mobile || detail?.phone)}>
            <Text className='md-k' style={{ ...fs(13), color: t.textTertiary }}>联系电话</Text>
            {(detail?.mobile || detail?.phone) ? (
              <View className='md-v-call'>
                <Text className='md-v' style={{ ...fs(13), color: t.primaryText }}>{detail?.mobile || detail?.phone}</Text>
                <Icon name="phone" size={16} color={t.primaryText} />
              </View>
            ) : (
              <Text className='md-v-empty' style={{ ...fs(13), color: t.textTertiary }}>暂无</Text>
            )}
          </View>
          {detail?.email && (
            <View className='md-row'>
              <Text className='md-k' style={{ ...fs(13), color: t.textTertiary }}>邮箱</Text>
              <Text className='md-v' style={{ ...fs(13), color: t.textPrimary }}>{detail.email}</Text>
            </View>
          )}
          {detail?.address && (
            <View className='md-row'>
              <Text className='md-k' style={{ ...fs(13), color: t.textTertiary }}>地址</Text>
              <Text className='md-v' style={{ ...fs(13), color: t.textPrimary }}>{detail.address}</Text>
            </View>
          )}
          <View className='md-row'>
            <Text className='md-k' style={{ ...fs(13), color: t.textTertiary }}>在售 / 粉丝</Text>
            <Text className='md-v' style={{ ...fs(13), color: t.textPrimary }}>{detail?.productCount ?? 0} / {detail?.followerCount ?? 0}</Text>
          </View>
        </View>

        {/* 在售轴承 */}
        <View className='md-card' style={{ backgroundColor: t.bgCard }}>
          <Text className='md-card-title' style={{ ...fs(15), color: t.textPrimary }}>在售轴承（{bearings.length}）</Text>
          {bearings.length === 0 && <Text className='md-empty' style={{ ...fs(13), color: t.textTertiary }}>暂无在售轴承</Text>}
          {bearings.map((b) => (
            <View key={b.bearingId} className='md-list-row' onClick={() => goBearing(b.bearingId)}>
              <View className='md-list-main'>
                <Text className='md-list-name' style={{ ...fs(15), color: t.textPrimary }}>{b.bearingPartNumber}</Text>
                <Text className='md-list-sub' style={{ ...fs(12), color: t.textTertiary }}>
                  {b.bearingTypeName}{b.brandName ? ` · ${b.brandName}` : ''}
                </Text>
              </View>
              {b.price ? <Text className='md-list-price' style={{ ...fs(14), color: t.primaryText }}>{b.price}</Text> : null}
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>
          ))}
        </View>

        {/* 操作：关注 / 纠错（登录门槛） */}
        <View className='md-actions'>
          <View className='md-btn' style={{ backgroundColor: isFollowed ? t.danger : t.primary }} onClick={handleFollow}>
            <Icon name={isFollowed ? 'user-check' : 'user-plus'} size={18} color={t.textOnPrimary} />
            <Text className='md-btn-text' style={{ ...fs(15), color: t.textOnPrimary }}>{isFollowed ? '已关注' : '关注'}</Text>
          </View>
          <View className='md-btn-ghost' style={{ borderColor: t.border }} onClick={handleCorrect}>
            <Icon name="edit" size={18} color={t.textSecondary} />
            <Text className='md-btn-ghost-text' style={{ ...fs(15), color: t.textSecondary }}>纠错</Text>
          </View>
        </View>
      </View>
      <CorrectionSheet visible={correctVisible} targetType='Merchant' targetId={id} onClose={() => setCorrectVisible(false)} />
    </PageLayout>
  )
}
