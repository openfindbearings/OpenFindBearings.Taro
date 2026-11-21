// 商城商品详情页（v1.4.26 批次一）：商家 x 商品维度的单品页。
// 与型号详情页的区别：型号详情是「找货」（聚合多家商家，主按钮寻货）；
// 本页供给唯一，主按钮是对这家商家一对一询价；底部常驻条为 店铺 / 分享 / 询价邀请。
import { useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../../components/Icon'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import ShareButton from '../../components/ShareButton'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { useAuthStore } from '../../stores/auth'
import { setObject } from '../../utils/storage'
import { openMerchant } from '../../utils/merchantNav'
import { showTip } from '../../utils/toast'
import { getMallItemDetail, type MallItemDetail } from '../../services/mall'

const PREFILL_KEY = 'sourcing_publish_prefill'

/** 商家牌级枚举名 → 中文展示名 */
const GRADE_LABEL: Record<string, string> = {
  Ordinary: '普通',
  Bronze: '铜牌',
  Silver: '银牌',
  Gold: '金牌',
}

/**
 * 商城商品详情页：展示单条商家货源，底部常驻 店铺 / 分享 / 询价邀请。
 */
export default function MallProductPage() {
  const t = useTheme()
  const fs = useFs()
  const id = Taro.getCurrentInstance().router?.params?.id || ''
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [detail, setDetail] = useState<MallItemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    let alive = true
    getMallItemDetail(id)
      .then((d) => { if (alive) setDetail(d) })
      .catch(() => { if (alive) setDetail(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id])

  const item = detail?.item
  const merchant = detail?.merchant

  // 图片列表：商家实拍图优先，无商家图回退型号封面
  const images = (item?.merchantImageUrls?.length ? item.merchantImageUrls : [item?.coverImageUrl || item?.image3DUrl || item?.image2DUrl]).filter(Boolean) as string[]

  /** 一对一询价：预填型号/品牌/bearingId + 仅邀请该商家，跳发布页 */
  const handleInquire = async () => {
    if (!item || !merchant) return
    if (!isLoggedIn) {
      const ok = await showConfirmDialog({ title: '提示', content: '该功能需登录后使用', confirmText: '去登录' })
      if (ok) Taro.navigateTo({ url: '/pages/auth/login' })
      return
    }
    await setObject(PREFILL_KEY, {
      partNumber: item.bearingPartNumber,
      brand: item.brandName || '',
      bearingId: item.bearingId,
      visibility: 1,
      invitedMerchantIds: [item.merchantId],
    })
    Taro.navigateTo({ url: '/pages/discover/publish' })
  }

  /** 价格文案：不可见时提示登录，否则用商家填写的价格描述或数值价 */
  const priceText = () => {
    if (!item) return ''
    if (!item.isPriceVisible) return '登录后可见'
    if (item.priceDescription) return item.priceDescription
    if (item.numericPrice != null) return `¥${item.numericPrice}`
    return '电议'
  }

  const actionFooter = (
    <View style={{ backgroundColor: t.bgCard, borderTopWidth: 1, borderTopColor: t.border, paddingLeft: 6, paddingRight: 12, paddingTop: 8, paddingBottom: 8, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 52, display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={() => merchant && void openMerchant(merchant.id)}>
        <Icon name="store" size={20} color={t.textSecondary} />
        <Text style={{ ...fs(11), color: t.textSecondary, marginTop: 4 }}>店铺</Text>
      </View>
      {item && merchant ? (
        <ShareButton
          title={`${item.bearingPartNumber}${item.brandName ? ' · ' + item.brandName : ''} · ${merchant.name} 报价`}
          path={`/s/bearing/${item.bearingId}?view=supply`}
          label="分享"
          color={t.textSecondary}
          column
        />
      ) : null}
      <View
        style={{ flex: 1, marginLeft: 8, height: 44, borderRadius: 22, backgroundColor: t.primary, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => void handleInquire()}
      >
        <Icon name="message-circle" size={16} color={t.textOnPrimary} />
        <Text style={{ ...fs(15), fontWeight: 'bold', color: t.textOnPrimary, marginLeft: 6 }}>询价邀请</Text>
      </View>
    </View>
  )

  return (
    <PageLayout nav={<NavBar title="商品详情" showBack />} footer={actionFooter}>
      <View style={{ paddingBottom: 12 }}>
        {loading && (
          <View style={{ paddingTop: 60, display: 'flex', alignItems: 'center' }}>
            <Text style={{ ...fs(14), color: t.textTertiary }}>加载中…</Text>
          </View>
        )}

        {!loading && !detail && (
          <View style={{ paddingTop: 60, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Icon name="package-x" size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 10 }}>商品不存在或已下架</Text>
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>可能已被商家下架或尚未通过审核</Text>
          </View>
        )}

        {detail && item && merchant && (
          <>
            {/* 图片区：商家实拍图优先，可点缩略图切换 */}
            <View style={{ backgroundColor: t.bgCard, paddingTop: 12, paddingBottom: 8 }}>
              {images.length > 0 ? (
                <Image
                  src={images[Math.min(activeImage, images.length - 1)]}
                  mode='aspectFit'
                  style={{ width: '100%', height: 300, backgroundColor: '#FFFFFF' }}
                />
              ) : (
                <View style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: t.bgInput }}>
                  <Icon name="image" size={44} color={t.textTertiary} />
                </View>
              )}
              {images.length > 1 && (
                <View style={{ display: 'flex', flexDirection: 'row', paddingLeft: 12, paddingRight: 12, marginTop: 8 }}>
                  {images.map((url, idx) => (
                    <View key={url + idx} onClick={() => setActiveImage(idx)} style={{ marginRight: 8, borderWidth: 2, borderColor: idx === activeImage ? t.primary : 'transparent', borderRadius: 6 }}>
                      <Image src={url} mode='aspectFill' style={{ width: 56, height: 56, borderRadius: 4, backgroundColor: t.bgInput }} />
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 价格与状态 */}
            <View style={{ backgroundColor: t.bgCard, marginTop: 8, padding: 12 }}>
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end' }}>
                <Text style={{ ...fs(24), fontWeight: 'bold', color: t.danger }}>{priceText()}</Text>
                {item.saleState === 2 && (
                  <Text style={{ ...fs(11), color: '#B45309', backgroundColor: '#FEF3C7', borderRadius: 4, paddingLeft: 6, paddingRight: 6, marginLeft: 8, marginBottom: 3 }}>补货中</Text>
                )}
              </View>
              <View style={{ display: 'flex', flexDirection: 'row', marginTop: 8, flexWrap: 'wrap' }}>
                {!!item.stockDescription && <Text style={{ ...fs(12), color: t.textSecondary, marginRight: 12, marginBottom: 4 }}>库存：{item.stockDescription}</Text>}
                {!!item.minOrderDescription && <Text style={{ ...fs(12), color: t.textSecondary, marginRight: 12, marginBottom: 4 }}>起订：{item.minOrderDescription}</Text>}
                {!!item.restockEta && <Text style={{ ...fs(12), color: t.textSecondary, marginRight: 12, marginBottom: 4 }}>补货：{item.restockEta}</Text>}
              </View>
            </View>

            {/* 型号信息 */}
            <View style={{ backgroundColor: t.bgCard, marginTop: 8, padding: 12 }}>
              <Text style={{ ...fs(18), fontWeight: 'bold', color: t.textPrimary }}>{item.bearingPartNumber}</Text>
              <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6 }}>
                {[item.brandName, item.bearingTypeName, item.dimensions].filter(Boolean).join(' · ')}
              </Text>
              {!!item.bearingOldNumber && (
                <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>旧代号：{item.bearingOldNumber}</Text>
              )}
            </View>

            {/* 商家卡：点进店铺 */}
            <View
              style={{ backgroundColor: t.bgCard, marginTop: 8, padding: 12, display: 'flex', flexDirection: 'row', alignItems: 'center' }}
              onClick={() => void openMerchant(merchant.id)}
            >
              {merchant.logoUrl ? (
                <Image src={merchant.logoUrl} mode='aspectFill' style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.bgInput }} />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ ...fs(18), fontWeight: 'bold', color: t.primary }}>{merchant.name.slice(0, 1)}</Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 10, flexShrink: 1 }}>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ ...fs(15), fontWeight: 'bold', color: t.textPrimary, flexShrink: 1 }} numberOfLines={1}>{merchant.name}</Text>
                  {merchant.isVerified && (
                    <Text style={{ ...fs(10), color: t.primary, backgroundColor: t.primaryLight, borderRadius: 4, paddingLeft: 5, paddingRight: 5, marginLeft: 6, flexShrink: 0 }}>已认证</Text>
                  )}
                </View>
                <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
                  {GRADE_LABEL[merchant.grade || ''] || '普通'}商家 · 点击进入店铺
                </Text>
              </View>
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>

            {/* 说明区：商品备注 / 型号说明 / 品牌简介 */}
            {!!item.remarks && (
              <View style={{ backgroundColor: t.bgCard, marginTop: 8, padding: 12 }}>
                <Text style={{ ...fs(14), fontWeight: 'bold', color: t.textPrimary }}>商品说明</Text>
                <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6, lineHeight: 20 }}>{item.remarks}</Text>
              </View>
            )}
            {!!detail.bearingDescription && (
              <View style={{ backgroundColor: t.bgCard, marginTop: 8, padding: 12 }}>
                <Text style={{ ...fs(14), fontWeight: 'bold', color: t.textPrimary }}>型号说明</Text>
                <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6, lineHeight: 20 }}>{detail.bearingDescription}</Text>
              </View>
            )}
            {!!detail.brandDescription && (
              <View style={{ backgroundColor: t.bgCard, marginTop: 8, padding: 12 }}>
                <Text style={{ ...fs(14), fontWeight: 'bold', color: t.textPrimary }}>品牌简介</Text>
                <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6, lineHeight: 20 }}>{detail.brandDescription}</Text>
              </View>
            )}

            <View style={{ padding: 12 }}>
              <Text
                style={{ ...fs(12), color: t.textTertiary }}
                onClick={() => showTip('价格与库存由商家维护，下单前请与商家确认')}
              >
                价格与库存由商家维护，实际成交以商家报价为准
              </Text>
            </View>
          </>
        )}
      </View>
    </PageLayout>
  )
}