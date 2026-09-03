import { Component, PropsWithChildren } from 'react'
import Taro from '@tarojs/taro'

import './app.scss'

const THEME_KEY = 'app_theme'
type ThemeMode = 'light' | 'dark' | 'system'

class App extends Component<PropsWithChildren> {
  componentDidMount() {
    this.applyTheme()
  }

  componentDidShow() {
    this.applyTheme()
  }

  applyTheme() {
    let mode: ThemeMode = Taro.getStorageSync(THEME_KEY)
    if (!mode) mode = 'light'

    // #ifdef H5
    const root = document.documentElement
    root.classList.remove('theme-light', 'theme-dark', 'theme-system')
    root.classList.add(`theme-${mode}`)

    // 跟随系统时，检测系统主题并应用对应 class
    if (mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.remove('theme-light', 'theme-dark')
      root.classList.add(prefersDark ? 'theme-dark' : 'theme-light')
    }
    // #endif
  }

  render() {
    return this.props.children
  }
}
export default App
