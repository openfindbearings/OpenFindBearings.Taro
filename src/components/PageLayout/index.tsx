// PageLayout 页面骨架组件（v1.7.0 度量重构新建，审核 P2-10 采纳）
// 职责：统一五页的 "顶栏 + 滚动内容 + 底栏" flex column 骨架，
// 页面根高度（RN 需显式 dp 高度，不支持 vh）与安全区口径只在此处定义一次。
// 用法：
//   <PageLayout nav={<NavBar .../>} tabbar={<CustomTabBar current="home" />}>
//     {内容}
//   </PageLayout>
// 简洁模式首页传 nav={null}（无顶栏）；非 tab 页不传 tabbar。
// 改动说明：替代各页重复的 inline rnHeight hack 与 padding-bottom:74px 避让 hack。
import { View, ScrollView } from '@tarojs/components'
import { ReactNode } from 'react'
import { getWindowHeight } from '../../utils/safe-area'
import './index.scss'

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
  // RN 端根节点显式高度 = windowHeight（dp，inline 不缩放）；H5/小程序返回 0 走 CSS flex 撑满
  const h = getWindowHeight()
  const rootStyle = h > 0 ? { height: h } : undefined

  return (
    <View className='page-layout' style={rootStyle}>
      {nav}
      {/* contentContainerStyle flexGrow:1：内容容器至少撑满视口高度，
          使占位页/简洁首页的子元素可用 flex:1 实现真正的垂直居中；
          内容超视口时容器自然随内容增高，不影响普通页滚动。 */}
      <ScrollView className='page-layout-scroll' scrollY={scrollY} contentContainerStyle={{ flexGrow: 1 }}>
        {children}
      </ScrollView>
      {tabbar}
    </View>
  )
}
