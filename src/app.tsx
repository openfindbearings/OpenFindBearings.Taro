// 全局入口组件
// 启动时初始化主题（H5 端根据 localStorage 设置 <html data-theme>）
// 用 LucideTaroProvider 包裹全局，统一默认图标颜色和尺寸
import { Component, PropsWithChildren } from 'react'
import { LucideTaroProvider } from 'lucide-react-taro'
import { initTheme, useThemeStore } from './stores/theme'
import './app.scss'

class App extends Component<PropsWithChildren> {
  componentDidMount() {
    // 启动时一次性应用主题
    initTheme()
  }

  componentDidShow() {
    // 页面切换时重新应用（防止某些场景下主题丢失）
    initTheme()
  }

  render() {
    // 根据当前主题设置 Lucide 图标默认色
    // 浅色主题：图标线条深色 #0F172A
    // 深色主题：图标线条浅色 #F1F5F9
    // 跟随系统：根据当前 data-theme 判断
    const mode = useThemeStore.getState().mode
    const isDark = mode === 'dark' || (mode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

    const defaultIconColor = isDark ? '#F1F5F9' : '#0F172A'

    return (
      <LucideTaroProvider defaultColor={defaultIconColor} defaultSize={22}>
        {this.props.children}
      </LucideTaroProvider>
    )
  }
}
export default App
