import { View, Text, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Search, Store } from 'lucide-react-taro'
import { getBearingDetail, getBearingMerchants, type Bearing, type BearingMerchant } from '../../../services/bearing'
import EmptyState from '../../../components/EmptyState'
import PriceTag from '../../../components/PriceTag'

/** 轴承详情页 */
export default function BearingDetailPage() {
  const router = useRouter()
  const [bearing, setBearing] = useState<Bearing | null>(null)
  const [merchants, setMerchants] = useState<BearingMerchant[]>([])
  const [loading, setLoading] = useState(true)

  const id = router.params.id || ''

  useEffect(() => {
    if (!id) return
    Promise.all([
      getBearingDetail(id).catch(() => null),
      getBearingMerchants(id, 1, 50).catch((e) => e),
    ]).then(([b, m]) => {
      setBearing(b)
      if (m && typeof m === 'object' && 'items' in m) {
        setMerchants((m as { items: BearingMerchant[] }).items || [])
      }
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <View className='detail-page'><Text>加载中...</Text></View>
  }

  if (!bearing) {
    return <EmptyState text='轴承不存在' icon={Search} />
  }

  return (
    <View className='detail-page bearing-detail'>
      {/* 轴承图片 */}
      {(bearing.image3dUrl || bearing.image2dUrl) && (
        <View className='bearing-detail__image'>
          <Image
            src={bearing.image3dUrl || bearing.image2dUrl || ''}
            mode='aspectFit'
            className='bearing-detail__img'
          />
        </View>
      )}

      {/* 基本信息 */}
      <View className='detail-section'>
        <Text className='detail-section__title'>{bearing.partNumber}</Text>
        {bearing.oldNumber && (
          <Text className='detail-section__subtitle'>曾用代号: {bearing.oldNumber}</Text>
        )}
        <View className='detail-row'>
          <Text className='detail-row__label'>品牌</Text>
          <Text className='detail-row__value'>{bearing.brandName || '-'}</Text>
        </View>
        <View className='detail-row'>
          <Text className='detail-row__label'>类型</Text>
          <Text className='detail-row__value'>{bearing.bearingType || '-'}</Text>
        </View>
      </View>

      {/* 尺寸参数 */}
      <View className='detail-section'>
        <Text className='detail-section__title'>尺寸参数</Text>
        <View className='detail-grid'>
          <View className='detail-grid__item'>
            <Text className='detail-grid__label'>内径</Text>
            <Text className='detail-grid__value'>{bearing.innerDiameter ?? '-'} mm</Text>
          </View>
          <View className='detail-grid__item'>
            <Text className='detail-grid__label'>外径</Text>
            <Text className='detail-grid__value'>{bearing.outerDiameter ?? '-'} mm</Text>
          </View>
          <View className='detail-grid__item'>
            <Text className='detail-grid__label'>宽度</Text>
            <Text className='detail-grid__value'>{bearing.width ?? '-'} mm</Text>
          </View>
          <View className='detail-grid__item'>
            <Text className='detail-grid__label'>动载荷</Text>
            <Text className='detail-grid__value'>{bearing.dynamicLoad ?? '-'} kN</Text>
          </View>
          <View className='detail-grid__item'>
            <Text className='detail-grid__label'>静载荷</Text>
            <Text className='detail-grid__value'>{bearing.staticLoad ?? '-'} kN</Text>
          </View>
          <View className='detail-grid__item'>
            <Text className='detail-grid__label'>重量</Text>
            <Text className='detail-grid__value'>{bearing.weight ?? '-'} kg</Text>
          </View>
        </View>
      </View>

      {/* 在售商家 */}
      <View className='detail-section'>
        <Text className='detail-section__title'>在售商家 ({merchants.length})</Text>
        {merchants.length === 0 ? (
          <EmptyState text='暂无商家在售' icon={Store} />
        ) : (
          <View className='merchant-list'>
            {merchants.map((m) => (
              <View
                key={m.merchantId}
                className='merchant-list__item'
                onClick={() => Taro.navigateTo({ url: `/pages/merchant/merchantDetail/index?id=${m.merchantId}` })}
              >
                <Text className='merchant-list__name'>{m.merchantName}</Text>
                <PriceTag price={m.price} />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}
