// PageLayout 页面骨架 —— H5 / 小程序版
// 普通文档流：nav 用 sticky 钉顶、内容自然高随文档滚动、tabbar 用 fixed 钉底。
// 不用 ScrollView 的 flex 撑满——Taro H5 的 ScrollView 内容容器是 flex 列且忽略 contentContainerStyle，
// 会把各区块沿主轴（纵向）拉伸填满（图标文字拉开、标签成高条）。sticky/fixed 在 H5/小程序支持、RN 不支持，
// 故独立成此文件与 .rn 版分离，各写各的、互不污染。
// 改动说明：按"各平台各自独立"原则新建。
import { View } from '@tarojs/components'
import { ReactNode } from 'react'
import { useTheme } from '../hooks/useTheme'
import './PageLayout.scss'

interface PageLayoutProps {
  /** 顶部导航栏节点（NavBar 元素），null/缺省则不渲染顶栏（简洁模式首页） */
  nav?: ReactNode
  /** 底部标签栏节点（CustomTabBar 元素），缺省则不渲染（设置/搜索等非 tab 页） */
  tabbar?: ReactNode
  /** 页面内容（普通块级流，随文档滚动） */
  children: ReactNode
  /** 是否允许内容滚动（H5 文档默认可滚，此参数仅为与 RN 版接口对齐） */
  scrollY?: boolean
}

export default function PageLayout({ nav, tabbar, children }: PageLayoutProps) {
  // 页面底色随主题模式运行时切换
  const t = useTheme()
  return (
    <View className='pl-h5' style={{ backgroundColor: t.bgPage }}>
      {nav ? <View className='pl-h5-nav' style={{ backgroundColor: t.bgPage }}>{nav}</View> : null}
      {/* 有底栏时给内容底部留白，避免 fixed tabbar 遮住最后一条内容（tabbar 高 56 + 余量） */}
      <View className='pl-h5-body' style={{ paddingBottom: tabbar ? 64 : 0 }}>
        {children}
      </View>
      {tabbar ? <View className='pl-h5-tabbar'>{tabbar}</View> : null}
    </View>
  )
}
