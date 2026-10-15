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
// 改动说明（v2.13.2 菜单收敛）：列表与路由改由共享 ./menu 提供，消除与我的页四宫格的分叉
import { MY_MENU_ITEMS, MY_MENU_ROUTES } from './menu'

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

// 全部功能列表（唯一数据源见 ./menu）
const featureList = MY_MENU_ITEMS

export default function AllFeaturesPage() {
  // 全局字号缩放 + 主题色板
  const fs = useFs()
  const t = useTheme()
  const handleClick = (key: string) => {
    const url = MY_MENU_ROUTES[key]
    if (url) {
      Taro.navigateTo({ url })
      return
    }
    Taro.showToast({ title: '功能暂未上线', icon: 'none' })
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
