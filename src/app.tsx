// 全局入口组件（H5/小程序端；RN 端 Metro 解析 ./app 命中 app.rn.tsx）
// 启动引导逻辑统一收敛在 appShared.ts，本文件只保留组件骨架与全局样式
// 改动说明：原文件内联的 preload/隐私弹窗/主题初始化/auth init 全部迁入 appShared，
// 与 app.rn.tsx 共用，修复"只改本文件 RN 端不生效"的入口漂移问题
import { Component, PropsWithChildren } from 'react'
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
    return this.props.children
  }
}
export default App
