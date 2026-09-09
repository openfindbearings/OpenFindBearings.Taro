// PageLayout 页面骨架 —— RN 版（纯 RN，不掺任何其它平台判断）
// 结构：flex column 三段式 nav（固定高）→ ScrollView 内容（flex:1，contentContainer flexGrow:1 撑满供垂直居中）→ tabbar（固定高）。
// RN 不支持 vh，页面根高度由 getWindowHeight() inline 注入 windowHeight（dp）。
// 改动说明：按"各平台各自独立"原则从 components/PageLayout 拆出，此文件保持拆分前 RN 原实现不变。
import { View, ScrollView } from '@tarojs/components'
import { ReactNode } from 'react'
import { getWindowHeight } from '../utils/safe-area'
import { useTheme } from '../hooks/useTheme'
import './PageLayout.rn.scss'

interface PageLayoutProps {
  /** 顶部导航栏节点（NavBar 元素），null/缺省则不渲染顶栏（简洁模式首页） */
  nav?: ReactNode
  /** 底部标签栏节点（CustomTabBar 元素），缺省则不渲染（设置/搜索等非 tab 页） */
  tabbar?: ReactNode
  /** 页面内容（自动包在滚动区内） */
  children: ReactNode
  /** 是否允许内容滚动（默认 true） */
  scrollY?: boolean
}

export default function PageLayout({ nav, tabbar, children, scrollY = true }: PageLayoutProps) {
  // RN 根节点显式高度 = windowHeight（dp，inline 不缩放）
  const h = getWindowHeight()
  // 页面底色随主题模式运行时切换，inline 覆盖 scss 静态 $bg-page
  const t = useTheme()
  const rootStyle = { backgroundColor: t.bgPage, ...(h > 0 ? { height: h } : {}) }

  return (
    <View className='page-layout' style={rootStyle}>
      {nav}
      <ScrollView className='page-layout-scroll' scrollY={scrollY} contentContainerStyle={{ flexGrow: 1 }}>
        {children}
      </ScrollView>
      {tabbar}
    </View>
  )
}
