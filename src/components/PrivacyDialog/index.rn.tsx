// 隐私同意弹窗：RN 端实现（.rn.tsx 由 Metro 平台解析自动选中）
// 职责：用 react-native 原生 Modal 自绘隐私弹窗，规避 Taro showModal 的
// Dialog+Mask 嵌套 Touchable 在 Android 真机上拦截按钮点击的缺陷；
// 同时支持直接点选《用户协议》《隐私政策》链接，体验优于 showModal。
// 说明：调用方经 showPrivacyDialog() 命令式弹出，组件以默认导出挂载在
// app.rn.tsx 根节点，内部通过模块级订阅总线接收显隐信号。
import { useEffect, useState } from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Taro from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'

/** 显隐订阅回调类型 */
type VisibilityListener = (visible: boolean) => void
/** 模块级显隐订阅者（App 根组件挂载的唯一实例） */
let visibilityListener: VisibilityListener | null = null
/** 待本次弹窗结果的一个接收者 */
let pendingResolve: ((agree: boolean) => void) | null = null
/** 待显示的积压信号：showPrivacyDialog 早于组件订阅被调用时置位，订阅后补发 */
let pendingVisible = false

/** 订阅显隐信号，返回退订函数（组件挂载时调用） */
function subscribeVisible(listener: VisibilityListener): () => void {
  visibilityListener = listener
  // 消费订阅前积压的"待显示"信号（组件 useEffect 晚于 App.componentDidMount 注册，
  // 冷启动时序竞态下否则会静默丢失导致弹窗不出现）
  if (pendingVisible) {
    pendingVisible = false
    listener(true)
  }
  return () => {
    visibilityListener = null
  }
}

/** 弹出隐私确认弹窗，resolve 用户选择（true=同意） */
export function showPrivacyDialog(): Promise<boolean> {
  return new Promise((resolve) => {
    pendingResolve = resolve
    // 无论订阅者是否就绪都置位，确保组件挂载后补发显示信号
    pendingVisible = true
    visibilityListener?.(true)
  })
}

/** 结算本次弹窗：关闭并 resolve 结果 */
function settle(agree: boolean) {
  visibilityListener?.(false)
  pendingResolve?.(agree)
  pendingResolve = null
}

const createStyles = (primary: string, primaryLight: string) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center'
    },
    card: {
      width: '84%',
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      paddingTop: 22,
      paddingBottom: 16,
      paddingLeft: 20,
      paddingRight: 20
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
      color: '#111827'
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: '#374151',
      marginTop: 14
    },
    link: {
      fontSize: 15,
      lineHeight: 22,
      color: primary
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 20
    },
    btn: {
      minWidth: 72,
      alignItems: 'center',
      paddingTop: 9,
      paddingBottom: 9,
      paddingLeft: 18,
      paddingRight: 18,
      borderRadius: 8,
      marginLeft: 12,
      backgroundColor: primaryLight
    },
    btnPrimary: {
      backgroundColor: primary
    },
    btnText: {
      fontSize: 15,
      lineHeight: 20,
      color: '#374151'
    },
    btnPrimaryText: {
      color: '#FFFFFF'
    }
  })

/** RN 端隐私弹窗组件：挂载于 App 根，响应 showPrivacyDialog() 的显隐信号 */
export default function PrivacyDialog() {
  const [visible, setVisible] = useState(false)
  const t = useTheme()
  const styles = createStyles(t.primary, t.primaryLight)

  useEffect(() => subscribeVisible(setVisible), [])

  return (
    <Modal
      visible={visible}
      transparent
      animationType='fade'
      onRequestClose={() => settle(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>隐私保护提示</Text>
          <Text style={styles.body}>
            <Text style={styles.body}>欢迎使用本应用。请阅读并同意</Text>
            <Text
              style={styles.link}
              onPress={() => Taro.navigateTo({ url: '/pages/common/doc?type=user-agreement' })}
            >《用户协议》</Text>
            <Text style={styles.body}>与</Text>
            <Text
              style={styles.link}
              onPress={() => Taro.navigateTo({ url: '/pages/common/doc?type=privacy-policy' })}
            >《隐私政策》</Text>
            <Text style={styles.body}>后再使用登录、收藏、入驻等功能。</Text>
          </Text>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.btn} onPress={() => settle(false)} activeOpacity={0.7}>
              <Text style={styles.btnText}>暂不</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => settle(true)} activeOpacity={0.7}>
              <Text style={[styles.btnText, styles.btnPrimaryText]}>同意</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}