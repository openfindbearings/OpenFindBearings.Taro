// RN 端专属全局入口（v1.7.0 安全区标准改造）
// 背景：Taro RN 不内置 SafeAreaProvider，若按标准 RN 做法需要在应用根包一层
// SafeAreaProvider，NavBar/TabBar 才能用 useSafeAreaInsets() 取状态栏与底部内缩。
// 此文件为 .rn.tsx 平台入口，仅 RN 端构建被解析（H5/小程序仍走 app.tsx），
// 避免在共享入口引入 react-native-safe-area-context 导致跨端解析失败。
// 改动说明：相较 app.tsx，仅 render 外层包 SafeAreaProvider，其余逻辑一致。
import { Component, PropsWithChildren } from 'react'
import Taro from '@tarojs/taro'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { getItem } from './utils/storage'
import './app.scss'

// 预读商家入驻状态存入 globalData，供 CustomTabBar 首次渲染时同步读取
// 修复商家 tab 冷启动时图标从普通样式跳变为大圆 logo 的闪烁问题
function preloadMerchantState() {
  Promise.all([
    getItem('merchant_approved'),
    getItem('merchant_logo'),
    getItem('merchant_name')
  ]).then(([approved, logo, name]) => {
    const app = Taro.getApp() as any
    if (app) {
      app.globalData = app.globalData || {}
      // 严格字符串比较（getItem 恒返回 string|null），避免 "false" 字符串被 !! 判为 true
      app.globalData.merchantApproved = approved === 'true'
      app.globalData.merchantLogo = logo || null
      app.globalData.merchantName = name || '商家'
    }
  }).catch(() => { /* 读取失败时 CustomTabBar 自行兜底，默认未入驻 */ })
}

class App extends Component<PropsWithChildren> {
  componentDidMount() {
    preloadMerchantState()
  }

  componentDidShow() {
    preloadMerchantState()
  }

  render() {
    // 标准 RN：根节点由 SafeAreaProvider 包裹，安全区内缩经 useSafeAreaInsets() 获取
    return <SafeAreaProvider>{this.props.children}</SafeAreaProvider>
  }
}
export default App