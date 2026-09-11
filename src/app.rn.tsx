// RN 端专属全局入口（v1.7.0 安全区标准改造）
// 背景：Taro RN 不内置 SafeAreaProvider，若按标准 RN 做法需要在应用根包一层
// SafeAreaProvider，NavBar/TabBar 才能用 useSafeAreaInsets() 取状态栏与底部内缩。
// 此文件为 .rn.tsx 平台入口，仅 RN 端构建被解析（H5/小程序仍走 app.tsx），
// 避免在共享入口引入 react-native-safe-area-context 导致跨端解析失败。
// 改动说明：相较 app.tsx，仅 render 外层包 SafeAreaProvider，启动逻辑经 appShared 完全一致。
// 原文件缺 boot 接线（登录态恢复/隐私弹窗/主题字体初始化全都没跑），冷启动丢登录态的根因
import { Component, PropsWithChildren } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { bootOnce, preloadMerchantState } from './appShared'
import './app.scss'

class App extends Component<PropsWithChildren> {
  componentDidMount() {
    bootOnce()
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