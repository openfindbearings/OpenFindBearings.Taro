// 商家详情页：商家信息（含 Logo）+ 在售轴承。关注/纠错为登录门槛（未登录提示）。
// 数据来自 BFF public 端点：/merchants/{id}、/merchants/{id}/bearings。
import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { getItem } from '../../utils/storage'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { getMerchantDetail, getMerchantBearings, type MerchantDetail, type MerchantBearing } from '../../services/merchant'
import { usableImage } from '../../services/config'
import './merchantDetail.scss'

export default function MerchantDetailPage() {
  const router = useRouter()
  const id = router.params.id || ''
  const t = useTheme()
  const fs = useFs()

  const [detail, setDetail] = useState<MerchantDetail | null>(null)
  const [bearings, setBearings] = useState<MerchantBearing[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useDidShow(() => {
    getItem('access_token').then(tk => setIsLoggedIn(!!tk)).catch(() => setIsLoggedIn(false))
    if (!id) return
    getMerchantDetail(id).then(setDetail).catch(() => {})
    getMerchantBearings(id).then(r => setBearings(r?.items || [])).catch(() => {})
  })

  const requireLogin = () => {
    Taro.showModal({
      title: '提示', content: '该功能需登录后使用', confirmText: '去登录',
      success: (res) => { if (res.confirm) { /* TODO: 跳登录页 */ } }
    })
  }
  const handleFollow = () => { if (!isLoggedIn) return requireLogin(); Taro.showToast({ title: '关注功能开发中', icon: 'none' }) }
  const handleCorrect = () => { if (!isLoggedIn) return requireLogin(); Taro.showToast({ title: '纠错功能开发中', icon: 'none' }) }
  const goBearing = (bid: string) => Taro.navigateTo({ url: `/pages/home/bearingDetail?id=${bid}` })
  const callPhone = (p?: string | null) => { if (p) Taro.makePhoneCall({ phoneNumber: p }).catch(() => {}) }

  return (
    <PageLayout nav={<NavBar title="商家详情" showBack />}>
      <View className='md'>
        {/* 头部：Logo + 名称 + 认证 + 类型 */}
        <View className='md-hero' style={{ backgroundColor: t.bgCard }}>
          {usableImage(detail?.logoUrl) ? (
            <Image className='md-logo' src={usableImage(detail?.logoUrl)} mode='aspectFill' />
          ) : (
            <View className='md-logo-ph' style={{ backgroundColor: t.primaryLight }}>
              <Icon name="store" size={32} color={t.primary} />
            </View>
          )}
          <View className='md-hero-info'>
            <View className='md-name-row'>
              <Text className='md-name' style={{ ...fs(18), color: t.textPrimary }} numberOfLines={1}>{detail?.name || '—'}</Text>
              {detail?.isVerified && (
                <View className='md-badge' style={{ backgroundColor: t.primaryLight }}>
                  <Icon name="badge-check" size={12} color={t.primaryText} />
                  <Text className='md-badge-text' style={{ ...fs(11), color: t.primaryText }}>入驻商家</Text>
                </View>
              )}
            </View>
            {detail?.companyName ? <Text className='md-sub' style={{ ...fs(13), color: t.textTertiary }} numberOfLines={1}>{detail.companyName}</Text> : null}
            {/* 改动说明：type 脏数据可能是 "0"/空，过滤掉避免眉部显示无意义的 "0" */}
            {detail?.type && detail.type !== '0' ? <Text className='md-sub' style={{ ...fs(12), color: t.textTertiary }}>{detail.type}</Text> : null}
          </View>
        </View>

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
          <View className='md-btn' style={{ backgroundColor: t.primary }} onClick={handleFollow}>
            <Icon name="user-plus" size={18} color={t.textOnPrimary} />
            <Text className='md-btn-text' style={{ ...fs(15), color: t.textOnPrimary }}>关注</Text>
          </View>
          <View className='md-btn-ghost' style={{ borderColor: t.border }} onClick={handleCorrect}>
            <Icon name="edit" size={18} color={t.textSecondary} />
            <Text className='md-btn-ghost-text' style={{ ...fs(15), color: t.textSecondary }}>纠错</Text>
          </View>
        </View>
      </View>
    </PageLayout>
  )
}
