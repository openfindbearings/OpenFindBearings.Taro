// 扫码页（RN 实现）：react-native-camera-kit 原生相机 + 条码/二维码识别（camera-kit 14.x）。
// 关键约束（v1.4.45）：本页必须全部用 react-native 原生组件渲染，不能混入 Taro 的 View/Text——
//   混用会让原生 Camera 的 view tag 在 RN 0.70 下注册异常，表现为 onHostPause 时
//   "ViewManager for tag ... could not be found" 直接崩溃（实测）。
import { useEffect, useRef, useState } from 'react'
import { PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Taro from '@tarojs/taro'
import { Camera } from 'react-native-camera-kit'
import { parseScanResult, scanTargetUrl } from '../../../utils/scanParse'
import { showTip } from '../../../utils/toast'

export default function ScanPage() {
  const [granted, setGranted] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  // 防重复触发：一次扫码会话只跳一次
  const handledRef = useRef(false)

  useEffect(() => {
    if (Platform.OS !== 'android') {
      setGranted(true)
      return
    }
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA)
      .then((result) => {
        const ok = result === PermissionsAndroid.RESULTS.GRANTED
        setGranted(ok)
        if (!ok) showTip('需要相机权限才能扫码')
      })
      .catch(() => showTip('相机不可用'))
  }, [])

  /** 识别回调：取首个可用码值，解析平台码后跳详情 */
  const handleReadCode = (event: { nativeEvent?: { codeStringValue?: string } }) => {
    if (handledRef.current) return
    const raw = event?.nativeEvent?.codeStringValue || ''
    if (!raw) return
    const target = parseScanResult(raw)
    if (!target) {
      showTip('未识别到平台二维码')
      return
    }
    handledRef.current = true
    Taro.redirectTo({ url: scanTargetUrl(target) })
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => Taro.navigateBack()} hitSlop={8}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>扫一扫</Text>
        <View style={styles.headerSpace} />
      </View>
      <View style={styles.body}>
        {granted && !cameraError ? (
          <Camera
            style={StyleSheet.absoluteFill}
            cameraType="back"
            scanBarcode
            showFrame
            laserColor="rgba(0,0,0,0)"
            frameColor="#22D3EE"
            onReadCode={handleReadCode}
            onError={() => setCameraError(true)}
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.hintText}>{cameraError ? '相机启动失败，请检查权限' : '等待相机授权…'}</Text>
          </View>
        )}
        <View style={styles.tipBar}>
          <Text style={styles.tipText}>对准平台分享二维码，识别后自动跳转</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, lineHeight: 32, color: '#0F172A' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#0F172A' },
  headerSpace: { width: 40 },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hintText: { color: '#E2E8F0', fontSize: 14 },
  tipBar: { position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center' },
  tipText: { color: '#FFFFFF', fontSize: 13 }
})