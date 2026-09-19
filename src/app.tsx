// 全局入口组件（H5/小程序端；RN 端 Metro 解析 ./app 命中 app.rn.tsx）
// 启动引导逻辑统一收敛在 appShared.ts，本文件只保留组件骨架与全局样式
// 改动说明：原文件内联的 preload/隐私弹窗/主题初始化/auth init 全部迁入 appShared，
// 与 app.rn.tsx 共用，修复"只改本文件 RN 端不生效"的入口漂移问题
import { Component, PropsWithChildren } from 'react'
import { bootOnce, preloadMerchantState } from './appShared'
import ConfirmDialog from './components/ConfirmDialog'
import PrivacyDialog from './components/PrivacyDialog'
import './app.scss'

class App extends Component<PropsWithChildren> {
  componentDidMount() {
    bootOnce()
  }

  componentDidShow() {
    preloadMerchantState()
  }

  render() {
    // 改动说明：挂载全局自绘弹窗宿主（确认框 + 隐私同意，H5 端响应显隐总线，与 app.rn.tsx 对齐）
    return <>{this.props.children}<PrivacyDialog /><ConfirmDialog /></>
  }
}
export default App
