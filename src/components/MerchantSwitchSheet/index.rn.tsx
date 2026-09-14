// 商户切换 bottom sheet（RN 端，.rn.tsx 由 Metro 平台解析自动选中）
// 职责：命令式 showMerchantSwitchSheet() 触发，组件挂载于 app.rn.tsx 根节点，
//   通过模块级订阅总线接收显隐信号（与 ConfirmDialog.rn 同源机制），自绘底部弹层：
//   每行 = 商户 logo（无则首字母圆形占位）+ 名称 + 角色副标题 + 当前项对勾；底部"＋ 申请入驻其他商户"行。
//   规避 Taro showActionSheet 在 RN 的样式不可控 + 6 项上限，统一全站弹层视觉。
import { useEffect, useState } from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View, Image, ScrollView } from 'react-native'
import Icon from '../Icon'
import { useTheme } from '../../hooks/useTheme'
import { usableImage } from '../../services/config'

/** 切换器商户条目 */
export interface MerchantSwitchItem {
  id: string
  name: string
  logoUrl?: string | null
  role?: string
}

/** 切换动作语义 */
export type MerchantSwitchAction = 'switch' | 'add' | 'none'

/** 切换结果 */
export interface MerchantSwitchResult {
  action: MerchantSwitchAction
  merchantId?: string
}

/** 显隐订阅回调 */
type VisibilityListener = (visible: boolean) => void

let visibilityListener: VisibilityListener | null = null
let pendingVisible = false
let pendingItems: MerchantSwitchItem[] = []
let pendingCurrentId: string | null = null
let pendingResolve: ((r: MerchantSwitchResult) => void) | null = null

/** 订阅显隐信号，返回退订函数 */
function subscribeVisible(listener: VisibilityListener): () => void {
  visibilityListener = listener
  if (pendingVisible) {
    pendingVisible = false
    listener(true)
  }
  return () => { visibilityListener = null }
}

/** 与 index.tsx 同名命令式接口：弹出商户切换 sheet */
export function showMerchantSwitchSheet(
  items: MerchantSwitchItem[],
  currentId: string | null
): Promise<MerchantSwitchResult> {
  if (items.length === 0) return Promise.resolve({ action: 'none' })
  return new Promise((resolve) => {
    pendingItems = items
    pendingCurrentId = currentId
    pendingResolve = resolve
    pendingVisible = true
    visibilityListener?.(true)
  })
}

/** 结算：关闭并回传结果 */
function settle(result: MerchantSwitchResult) {
  visibilityListener?.(false)
  pendingResolve?.(result)
  pendingResolve = null
}

/** 角色码转中文副标题 */
function roleLabel(role?: string): string {
  if (role === 'MerchantAdmin') return '管理员'
  if (role === 'MerchantStaff') return '员工'
  return ''
}

/** RN 端商户切换器：挂载于 App 根，响应命令式信号 */
export default function MerchantSwitchSheet() {
  const [visible, setVisible] = useState(false)
  const [items, setItems] = useState<MerchantSwitchItem[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  // logo 加载失败的商户 id 集合：命中则回退首字母占位（仿 TabBar onError 兜底）
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({})
  const t = useTheme()
  const styles = createStyles(t.tabBarBg, t.textPrimary, t.textTertiary, t.primary, t.border)

  useEffect(() => {
    const unsub = subscribeVisible((v) => {
      setVisible(v)
      if (v) {
        setItems(pendingItems)
        setCurrentId(pendingCurrentId)
        setFailedLogos({})
      }
    })
    return unsub
  }, [])

  const onPick = (id: string) => {
    if (id === currentId) { settle({ action: 'none' }); return }
    settle({ action: 'switch', merchantId: id })
  }

  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={() => settle({ action: 'none' })}>
      {/* 点遮罩关闭；内容区阻止冒泡到底部面板 */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => settle({ action: 'none' })}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>切换商户</Text>
          <ScrollView style={styles.list} bounces={false}>
            {items.map((m) => {
              const isCurrent = m.id === currentId
              const src = m.logoUrl && !failedLogos[m.id] ? usableImage(m.logoUrl) : ''
              return (
                <TouchableOpacity key={m.id} style={styles.row} activeOpacity={0.7} onPress={() => onPick(m.id)}>
                  <View style={styles.avatar}>
                    {src ? (
                      <Image
                        source={{ uri: src }}
                        style={styles.avatarImg}
                        onError={() => setFailedLogos((p) => ({ ...p, [m.id]: true }))}
                      />
                    ) : (
                      <Text style={styles.avatarLetter}>{(m.name || '商').slice(0, 1)}</Text>
                    )}
                  </View>
                  <View style={styles.rowMid}>
                    <Text style={styles.name} numberOfLines={1}>{m.name}</Text>
                    {roleLabel(m.role) ? <Text style={styles.role}>{roleLabel(m.role)}</Text> : null}
                  </View>
                  {isCurrent ? <Icon name='check' size={20} color={t.primary} /> : null}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          <TouchableOpacity style={styles.addRow} activeOpacity={0.7} onPress={() => settle({ action: 'add' })}>
            <Icon name='plus' size={18} color={t.primary} />
            <Text style={styles.addText}>申请入驻其他商户</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelRow} activeOpacity={0.7} onPress={() => settle({ action: 'none' })}>
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

/** RN 安全样式：flex 布局、硬编码色值（入参随主题）、Text 数值字号/行高 */
function createStyles(
  bg: string,
  textPrimary: string,
  textTertiary: string,
  primary: string,
  border: string
) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end'
    },
    sheet: {
      backgroundColor: bg,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 16,
      paddingBottom: 24,
      paddingLeft: 16,
      paddingRight: 16,
      maxHeight: '70%'
    },
    title: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '600',
      color: textPrimary,
      textAlign: 'center',
      marginBottom: 8
    },
    list: {
      flexGrow: 0
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: border
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: primary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginRight: 12
    },
    avatarImg: {
      width: 40,
      height: 40
    },
    avatarLetter: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '600',
      color: '#FFFFFF'
    },
    rowMid: {
      flex: 1,
      marginRight: 8
    },
    name: {
      fontSize: 15,
      lineHeight: 22,
      color: textPrimary
    },
    role: {
      fontSize: 12,
      lineHeight: 18,
      color: textTertiary,
      marginTop: 2
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      marginTop: 12
    },
    addText: {
      fontSize: 15,
      lineHeight: 22,
      color: primary,
      marginLeft: 6
    },
    cancelRow: {
      alignItems: 'center',
      paddingVertical: 12,
      marginTop: 4
    },
    cancelText: {
      fontSize: 15,
      lineHeight: 22,
      color: textTertiary
    }
  })
}
