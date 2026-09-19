// 确认对话框：非 RN 端实现（H5 / 小程序）
// 职责：与 index.rn.tsx 同款自绘弹层（遮罩 + 白卡 + 双按钮），统一 H5/RN 弹窗视觉。
// 说明：当年 RN 端因原生 Alert 不可定制样式（系统蓝按钮）+ Android showModal 按钮触摸缺陷而做自绘版，
//   H5 此前留了 Taro.showModal 占位——浏览器原生框同样不可定制，本文件改为页面内自绘。
//   小程序端 App 组件不渲染页面级 UI（全局挂载收不到显隐信号），故 weapp 仍走 Taro.showModal
//   原生确认框兜底（小程序原生框视觉由其系统统一，不视为违和）；若未来 weapp 列为一期，
//   需改为页面级挂载。
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { useTheme } from '../../hooks/useTheme'

/** 确认对话框参数（与 index.rn.tsx 保持一致） */
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
  // 改动说明：weapp 端 App 组件不渲染全局 UI，自绘层无处挂载，降级原生 showModal（Promise 语义一致）
  if (process.env.TARO_ENV === 'weapp') {
    return new Promise((resolve) => {
      Taro.showModal({
        title: opts.title ?? '提示',
        content: opts.content,
        showCancel: opts.showCancel ?? true,
        confirmText: opts.confirmText ?? '确定',
        cancelText: opts.cancelText ?? '取消',
        confirmColor: opts.confirmColor,
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false)
      })
    })
  }
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

/** 确认对话框组件：挂载于 App 根，响应 showConfirmDialog() 的显隐信号 */
export default function ConfirmDialog() {
  const [visible, setVisible] = useState(false)
  const [opts, setOpts] = useState<ConfirmDialogOptions>({ content: '' })
  const t = useTheme()

  // 订阅显隐：弹出时同步最新内容；关闭时复位
  useEffect(() => subscribeVisible((v) => {
    setVisible(v)
    if (v) setOpts(pendingOptions)
  }), [])

  if (!visible) return null

  return (
    <View
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <View style={{ width: '84%', backgroundColor: '#FFFFFF', borderRadius: 12, paddingTop: 22, paddingBottom: 16, paddingLeft: 20, paddingRight: 20 }}>
        {opts.title ? (
          <Text style={{ display: 'block', width: '100%', fontSize: 18, fontWeight: '600', textAlign: 'center', color: '#111827' }}>
            {opts.title}
          </Text>
        ) : null}
        <Text style={{ display: 'block', width: '100%', fontSize: 15, lineHeight: '22px', color: '#374151', marginTop: 14, textAlign: 'center' }}>
          {opts.content}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }}>
          {opts.showCancel !== false ? (
            <View
              style={{ minWidth: 72, display: 'flex', alignItems: 'center', paddingTop: 9, paddingBottom: 9, paddingLeft: 18, paddingRight: 18, borderRadius: 8, marginLeft: 12, backgroundColor: t.primaryLight }}
              onClick={() => settle(false)}
            >
              <Text style={{ fontSize: 15, lineHeight: '20px', color: '#374151' }}>{opts.cancelText ?? '取消'}</Text>
            </View>
          ) : null}
          <View
            style={{ minWidth: 72, display: 'flex', alignItems: 'center', paddingTop: 9, paddingBottom: 9, paddingLeft: 18, paddingRight: 18, borderRadius: 8, marginLeft: 12, backgroundColor: opts.confirmColor ?? t.primary }}
            onClick={() => settle(true)}
          >
            <Text style={{ fontSize: 15, lineHeight: '20px', color: '#FFFFFF' }}>{opts.confirmText ?? '确定'}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
