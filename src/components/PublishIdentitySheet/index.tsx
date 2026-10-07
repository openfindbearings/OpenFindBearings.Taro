// 发布身份选择 bottom sheet（H5/小程序端，v2.12.0 丙方案）：
// 职责：发布寻货时归属商户者弹出，一步选定"以哪个商户名义/以个人名义"发布。
//   每行 = 商户 logo（无则首字母圆占位）+ 全名（尾部省略）+ 当前商户对勾；
//   底部"以个人名义发布"行 + 取消行；点遮罩=取消。三端统一自绘（RN 版走 Modal，见 index.rn.tsx）。
// 页面级挂载（仅发布页使用），不做全局命令式总线。
import { View, Text, Image } from '@tarojs/components'
import { useTheme } from '../../hooks/useTheme'
import { usableImage } from '../../services/config'
import Icon from '../Icon'

/** 发布身份条目 */
export interface PublishIdentityItem {
  id: string
  name: string
  logoUrl?: string | null
}

interface Props {
  visible: boolean
  items: PublishIdentityItem[]
  /** 全局当前商户（默认对勾标记，不强制默认选中——身份必须显式点选） */
  currentId: string | null
  /** 选定：merchantId=商户名义；null=个人名义 */
  onPick: (merchantId: string | null) => void
  /** 取消/点遮罩：中止发布 */
  onClose: () => void
}

/** 发布身份选择弹层（H5/小程序） */
export default function PublishIdentitySheet({ visible, items, currentId, onPick, onClose }: Props) {
  const t = useTheme()
  if (!visible) return null
  return (
    <View
      style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 9999 }}
      onClick={onClose}
    >
      <View
        style={{ backgroundColor: t.bgCard, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 24, maxHeight: '70%', overflow: 'scroll' }}
        onClick={(e) => e.stopPropagation()}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', color: t.textPrimary, textAlign: 'center', marginBottom: 8 }}>选择发布身份</Text>
        {items.map((m) => (
          <View
            key={m.id}
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border }}
            onClick={() => onPick(m.id)}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12 }}>
              {m.logoUrl ? (
                <Image src={usableImage(m.logoUrl)} style={{ width: 40, height: 40 }} mode='aspectFill' />
              ) : (
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#FFFFFF' }}>{(m.name || '商').slice(0, 1)}</Text>
              )}
            </View>
            <Text style={{ fontSize: 15, color: t.textPrimary, flex: 1, marginRight: 8 }} numberOfLines={1}>{m.name}</Text>
            {m.id === currentId ? <Icon name='check' size={20} color={t.primary} /> : null}
          </View>
        ))}
        {/* 个人名义行（与商户行对等的显式选项） */}
        <View
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingBottom: 14 }}
          onClick={() => onPick(null)}
        >
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.bgInput, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Icon name='user' size={20} color={t.textSecondary} />
          </View>
          <Text style={{ fontSize: 15, color: t.textPrimary }}>以个人名义发布</Text>
        </View>
        <View style={{ display: 'flex', alignItems: 'center', paddingTop: 12, marginTop: 4 }} onClick={onClose}>
          <Text style={{ fontSize: 15, color: t.textTertiary }}>取消</Text>
        </View>
      </View>
    </View>
  )
}
