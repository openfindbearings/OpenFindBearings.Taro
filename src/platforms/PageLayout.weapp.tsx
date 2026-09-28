// PageLayout 页面骨架 —— 微信小程序版
// 改动说明（v1.7.19 weapp 适配）：全部页面 definePageConfig({ disableScroll: true })
//   是为 RN createScrollPage 写的，weapp 同样生效 → 小程序端文档流无法滚动，
//   H5 版（文档流 + sticky/fixed）骨架在 weapp 上内容超一屏即滚不动。
//   本文件改用 flex column + ScrollView 结构（与 RN 版同构）：
//   nav → subHeader（滚动区外天然固定）→ ScrollView(flex:1 内容) → tabbar（流内末子项钉底）。
//   definePageConfig 的 disableScroll 在此结构下反而是正确前提（页面级禁滚、内部 ScrollView 滚动）。
import { View, ScrollView } from '@tarojs/components'
import { ReactNode } from 'react'
import { useTheme } from '../hooks/useTheme'
import './PageLayout.weapp.scss'

interface PageLayoutProps {
  /** 顶部导航栏节点（NavBar 元素），null/缺省则不渲染顶栏（简洁模式首页） */
  nav?: ReactNode
  /** 底部标签栏节点（CustomTabBar 元素），缺省则不渲染（设置/搜索等非 tab 页） */
  tabbar?: ReactNode
  /** 导航栏下方的吸顶区（首页搜索框）：渲染在 ScrollView 外，天然固定不滚走 */
  subHeader?: ReactNode
  /** 页面内容（自动包在滚动区内） */
  children: ReactNode
  /** 是否允许内容滚动（与 RN 版接口对齐） */
  scrollY?: boolean
  /**
   * 沉浸式（渐变头部）：内容 ScrollView 铺满整屏顶到状态栏下，
   * nav/subHeader 以 absolute 覆盖层钉顶；滚动距离经 onScrollY 回调供页面控制 nav 浮现
   */
  immersive?: boolean
  /** 内容滚动回调（immersive 时生效，参数为 scrollTop px） */
  onScrollY?: (scrollTop: number) => void
}

export default function PageLayout({ nav, tabbar, children, scrollY = true, immersive, onScrollY, subHeader }: PageLayoutProps) {
  // 页面底色随主题模式运行时切换
  const t = useTheme()

  if (immersive) {
    return (
      <View className='pl-wx' style={{ backgroundColor: t.bgPage }}>
        {/* 内容铺满整屏（absolute 不占布局），底部留白防被 tabbar 盖住 */}
        <View className='pl-wx-abs'>
          <ScrollView
            className='pl-wx-scroll'
            {...({
              scrollY,
              onScroll: (e: any) => onScrollY?.(e?.detail?.scrollTop ?? 0),
              scrollEventThrottle: 16
            } as any)}
          >
            <View style={{ paddingBottom: tabbar ? 80 : 0 }}>{children}</View>
          </ScrollView>
        </View>
        {nav || subHeader ? (
          <View className='pl-wx-overlay-top' style={{ backgroundColor: 'transparent' }}>
            {nav}
            {subHeader}
          </View>
        ) : null}
        {tabbar ? <View className='pl-wx-overlay-bottom'>{tabbar}</View> : null}
      </View>
    )
  }

  return (
    <View className='pl-wx' style={{ backgroundColor: t.bgPage }}>
      {nav ? <View style={{ backgroundColor: t.bgPage }}>{nav}</View> : null}
      {/* 吸顶子区在滚动区外：不随内容滚动（与 RN 版一致） */}
      {subHeader}
      <ScrollView className='pl-wx-scroll' {...({ scrollY } as any)}>
        {/* 有底栏时内容底部留白（tabbar 高 56 + 余量），fixed 底栏会盖住最后内容 */}
        <View style={{ paddingBottom: tabbar ? 64 : 0 }}>{children}</View>
      </ScrollView>
      {tabbar}
    </View>
  )
}
