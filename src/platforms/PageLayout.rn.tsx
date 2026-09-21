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
  /**
   * 沉浸式（v1.7.11 渐变头部）：nav 从 flex 占位改为 absolute 覆盖层，
   * 内容顶到屏幕最上（延伸到状态栏下）；滚动距离经 onScrollY 回调供页面控制 nav 浮现。
   */
  immersive?: boolean
  /** 内容滚动回调（immersive 时生效，参数为 scrollTop dp） */
  onScrollY?: (scrollTop: number) => void
}

export default function PageLayout({ nav, tabbar, children, scrollY = true, immersive, onScrollY }: PageLayoutProps) {
  // RN 根节点显式高度 = windowHeight（dp，inline 不缩放）
  const h = getWindowHeight()
  // 页面底色随主题模式运行时切换，inline 覆盖 scss 静态 $bg-page
  const t = useTheme()
  const rootStyle = { backgroundColor: t.bgPage, ...(h > 0 ? { height: h } : {}) }

  // 改动说明（v1.7.11）：沉浸式分支——ScrollView 绝对铺满整屏，nav 覆盖层钉顶（不占布局），
  //   onScroll 驱动页面侧 nav 透明度；tabbar 仍为最上层兄弟节点（自身即 absolute）
  if (immersive) {
    return (
      <View className='page-layout' style={rootStyle}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
          {/* scrollEventThrottle 为 RN-only prop，Taro 类型未声明，spread as any 过 tsc 门禁 */}
          <ScrollView
            style={{ flex: 1 }}
            {...({ scrollY, onScroll: (e: any) => onScrollY?.(e?.detail?.scrollTop ?? 0), scrollEventThrottle: 16 } as any)}
            // tabbar 为覆盖层后内容底部需自行留白（56 高 + 余量），否则最后卡片被盖住
            contentContainerStyle={{ flexGrow: 1, paddingBottom: tabbar ? 80 : 0 }}
          >
            {children}
          </ScrollView>
        </View>
        {nav ? <View style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>{nav}</View> : null}
        {/* 改动说明（v1.7.11 修复）：immersive 下 ScrollView/nav 均为 absolute 不占布局，
            tabbar 若留在流内会被顶到列首（真机现象：TabBar 跑到屏幕顶上）——同样 absolute 钉底 */}
        {tabbar ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>{tabbar}</View> : null}
      </View>
    )
  }

  return (
    <View className='page-layout' style={rootStyle}>
      {nav}
      {/* 改动说明（v1.7.2）：scrollY 为 RN-only prop，Taro 类型未声明，spread as any 过 tsc 门禁 */}
      <ScrollView className='page-layout-scroll' {...({ scrollY } as any)} contentContainerStyle={{ flexGrow: 1 }}>
        {children}
      </ScrollView>
      {tabbar}
    </View>
  )
}
