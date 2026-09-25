// 隐私同意弹窗：非 RN 端实现（H5 / 小程序）
// 职责：与 index.rn.tsx 同名配对提供 showPrivacyDialog() 命令式接口，
//   H5 端页面内自绘（同款白卡样式），《用户协议》《隐私政策》可直接点击跳转阅读——
//   修复原 Taro.showModal 系统蓝框且协议不可点的问题。
// 说明：小程序端 App 组件不渲染全局 UI，weapp 仍走 showModal 兜底（RN 命中 index.rn.tsx）。
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { useTheme } from '../../hooks/useTheme'

/** 显隐订阅回调类型 */
type VisibilityListener = (visible: boolean) => void

/** 模块级显隐订阅者（App 根组件挂载的唯一实例） */
let visibilityListener: VisibilityListener | null = null
/** 待显示的积压信号：showPrivacyDialog 早于组件订阅被调用时置位，订阅后补发 */
let pendingVisible = false
/** 待本次弹窗结果的接收者 */
let pendingResolve: ((agreed: boolean) => void) | null = null

/** 订阅显隐信号，返回退订函数（组件挂载时调用） */
function subscribeVisible(listener: VisibilityListener): () => void {
  visibilityListener = listener
  if (pendingVisible) {
    pendingVisible = false
    listener(true)
  }
  return () => {
    visibilityListener = null
  }
}

/** 弹出隐私保护提示，返回用户是否同意（暂不/关闭 均视为不同意） */
export function showPrivacyDialog(): Promise<boolean> {
  // 小程序端自绘层无处挂载，降级原生 showModal（Promise 语义一致）
  if (process.env.TARO_ENV === 'weapp') {
    return new Promise((resolve) => {
      Taro.showModal({
        title: '隐私保护提示',
        content: '欢迎使用本应用。请阅读并同意《用户协议》与《隐私政策》后再使用登录、收藏、入驻等功能。',
        confirmText: '同意',
        cancelText: '暂不',
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false)
      })
    })
  }
  return new Promise((resolve) => {
    pendingResolve = resolve
    pendingVisible = true
    visibilityListener?.(true)
  })
}

/** 结算本次弹窗：关闭并回传结果 */
function settle(agreed: boolean) {
  visibilityListener?.(false)
  pendingResolve?.(agreed)
  pendingResolve = null
}

/** 打开协议文档页 */
function openDoc(type: string) {
  Taro.navigateTo({ url: `/pages/common/doc?type=${type}` }).catch(() => { /* 页面栈异常静默 */ })
}

/** H5 端隐私同意弹窗组件：挂载于 App 根，响应 showPrivacyDialog() 的显隐信号 */
export default function PrivacyDialog() {
  const [visible, setVisible] = useState(false)
  const t = useTheme()

  useEffect(() => subscribeVisible(setVisible), [])

  if (!visible) return null

  return (
    <View
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <View style={{ width: '84%', backgroundColor: t.bgCard, borderRadius: 12, paddingTop: 22, paddingBottom: 16, paddingLeft: 20, paddingRight: 20 }}>
        <Text style={{ display: 'block', width: '100%', fontSize: 18, fontWeight: '600', textAlign: 'center', color: t.textPrimary }}>
          隐私保护提示
        </Text>
        <Text style={{ display: 'block', width: '100%', fontSize: 15, lineHeight: '24px', color: '#374151', marginTop: 14 }}>
          欢迎使用本应用。请阅读并同意
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 }}>
          <Text style={{ fontSize: 15, lineHeight: '24px', color: t.primary }} onClick={() => openDoc('user-agreement')}>
            《用户协议》
          </Text>
          <Text style={{ fontSize: 15, lineHeight: '24px', color: t.textSecondary }}>与</Text>
          <Text style={{ fontSize: 15, lineHeight: '24px', color: t.primary }} onClick={() => openDoc('privacy-policy')}>
            《隐私政策》
          </Text>
          <Text style={{ fontSize: 15, lineHeight: '24px', color: t.textSecondary }}>后再使用登录、收藏、入驻等功能。</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }}>
          <View
            style={{ minWidth: 72, display: 'flex', alignItems: 'center', paddingTop: 9, paddingBottom: 9, paddingLeft: 18, paddingRight: 18, borderRadius: 8, marginLeft: 12, backgroundColor: t.primaryLight }}
            onClick={() => settle(false)}
          >
            <Text style={{ fontSize: 15, lineHeight: '20px', color: t.textSecondary }}>暂不</Text>
          </View>
          <View
            style={{ minWidth: 72, display: 'flex', alignItems: 'center', paddingTop: 9, paddingBottom: 9, paddingLeft: 18, paddingRight: 18, borderRadius: 8, marginLeft: 12, backgroundColor: t.primary }}
            onClick={() => settle(true)}
          >
            <Text style={{ fontSize: 15, lineHeight: '20px', color: '#FFFFFF' }}>同意</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
