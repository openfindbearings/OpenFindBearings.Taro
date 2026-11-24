// 扫码页（非 RN 端兜底）：小程序直接用 Taro.scanCode，H5 提示改用小程序/App。
// 入口在 utils/scanRoute 的 scanAndOpen：RN 端才会真正跳到本页的 .rn.tsx 实现。
import { View, Text } from '@tarojs/components'
import Taro, { useEffect } from '@tarojs/taro'
import NavBar from '../../../components/NavBar'
import { useTheme } from '../../../hooks/useTheme'
import { parseScanResult, scanTargetUrl } from '../../../utils/scanRoute'
import { showTip } from '../../../utils/toast'

export default function ScanPage() {
  const t = useTheme()

  useEffect(() => {
    if (process.env.TARO_ENV === 'h5') {
      showTip('当前版本暂不支持扫码，请在 App 或小程序内使用')
      return
    }
    Taro.scanCode({ onlyFromCamera: false })
      .then((res) => {
        const target = parseScanResult(res?.result || '')
        if (!target) {
          showTip('未识别到平台二维码')
          return
        }
        Taro.redirectTo({ url: scanTargetUrl(target) })
      })
      .catch(() => { /* 用户取消 */ })
  }, [])

  return (
    <View style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: t.bgPage }}>
      <NavBar title="扫一扫" />
      <View style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: t.textSecondary }}>正在打开扫一扫…</Text>
      </View>
    </View>
  )
}