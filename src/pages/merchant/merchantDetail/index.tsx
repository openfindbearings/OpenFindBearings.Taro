import { View, Text, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Store, Package } from 'lucide-react-taro'
import { getMerchantDetail, getMerchantBearings, type Merchant, type MerchantBearing } from '../../../services/merchant'
import EmptyState from '../../../components/EmptyState'
import MerchantBadge from '../../../components/MerchantBadge'
import PriceTag from '../../../components/PriceTag'

/** 商家详情页 */
export default function MerchantDetailPage() {
  const router = useRouter()
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [bearings, setBearings] = useState<MerchantBearing[]>([])
  const [loading, setLoading] = useState(true)

  const id = router.params.id || ''

  useEffect(() => {
    if (!id) return
    Promise.all([
      getMerchantDetail(id).catch(() => null),
      getMerchantBearings(id, 1, 50).catch((e) => e),
    ]).then(([m, b]) => {
      setMerchant(m)
      if (b && typeof b === 'object' && 'items' in b) {
        setBearings((b as { items: MerchantBearing[] }).items || [])
      }
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <View className='detail-page'><Text>加载中...</Text></View>
  }

  if (!merchant) {
    return <EmptyState text='商家不存在' icon={Store} />
  }

  return (
    <View className='detail-page merchant-detail'>
      {/* 商家基本信息 */}
      <View className='detail-section'>
        <View className='merchant-detail__header'>
          <Text className='merchant-detail__name'>{merchant.name}</Text>
          <MerchantBadge verified={merchant.isVerified} />
        </View>
        {merchant.description && (
          <Text className='merchant-detail__desc'>{merchant.description}</Text>
        )}
        {merchant.phone && (
          <View className='detail-row'>
            <Text className='detail-row__label'>联系电话</Text>
            <Text className='detail-row__value'>{merchant.phone}</Text>
          </View>
        )}
      </View>

      {/* 在售商品 */}
      <View className='detail-section'>
        <Text className='detail-section__title'>在售商品 ({bearings.length})</Text>
        {bearings.length === 0 ? (
          <EmptyState text='暂无在售商品' icon={Package} />
        ) : (
          <View className='bearing-list'>
            {bearings.map((b) => (
              <View
                key={b.bearingId}
                className='bearing-list__item'
                onClick={() => Taro.navigateTo({ url: `/pages/home/bearingDetail/index?id=${b.bearingId}` })}
              >
                <View className='bearing-list__info'>
                  <Text className='bearing-list__model'>{b.bearingPartNumber}</Text>
                  <Text className='bearing-list__brand'>{b.brandName || ''}</Text>
                </View>
                <PriceTag price={b.price} />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}
