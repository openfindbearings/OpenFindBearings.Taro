import { View, Text } from '@tarojs/components'

/** 设置页（预留） */
export default function SettingsPage() {
  return (
    <View className='settings-page'>
      <View className='settings-section'>
        <View className='settings-item'>
          <Text className='settings-item__label'>版本</Text>
          <Text className='settings-item__value'>v1.0.0</Text>
        </View>
        <View className='settings-item'>
          <Text className='settings-item__label'>清除缓存</Text>
          <Text className='settings-item__value'>-</Text>
        </View>
        <View className='settings-item'>
          <Text className='settings-item__label'>关于我们</Text>
          <Text className='settings-item__value'>OpenFindBearings</Text>
        </View>
      </View>
    </View>
  )
}
