import { View, Text } from '@tarojs/components'

/** 价格标签：显示价格文本 + 可选议价标识 */
export default function PriceTag({
  price,
  negotiable = false,
  showNegotiableLabel = true,
  needLogin = false,
}: {
  price?: string | null
  negotiable?: boolean
  showNegotiableLabel?: boolean
  needLogin?: boolean
}) {
  if (needLogin) {
    return (
      <View className='price-tag'>
        <Text className='price-tag__login-hint'>登录查看</Text>
      </View>
    )
  }

  if (!price) {
    return (
      <View className='price-tag'>
        <Text className='price-tag__empty'>-</Text>
      </View>
    )
  }

  return (
    <View className='price-tag'>
      <Text className='price-tag__value'>{price}</Text>
      {negotiable && showNegotiableLabel && (
        <Text className='price-tag__negotiable'>[议价]</Text>
      )}
    </View>
  )
}
