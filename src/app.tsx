// 全局入口组件（v1.7.0 度量重构，纯 RN 基准）
// 职责：启动时预读商家入驻状态供 CustomTabBar 同步渲染（防首帧图标跳变闪烁）
// 改动说明：
//   1. 删除 initTheme / applyFontSize（H5 深色模式与 localStorage 遗留——
//      RN 无 window.localStorage，此前靠 try/catch 吞异常；本轮 RN 锁浅色，整链移除）；
//   2. 主题/字体大小的 H5 实现归入第二阶段（做 H5 时按平台重新接入）；
//   3. app.scss 仅保留跨端安全的全局样式（无 var()/媒体查询，RN Metro 可解析）。
import { Component, PropsWithChildren } from 'react'
import Taro from '@tarojs/taro'
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
    return this.props.children
  }
}
export default App
