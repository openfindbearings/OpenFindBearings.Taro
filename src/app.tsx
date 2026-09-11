// 全局入口组件（v1.7.0 度量重构，纯 RN 基准）
// 职责：启动时预读商家入驻状态供 CustomTabBar 同步渲染（防首帧图标跳变闪烁）
// 改动说明：
//   1. 删除 initTheme / applyFontSize（H5 深色模式与 localStorage 遗留——
//      RN 无 window.localStorage，此前靠 try/catch 吞异常；本轮 RN 锁浅色，整链移除）；
//   2. 主题/字体大小的 H5 实现归入第二阶段（做 H5 时按平台重新接入）；
//   3. app.scss 仅保留跨端安全的全局样式（无 var()/媒体查询，RN Metro 可解析）。
import { Component, PropsWithChildren } from 'react'
import Taro from '@tarojs/taro'
import { getItem, setItem } from './utils/storage'
import { initFontSize } from './stores/fontSize'
import { initTheme } from './stores/theme'
import { initThemeColor } from './hooks/useThemeColor'
import { useAuthStore } from './stores/auth'
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

// 首启隐私政策同意弹窗（合规：PIPL 要求收集个人信息前取得用户同意）
// 说明：本期为软门槛——未同意仍可匿名浏览查询，仅登录/入驻等有个人信息场景在各自页再行勾选；
// showModal 无法内嵌可点链接，此处文案引导，完整可点协议见注册页与设置页协议入口。
const PRIVACY_CONSENT_KEY = 'privacy_consent'
function showPrivacyConsentOnce() {
  getItem(PRIVACY_CONSENT_KEY)
    .then((v) => {
      if (v === 'true') return
      Taro.showModal({
        title: '隐私保护提示',
        content: '欢迎使用本应用。请阅读并同意《用户协议》与《隐私政策》后再使用登录、收藏、入驻等功能。',
        confirmText: '同意',
        cancelText: '暂不',
        success: (res) => {
          if (res.confirm) setItem(PRIVACY_CONSENT_KEY, 'true')
        }
      })
    })
    .catch(() => { /* 读取失败忽略 */ })
}

class App extends Component<PropsWithChildren> {
  componentDidMount() {
    preloadMerchantState()
    showPrivacyConsentOnce()
    initFontSize()
    initTheme()
    initThemeColor()
    // 改动说明：冷启动恢复登录态。此前无人调用 init()，auth store 的 isLoggedIn 只在本次
    // 会话 login/register 后才有值，App 重启后 my 页/设置页全部判为未登录。
    // init 以持久 refresh_token 为准恢复登录态并补拉 profile（首个受保护请求亦可触发 401 自动刷新）。
    void useAuthStore.getState().init()
  }

  componentDidShow() {
    preloadMerchantState()
  }

  render() {
    return this.props.children
  }
}
export default App
