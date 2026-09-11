// 隐私同意弹窗：非 RN 端实现（H5 / 小程序）
// 职责：与 index.rn.tsx 同名配对提供 showPrivacyDialog() 命令式接口，
// 本文件用 Taro.showModal 承载（浏览器/小程序确认框），满足跨端构建要求。
// 说明：RN 端由 Metro 平台解析命中 index.rn.tsx（react-native 原生 Modal），
// 规避 Taro showModal 在 Android 真机按钮触摸失效的缺陷。
import Taro from '@tarojs/taro'

/** 弹出隐私保护提示，返回用户是否同意（暂不/关闭 均视为不同意） */
export function showPrivacyDialog(): Promise<boolean> {
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

/** 隐私弹窗组件（非 RN 端占位，实际由命令式 showPrivacyDialog 承载，不渲染节点） */
export default function PrivacyDialog() {
  return null
}