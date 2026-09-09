// 全部功能页：列出所有功能入口（收藏/关注/历史/消息/设置）
// v1.7.0 度量重构：接入 PageLayout（删 rnHeight/自管 ScrollView hack）
// 从我的页"全部功能"按钮进入，功能比四宫格更全（含消息中心、设置）
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useFs } from '../../hooks/useFontScale'
import { useTheme } from '../../hooks/useTheme'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import './all-features.scss'

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

// 全部功能列表
const featureList = [
  { key: 'favorites', label: '收藏轴承', desc: '我收藏的轴承型号', icon: 'heart', color: '#EF4444' },
  { key: 'followed', label: '关注商家', desc: '我关注的商家', icon: 'users', color: '#0EA5E9' },
  { key: 'history', label: '浏览历史', desc: '最近浏览记录', icon: 'clock', color: '#10B981' },
  { key: 'messages', label: '消息中心', desc: '系统通知与消息', icon: 'bell', color: '#F59E0B' },
  { key: 'settings', label: '设置', desc: '通用设置与隐私', icon: 'settings', color: '#64748B' }
]

export default function AllFeaturesPage() {
  // 全局字号缩放 + 主题色板
  const fs = useFs()
  const t = useTheme()
  const handleClick = (key: string) => {
    if (key === 'settings') {
      Taro.navigateTo({ url: '/pages/my/settings' })
      return
    }
    Taro.showToast({ title: '功能开发中', icon: 'none' })
  }

  return (
    <PageLayout nav={<NavBar title='全部功能' showBack />}>
      {featureList.map((item) => (
        <View
          key={item.key}
          className='feature-item'
          style={{ backgroundColor: t.bgCard }}
          onClick={() => handleClick(item.key)}
        >
          {/* 图标底用 inline 半透明色（8 位 hex 尾缀透明度），RN 支持 */}
          <View className='feature-icon' style={{ backgroundColor: item.color + '20' }}>
            <Icon name={item.icon} size={24} color={item.color} />
          </View>
          <View className='feature-info'>
            <Text className='feature-label' style={{ ...fs(15), color: t.textPrimary }}>{item.label}</Text>
            <Text className='feature-desc' style={{ ...fs(13), color: t.textTertiary }}>{item.desc}</Text>
          </View>
          <Icon name='chevron_right' size={20} color={t.textTertiary} />
        </View>
      ))}
    </PageLayout>
  )
}
