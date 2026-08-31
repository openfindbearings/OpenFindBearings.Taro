import { View, Text } from '@tarojs/components'
import type { MyMerchantProfile } from '../../../services/merchantManage'

/** 审核中状态 */
export default function PendingStatus({ profile }: { profile: MyMerchantProfile }) {
  return (
    <View className='pending-status'>
      <View className='pending-status__icon'>⏳</View>
      <Text className='pending-status__title'>入驻审核中</Text>
      <Text className='pending-status__desc'>
        您的入驻申请已提交，正在等待审核。
      </Text>
      <View className='pending-status__info'>
        <View className='pending-status__row'>
          <Text className='pending-status__label'>店铺名称</Text>
          <Text className='pending-status__value'>{profile.name}</Text>
        </View>
        <View className='pending-status__row'>
          <Text className='pending-status__label'>联系人</Text>
          <Text className='pending-status__value'>{profile.contact || '-'}</Text>
        </View>
        <View className='pending-status__row'>
          <Text className='pending-status__label'>联系电话</Text>
          <Text className='pending-status__value'>{profile.phone || '-'}</Text>
        </View>
      </View>
      <Text className='pending-status__tip'>审核通过后即可管理您的店铺和商品</Text>
    </View>
  )
}
