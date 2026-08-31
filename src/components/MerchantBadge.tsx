import { View, Text } from '@tarojs/components'

/** 商家认证标识 */
export default function MerchantBadge({ verified = false }: { verified?: boolean }) {
  if (!verified) return null
  return (
    <View className='merchant-badge'>
      <Text className='merchant-badge__text'>已认证</Text>
    </View>
  )
}
