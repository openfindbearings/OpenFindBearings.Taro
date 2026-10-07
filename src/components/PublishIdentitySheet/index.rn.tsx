// 发布身份选择 bottom sheet（RN 端，.rn.tsx 由 Metro 平台解析自动选中）：
// 与 index.tsx（H5/小程序 fixed 遮罩版）同 props 接口；RN 不支持 position:fixed，
//   走 react-native Modal（slide 动画 + 遮罩点按关闭），视觉结构三端一致：
//   标题 + 商户行（logo/首字母占位 + 全名 + 当前对勾）+ 个人名义行 + 取消行。
// 页面级挂载于发布页，无全局命令式总线。
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
  onPick: (merchantId: string | null) => void
  onClose: () => void
}

/** 发布身份选择弹层（RN） */
export default function PublishIdentitySheet({ visible, items, currentId, onPick, onClose }: Props) {
  const t = useTheme()
  const styles = createStyles(t.bgCard, t.textPrimary, t.textSecondary, t.textTertiary, t.primary, t.border, t.bgInput)
  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>选择发布身份</Text>
          <ScrollView style={styles.list} bounces={false}>
            {items.map((m) => (
              <TouchableOpacity key={m.id} style={styles.row} activeOpacity={0.7} onPress={() => onPick(m.id)}>
                <View style={styles.avatar}>
                  {m.logoUrl ? (
                    <Image source={{ uri: usableImage(m.logoUrl) }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarLetter}>{(m.name || '商').slice(0, 1)}</Text>
                  )}
                </View>
                <Text style={styles.name} numberOfLines={1}>{m.name}</Text>
                {m.id === currentId ? <Icon name='check' size={20} color={t.primary} /> : null}
              </TouchableOpacity>
            ))}
            {/* 个人名义行 */}
            <TouchableOpacity style={[styles.row, styles.personalRow]} activeOpacity={0.7} onPress={() => onPick(null)}>
              <View style={[styles.avatar, styles.personalAvatar]}>
                <Icon name='user' size={20} color={t.textSecondary} />
              </View>
              <Text style={styles.name}>以个人名义发布</Text>
            </TouchableOpacity>
          </ScrollView>
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
  bgInput: string
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
    personalRow: {
      borderBottomWidth: 0
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
    name: {
      fontSize: 15,
      lineHeight: 22,
      color: textPrimary,
      flex: 1,
      marginRight: 8
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
