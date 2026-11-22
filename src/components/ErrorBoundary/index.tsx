// 全局错误边界（v1.4.31）：兜住子树渲染异常，避免整页纯白屏
// 背景：发布版出现 JS 运行期错误时（如引用未定义变量），React 会卸载整棵树，
//   RN/H5/小程序均表现为白屏，用户既看不到错误也无法触发 App 内更新。
// 本组件把异常收敛为可读提示 + 「重新加载」按钮，让用户能自行恢复或升级。
// 说明：只能捕获渲染/生命周期异常，模块加载期错误（顶层执行抛错）仍需构建期检查兜底。
import { Component, PropsWithChildren, ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'

/** 错误边界状态 */
interface ErrorBoundaryState {
  /** 捕获到的异常对象，null 表示正常渲染 */
  error: Error | null
}

/**
 * 全局错误边界：捕获子树渲染异常，渲染兜底界面并允许重新加载
 */
export default class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  /** 记录异常（React 要求同步调用 setState，禁止在内部做副作用跳转） */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  /** 异常日志：仅打印到控制台，便于开发与线上日志抓取 */
  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error)
  }

  /** 重新加载：回到首页重建整棵树（RN/H5/小程序统一用 reLaunch） */
  handleReload = () => {
    this.setState({ error: null })
    Taro.reLaunch({ url: '/pages/home/index' }).catch(() => {
      // 兜底：reLaunch 失败时保持当前兜底界面，不抛二次异常
    })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC'
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 8 }}>
          页面加载失败
        </Text>
        <Text
          style={{ fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 20 }}
        >
          请点击下方按钮重新加载；若仍无法恢复，请到「我的 - 关于」检查更新。
        </Text>
        <View
          onClick={this.handleReload}
          style={{
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 28,
            paddingRight: 28,
            borderRadius: 22,
            backgroundColor: '#2563EB'
          }}
        >
          <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 'bold' }}>重新加载</Text>
        </View>
      </View>
    )
  }
}