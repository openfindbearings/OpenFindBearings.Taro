// 确认对话框：RN 端实现（.rn.tsx 由 Metro 平台解析自动选中）
// 职责：用 react-native 原生 Modal 自绘通用确认弹窗，规避 Taro showModal 的
// Dialog+Mask 嵌套 Touchable 在 Android 真机上拦截按钮点击的缺陷，
// 并统一全站"带按钮"弹窗视觉（与 PrivacyDialog 同源样式 token）。
// 说明：命令式 showConfirmDialog() 触发，组件挂载于 app.rn.tsx 根节点，
// 通过模块级订阅总线接收显隐信号；H5/小程序走 showModal 分支（index.tsx）。
import { useEffect, useState } from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTheme } from '../../hooks/useTheme'

/** 确认对话框参数 */
export interface ConfirmDialogOptions {
  /** 标题，缺省为"提示" */
  title?: string
  /** 正文内容 */
  content: string
  /** 确认按钮文案，缺省"确定" */
  confirmText?: string
  /** 取消按钮文案，缺省"取消" */
  cancelText?: string
  /** 是否显示取消按钮，缺省 true */
  showCancel?: boolean
  /** 确认按钮颜色（可用于危险操作提示红），缺省跟随主题主色 */
  confirmColor?: string
}

/** 显隐订阅回调类型 */
type VisibilityListener = (visible: boolean) => void

/** 模块级显隐订阅者（App 根组件挂载的唯一实例） */
let visibilityListener: VisibilityListener | null = null
/** 待显示的积压信号：showConfirmDialog 早于组件订阅被调用时置位，订阅后补发 */
let pendingVisible = false
/** 待弹内容：订阅者就绪后取走 */
let pendingOptions: ConfirmDialogOptions = { content: '' }
/** 待本次弹窗结果的一个接收者 */
let pendingResolve: ((confirmed: boolean) => void) | null = null

/** 订阅显隐与内容信号，返回退订函数（组件挂载时调用） */
function subscribeVisible(listener: VisibilityListener): () => void {
  visibilityListener = listener
  // 消费订阅前积压的"待显示"信号，防御启动时序竞态
  if (pendingVisible) {
    pendingVisible = false
    listener(true)
  }
  return () => {
    visibilityListener = null
  }
}

/** 弹出确认对话框，resolve 用户是否确认（true=确认） */
export function showConfirmDialog(opts: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    pendingOptions = opts
    pendingResolve = resolve
    pendingVisible = true
    visibilityListener?.(true)
  })
}

/** 结算本次弹窗：关闭并 resolve 结果 */
function settle(confirmed: boolean) {
  visibilityListener?.(false)
  pendingResolve?.(confirmed)
  pendingResolve = null
}

const createStyles = (primaryLight: string, confirmColor: string) =>
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
    content: {
      fontSize: 15,
      lineHeight: 22,
      color: '#374151',
      marginTop: 14,
      textAlign: 'center'
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
      backgroundColor: confirmColor
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

/** RN 端确认对话框组件：挂载于 App 根，响应 showConfirmDialog() 的显隐信号 */
export default function ConfirmDialog() {
  const [visible, setVisible] = useState(false)
  const [opts, setOpts] = useState<ConfirmDialogOptions>({ content: '' })
  const t = useTheme()
  const styles = createStyles(t.primaryLight, opts.confirmColor ?? t.primary)

  // 订阅显隐：弹出时同步最新内容；关闭时复位
  useEffect(() => {
    const unsub = subscribeVisible((v) => {
      setVisible(v)
      if (v) setOpts(pendingOptions)
    })
    return unsub
  }, [])

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={() => settle(false)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {opts.title ? <Text style={styles.title}>{opts.title}</Text> : null}
          <Text style={styles.content}>{opts.content}</Text>
          <View style={styles.footer}>
            {opts.showCancel !== false ? (
              <TouchableOpacity style={styles.btn} onPress={() => settle(false)} activeOpacity={0.7}>
                <Text style={styles.btnText}>{opts.cancelText ?? '取消'}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => settle(true)} activeOpacity={0.7}>
              <Text style={[styles.btnText, styles.btnPrimaryText]}>{opts.confirmText ?? '确定'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}