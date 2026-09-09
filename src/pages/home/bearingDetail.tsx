// 轴承详情页：基本信息 + 参数 + 在售商家 + 替代品。收藏/纠错为登录门槛（未登录提示，登录功能后续接入）。
// 数据来自 BFF public 端点：/bearings/{id}、/bearings/{id}/merchants、/bearings/{id}/interchanges。
import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { getItem } from '../../utils/storage'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import {
  getBearingDetail, getBearingMerchants, getBearingInterchanges,
  type BearingDetail, type BearingMerchant, type Interchange
} from '../../services/bearing'
import { usableImage } from '../../services/config'
import './bearingDetail.scss'

export default function BearingDetailPage() {
  const router = useRouter()
  const id = router.params.id || ''
  const t = useTheme()
  const fs = useFs()

  const [detail, setDetail] = useState<BearingDetail | null>(null)
  const [merchants, setMerchants] = useState<BearingMerchant[]>([])
  const [interchanges, setInterchanges] = useState<Interchange[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useDidShow(() => {
    getItem('access_token').then(tk => setIsLoggedIn(!!tk)).catch(() => setIsLoggedIn(false))
    if (!id) return
    getBearingDetail(id).then(setDetail).catch(() => {})
    getBearingMerchants(id).then(r => setMerchants(r?.items || [])).catch(() => {})
    getBearingInterchanges(id).then(setInterchanges).catch(() => {})
  })

  // 未登录统一提示（收藏/关注/纠错等登录门槛动作复用）
  const requireLogin = () => {
    Taro.showModal({
      title: '提示', content: '该功能需登录后使用', confirmText: '去登录',
      success: (res) => { if (res.confirm) { /* TODO: 跳登录页 */ } }
    })
  }

  const handleFavorite = () => { if (!isLoggedIn) return requireLogin(); Taro.showToast({ title: '收藏功能开发中', icon: 'none' }) }
  const handleCorrect = () => { if (!isLoggedIn) return requireLogin(); Taro.showToast({ title: '纠错功能开发中', icon: 'none' }) }
  const goMerchant = (mid: string) => Taro.navigateTo({ url: `/pages/merchant/merchantDetail?id=${mid}` })
  const goBearing = (bid: string) => Taro.navigateTo({ url: `/pages/home/bearingDetail?id=${bid}` })

  const img = usableImage(detail?.image3DUrl) || usableImage(detail?.image2DUrl)

  return (
    <PageLayout nav={<NavBar title="轴承详情" showBack />}>
      <View className='bd'>
        {/* 头部：图片 + 型号 + 品牌类型 */}
        <View className='bd-hero' style={{ backgroundColor: t.bgCard }}>
          {img ? (
            <Image className='bd-img' src={img} mode='aspectFit' />
          ) : (
            <View className='bd-img-placeholder' style={{ backgroundColor: t.bgInput }}>
              <Icon name="package" size={40} color={t.textTertiary} />
            </View>
          )}
          <Text className='bd-part' style={{ ...fs(22), color: t.textPrimary }}>{detail?.partNumber || '—'}</Text>
          {detail?.oldNumber ? <Text className='bd-old' style={{ ...fs(13), color: t.textTertiary }}>旧型号：{detail.oldNumber}</Text> : null}
          <Text className='bd-sub' style={{ ...fs(14), color: t.textSecondary }}>{detail?.bearingType}{detail?.brandName ? ` · ${detail.brandName}` : ''}</Text>
          {detail?.englishName ? <Text className='bd-sub' style={{ ...fs(12), color: t.textTertiary }}>{detail.englishName}</Text> : null}
        </View>

        {/* 基本参数 */}
        <View className='bd-card' style={{ backgroundColor: t.bgCard }}>
          <Text className='bd-card-title' style={{ ...fs(15), color: t.textPrimary }}>基本参数</Text>
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

        {/* 在售商家 */}
        <View className='bd-card' style={{ backgroundColor: t.bgCard }}>
          <Text className='bd-card-title' style={{ ...fs(15), color: t.textPrimary }}>在售商家（{merchants.length}）</Text>
          {merchants.length === 0 && <Text className='bd-empty' style={{ ...fs(13), color: t.textTertiary }}>暂无在售商家</Text>}
          {merchants.map((m) => (
            <View key={m.merchantId} className='bd-list-row' onClick={() => goMerchant(m.merchantId)}>
              <View className='bd-list-avatar' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="store" size={18} color={t.primary} />
              </View>
              <View className='bd-list-main'>
                <Text className='bd-list-name' style={{ ...fs(15), color: t.textPrimary }}>{m.merchantName}</Text>
                {m.price ? <Text className='bd-list-sub' style={{ ...fs(12), color: t.textSecondary }}>{m.price}</Text> : null}
              </View>
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>
          ))}
        </View>

        {/* 替代品 */}
        {interchanges.length > 0 && (
          <View className='bd-card' style={{ backgroundColor: t.bgCard }}>
            <Text className='bd-card-title' style={{ ...fs(15), color: t.textPrimary }}>替代品</Text>
            {interchanges.map((it) => (
              <View key={it.id} className='bd-list-row' onClick={() => goBearing(it.id)}>
                <View className='bd-list-main'>
                  <Text className='bd-list-name' style={{ ...fs(15), color: t.textPrimary }}>{it.partNumber}</Text>
                  <Text className='bd-list-sub' style={{ ...fs(12), color: t.textTertiary }}>{it.brandName} · {it.bearingType} · 置信度 {it.confidence}</Text>
                </View>
                <Icon name="chevron_right" size={18} color={t.textTertiary} />
              </View>
            ))}
          </View>
        )}

        {/* 操作：收藏 / 纠错（登录门槛） */}
        <View className='bd-actions'>
          <View className='bd-btn' style={{ backgroundColor: t.primary }} onClick={handleFavorite}>
            <Icon name="heart" size={18} color={t.textOnPrimary} />
            <Text className='bd-btn-text' style={{ ...fs(15), color: t.textOnPrimary }}>收藏</Text>
          </View>
          <View className='bd-btn-ghost' style={{ borderColor: t.border }} onClick={handleCorrect}>
            <Icon name="edit" size={18} color={t.textSecondary} />
            <Text className='bd-btn-ghost-text' style={{ ...fs(15), color: t.textSecondary }}>纠错</Text>
          </View>
        </View>
      </View>
    </PageLayout>
  )
}
