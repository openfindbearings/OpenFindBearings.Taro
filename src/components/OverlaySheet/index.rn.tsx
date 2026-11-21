// 底部浮层面板容器（React Native）：用原生 Modal 承载，天然脱离页面 ScrollView，
// 不会被滚动容器裁剪；遮罩透明、内容贴底、可纵向滚动（海报较高）。
// 改动说明（v1.4.23）：RN 不支持 fixed，此前 absolute 覆盖层渲染在页面内容流里，
// 出现在列表下方并与「纠错」按钮重叠；改用 Modal 后与 H5/小程序表现一致。
import type { ReactNode } from 'react'
import { Modal, View, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useTheme } from '../../hooks/useTheme'

/** 浮层容器属性 */
export interface OverlaySheetProps {
  /** 是否可见 */
  visible: boolean
  /** 点击遮罩关闭 */
  onClose: () => void
  /** 面板内容 */
  children: ReactNode
}

/**
 * RN 端底部浮层：Modal + 遮罩 + 贴底卡片，内容可滚动。
 */
export default function OverlaySheet({ visible, onClose, children }: OverlaySheetProps) {
  const t = useTheme()

  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.bgCard }]}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  content: { paddingBottom: 24 },
})