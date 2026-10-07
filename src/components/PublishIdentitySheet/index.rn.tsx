// 发布身份选择 bottom sheet（RN 端，.rn.tsx 由 Metro 平台解析自动选中）：
// 与 index.tsx（H5/小程序 fixed 遮罩版）同 props 接口与同两段式交互——
//   打开零选中、点行高亮+对勾可反复改、"当前商户"仅信息标签、底部"确定发布"未选置灰。
// RN 不支持 position:fixed，走 react-native Modal（slide 动画 + 遮罩点按关闭）。
// 页面级挂载于发布页，无全局命令式总线。
import { useEffect, useState } from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View, Image, ScrollView } from 'react-native'
import Icon from '../Icon'
import { useTheme } from '../../hooks/useTheme'
import { usableImage } from '../../services/config'

/** 发布身份条目（与 index.tsx 保持一致） */
export interface PublishIdentityItem {
  id: string
  name: string
  logoUrl?: string | null
}

interface Props {
  visible: boolean
  items: PublishIdentityItem[]
  currentId: string | null
  /** 点"确定发布"回传：merchantId=商户名义；null=个人名义 */
  onPick: (merchantId: string | null) => void
  /** 取消/点遮罩：中止发布 */
  onClose: () => void
}

/** 个人名义行的伪选项键 */
const PERSONAL = '__personal__'

/** 发布身份选择弹层（RN） */
export default function PublishIdentitySheet({ visible, items, currentId, onPick, onClose }: Props) {
  const t = useTheme()
  const styles = createStyles(t.bgCard, t.textPrimary, t.textSecondary, t.textTertiary, t.primary, t.border, t.bgInput, t.primaryLight)
  // 两段式选中态：null=未选（确定置灰）；每次打开重置
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    if (visible) setSelected(null)
  }, [visible])
  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>选择发布身份</Text>
          <ScrollView style={styles.list} bounces={false}>
            {items.map((m) => {
              const checked = selected === m.id
              return (
                <TouchableOpacity key={m.id} style={[styles.row, checked && styles.rowChecked]} activeOpacity={0.7} onPress={() => setSelected(m.id)}>
                  <View style={styles.avatar}>
                    {m.logoUrl ? (
                      <Image source={{ uri: usableImage(m.logoUrl) }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarLetter}>{(m.name || '商').slice(0, 1)}</Text>
                    )}
                  </View>
                  <View style={styles.rowMid}>
                    <Text style={styles.name} numberOfLines={1}>{m.name}</Text>
                    {m.id === currentId ? <Text style={styles.currentTag}>当前商户</Text> : null}
                  </View>
                  {checked ? <Icon name='check-circle-2' size={20} color={t.primary} /> : null}
                </TouchableOpacity>
              )
            })}
            {/* 个人名义行（与商户行同选中交互） */}
            <TouchableOpacity style={[styles.row, selected === PERSONAL && styles.rowChecked]} activeOpacity={0.7} onPress={() => setSelected(PERSONAL)}>
              <View style={[styles.avatar, styles.personalAvatar]}>
                <Icon name='user' size={20} color={t.textSecondary} />
              </View>
              <View style={styles.rowMid}>
                <Text style={styles.name}>以个人名义发布</Text>
              </View>
              {selected === PERSONAL ? <Icon name='check-circle-2' size={20} color={t.primary} /> : null}
            </TouchableOpacity>
          </ScrollView>
          {/* 确定按钮：未选中置灰不可点（决策必须显式做出） */}
          <TouchableOpacity
            style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
            activeOpacity={0.8}
            onPress={() => {
              if (!selected) return
              onPick(selected === PERSONAL ? null : selected)
            }}
          >
            <Text style={[styles.confirmText, !selected && styles.confirmTextDisabled]}>确定发布</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelRow} activeOpacity={0.7} onPress={onClose}>
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
  textSecondary: string,
  textTertiary: string,
  primary: string,
  border: string,
  bgInput: string,
  primaryLight: string
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
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: border,
      borderRadius: 8
    },
    rowChecked: {
      backgroundColor: primaryLight
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
    personalAvatar: {
      backgroundColor: bgInput
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
    currentTag: {
      fontSize: 11,
      lineHeight: 16,
      color: textTertiary,
      marginTop: 2
    },
    confirmBtn: {
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
      backgroundColor: primary
    },
    confirmBtnDisabled: {
      backgroundColor: bgInput
    },
    confirmText: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600',
      color: '#FFFFFF'
    },
    confirmTextDisabled: {
      color: textTertiary
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
