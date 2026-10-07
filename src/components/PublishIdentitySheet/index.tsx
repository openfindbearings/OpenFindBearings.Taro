// 发布身份选择 bottom sheet（H5/小程序端，v2.12.0 丙方案）：
// 职责：发布寻货时归属商户者弹出，一步选定"以哪个商户名义/以个人名义"发布。
// 交互=两段式（先选中后确认，对齐主流弹层选择范式）：
//   打开时零选中（不预选对勾，避免"已替用户决定"的误导）；点行=选中（高亮+右侧对勾，可反复改）；
//   "当前"仅为信息标签非选中态；底部"确定发布"未选时置灰，点确定才回传——给用户核对与反悔的缓冲。
// 页面级挂载（仅发布页使用），不做全局命令式总线。
import { useEffect, useState } from 'react'
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
  /** 全局当前商户（行尾"当前"信息标签，不代表选中态） */
  currentId: string | null
  /** 点"确定发布"回传：merchantId=商户名义；null=个人名义 */
  onPick: (merchantId: string | null) => void
  /** 取消/点遮罩：中止发布 */
  onClose: () => void
}

/** 个人名义行的伪选项键 */
const PERSONAL = '__personal__'

/** 发布身份选择弹层（H5/小程序） */
export default function PublishIdentitySheet({ visible, items, currentId, onPick, onClose }: Props) {
  const t = useTheme()
  // 两段式选中态：null=未选（确定置灰）；每次打开重置
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    if (visible) setSelected(null)
  }, [visible])
  if (!visible) return null
  const rows = items.map((m) => ({ key: m.id, name: m.name, logoUrl: m.logoUrl, isCurrent: m.id === currentId }))
  rows.push({ key: PERSONAL, name: '以个人名义发布', logoUrl: null, isCurrent: false })
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
        {rows.map((m) => {
          const checked = selected === m.key
          return (
            <View
              key={m.key}
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border, backgroundColor: checked ? t.primaryLight : 'transparent', borderRadius: 8, paddingLeft: 8, paddingRight: 8 }}
              onClick={() => setSelected(m.key)}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: m.key === PERSONAL ? t.bgInput : t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12 }}>
                {m.key !== PERSONAL && m.logoUrl ? (
                  <Image src={usableImage(m.logoUrl)} style={{ width: 40, height: 40 }} mode='aspectFill' />
                ) : m.key !== PERSONAL ? (
                  <Text style={{ fontSize: 18, fontWeight: '600', color: '#FFFFFF' }}>{(m.name || '商').slice(0, 1)}</Text>
                ) : (
                  <Icon name='user' size={20} color={t.textSecondary} />
                )}
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontSize: 15, color: t.textPrimary }} numberOfLines={1}>{m.name}</Text>
                {m.isCurrent ? <Text style={{ fontSize: 11, color: t.textTertiary, marginTop: 2 }}>当前商户</Text> : null}
              </View>
              {checked ? <Icon name='check-circle-2' size={20} color={t.primary} /> : null}
            </View>
          )
        })}
        {/* 确定按钮：未选中置灰不可点（决策必须显式做出） */}
        <View
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 23, marginTop: 16, backgroundColor: selected ? t.primary : t.bgInput }}
          onClick={() => {
            if (!selected) return
            onPick(selected === PERSONAL ? null : selected)
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: selected ? '#FFFFFF' : t.textTertiary }}>确定发布</Text>
        </View>
        <View style={{ display: 'flex', alignItems: 'center', paddingTop: 12, marginTop: 4 }} onClick={onClose}>
          <Text style={{ fontSize: 15, color: t.textTertiary }}>取消</Text>
        </View>
      </View>
    </View>
  )
}
