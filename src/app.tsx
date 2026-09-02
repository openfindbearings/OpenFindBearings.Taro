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
    const mode: ThemeMode = Taro.getStorageSync(THEME_KEY) || 'light'
    // #ifdef H5
    const root = document.documentElement
    root.classList.remove('theme-light', 'theme-dark', 'theme-system')
    root.classList.add(`theme-${mode}`)
    // #endif
  }

  render() {
    return this.props.children
  }
}
export default App
