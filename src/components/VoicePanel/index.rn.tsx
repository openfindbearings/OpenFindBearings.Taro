// 语音面板：RN 端实现（.rn.tsx 由 Metro 平台解析自动选中）
// 职责：提供全屏原生 Modal 语音面板，中央大按钮按住说话
// （onPressIn 开始录音、onPressOut 结束识别），识别结果回填搜索结果页；
// 由首页"讲语音"入口经 openVoicePanel() 唤起，交互更接近微信 PTT，减少误触。
// 说明：录音能力复用 useAsr（封装 AsrService），挂载于 App 根，无新依赖。
import { useEffect, useRef, useState } from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Taro from '@tarojs/taro'
import { useAsr } from '../../hooks/useAsr'
import { useTheme } from '../../hooks/useTheme'
import { getItem, setItem } from '../../utils/storage'
import { normalizeAsrText } from '../../services/asr/normalize'
import Icon from '../Icon'

/** 搜索历史存储键与上限（与首页保持一致） */
const HISTORY_KEY = 'search_history'
const MAX_HISTORY = 10

/** 记录一次语音识别结果为搜索历史（首页下一次读相同键） */
function saveHistory(kw: string): void {
  getItem(HISTORY_KEY)
    .then((raw) => {
      let list: string[] = []
      try {
        list = raw ? (JSON.parse(raw) as string[]) : []
      } catch {
        list = []
      }
      const updated = [kw, ...list.filter((h) => h !== kw)].slice(0, MAX_HISTORY)
      setItem(HISTORY_KEY, JSON.stringify(updated))
    })
    .catch(() => {
      // 历史写入失败不影响语音识别主流程
    })
}

/** 显隐订阅回调类型 */
type VisibilityListener = (visible: boolean) => void

/** 模块级显隐订阅者（App 根组件挂载的唯一实例） */
let visibilityListener: VisibilityListener | null = null
/** 待显示的积压信号：openVoicePanel 早于组件订阅被调用时置位，订阅后补发 */
let pendingVisible = false

/** 订阅显隐信号，返回退订函数（组件挂载时调用） */
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

/** 唤起语音面板（首页"讲语音"入口调用） */
export function openVoicePanel(): void {
  pendingVisible = true
  visibilityListener?.(true)
}

/** 关闭语音面板 */
function closeVoicePanel(): void {
  visibilityListener?.(false)
}

/** 将底层原始错误映射为可读文案 */
function mapError(msg: string): string {
  if (/denied|Permission/i.test(msg)) return '麦克风权限被拒绝'
  if (/model/i.test(msg)) return '语音模型未安装，请更新 App'
  return '语音识别失败，请重试'
}

/** 误触判定阈值：按住时长低于此值视为误触，直接取消不进入识别 */
const MIN_HOLD_MS = 300

const createStyles = (primary: string, primaryLight: string) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center'
    },
    closeBtn: {
      position: 'absolute',
      top: 60,
      right: 24,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center'
    },
    bigButton: {
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: primary,
      alignItems: 'center',
      justifyContent: 'center'
    },
    bigButtonHolding: {
      backgroundColor: primaryLight,
      borderWidth: 2,
      borderColor: primary
    },
    buttonLabel: {
      fontSize: 17,
      lineHeight: 24,
      color: '#FFFFFF',
      marginTop: 6,
      fontWeight: '600'
    },
    tip: {
      fontSize: 14,
      lineHeight: 20,
      color: '#E2E8F0',
      marginTop: 24,
      textAlign: 'center'
    },
    cancelBtn: {
      marginTop: 48,
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 24,
      paddingRight: 24,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.12)'
    },
    cancelText: {
      fontSize: 15,
      lineHeight: 20,
      color: '#FFFFFF'
    }
  })

/** RN 端语音面板：挂载于 App 根，响应 openVoicePanel() 唤起，中央大按钮按住说话 */
export default function VoicePanel() {
  const [visible, setVisible] = useState(false)
  const [holding, setHolding] = useState(false)
  const asr = useAsr()
  const t = useTheme()
  const styles = createStyles(t.primary, t.primaryLight)
  // 按下时间戳：用于识别"快速轻点误触"
  const pressStartRef = useRef(0)
  // 预热函数稳定引用：一次性订阅 effect 使用，避免 asr 对象每次 render 变化导致重订阅
  const warmupRef = useRef(asr.warmup)
  warmupRef.current = asr.warmup

  // 订阅显隐：关闭时复位 holding，防止上次录音状态残留导致下次打开误显示"松开结束"
  useEffect(() => {
    const unsub = subscribeVisible((v) => {
      setVisible(v)
      // 打开时预热模型：首次按住即可录音，避免按住时才开始加载导致漏录
      if (v) warmupRef.current().catch(() => { /* 预热失败由 start 时再提示 */ })
      if (!v) setHolding(false)
    })
    return unsub
  }, [])

  // 按下开始录音：开始异步进行，快速松手由 useAsr 内部补停防残留
  const handlePressIn = async () => {
    pressStartRef.current = Date.now()
    setHolding(true)
    const ok = await asr.startListening({
      onResult: (text) => {
        setHolding(false)
        closeVoicePanel()
        // 识别文本做归一化：中文数字合成阿拉伯、杠/斜杠转符号，再用于搜索
        const kw = normalizeAsrText(text)
        if (!kw) {
          Taro.showToast({ title: '未能识别到内容，请重试', icon: 'none' })
          return
        }
        saveHistory(kw)
        Taro.navigateTo({ url: `/pages/home/search?keyword=${encodeURIComponent(kw)}` })
      },
      onError: (msg) => {
        setHolding(false)
        closeVoicePanel()
        Taro.showToast({ title: mapError(msg), icon: 'none' })
      }
    })
    if (!ok) setHolding(false)
  }

  // 松开：立即复位按压态；按住时长过短视为误触（直接取消，空录音不触发 Vosk 事件，
  // 若不取消会空等兜底定时器），正常按住则停止录音并开始识别
  const handlePressOut = () => {
    setHolding(false)
    if (Date.now() - pressStartRef.current < MIN_HOLD_MS) {
      asr.cancelListening()
      return
    }
    asr.stopListening()
  }

  const recording = holding || asr.state === 'recording'
  const processing = asr.state === 'processing'

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={closeVoicePanel}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={closeVoicePanel} activeOpacity={0.7}>
          <Icon name='x' size={18} color='#FFFFFF' />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bigButton, recording ? styles.bigButtonHolding : null]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.85}
        >
          <Icon name='mic' size={34} color='#FFFFFF' />
          <Text style={styles.buttonLabel}>
            {processing ? '识别中...' : recording ? '松开结束' : '按住说话'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.tip}>
          {processing ? '识别中...' : '请讲轴承型号、品牌、类型或商家名称'}
        </Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={closeVoicePanel} activeOpacity={0.7}>
          <Text style={styles.cancelText}>取消</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}