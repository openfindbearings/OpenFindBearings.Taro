// 信息纠错底部面板（v1.7.14）：结构化"选字段 → 核对当前值 → 填应改为"三段式，
// 对标高德地图报错面板。字段清单由后端下发（与审批可应用字段严格一致，杜绝
// "提交了但采纳也不生效"的假选项）；去重/校验失败的 400 原因经 message 透传提示。
// 自绘 absolute 覆盖层（RN 无 fixed），样式内联走主题 token，三端一致。
import { useEffect, useState } from 'react'
import { View, Text, Input, Textarea, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { vibrateSuccess } from '../../utils/haptics'
import { getCorrectionFields, submitCorrection, type CorrectionFieldOption } from '../../services/user'

interface Props {
  /** 是否可见（false 时整体不渲染，避免隐藏层拦截触摸） */
  visible: boolean
  /** 纠错目标类型 */
  targetType: 'Bearing' | 'Merchant'
  /** 目标实体ID */
  targetId: string
  onClose: () => void
}

/** 信息纠错面板：选字段/填建议值/提交 */
export default function CorrectionSheet({ visible, targetType, targetId, onClose }: Props) {
  const t = useTheme()
  const fs = useFs()
  const [fields, setFields] = useState<CorrectionFieldOption[]>([])
  const [fieldKey, setFieldKey] = useState('')
  const [suggested, setSuggested] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)

  // 打开时拉取可纠错字段清单并重置表单（每次都是全新提交）
  useEffect(() => {
    if (!visible) return
    setFieldKey('')
    setSuggested('')
    setReason('')
    setLoading(true)
    getCorrectionFields(targetType, targetId)
      .then((list) => setFields(list || []))
      .catch(() => setFields([]))
      .finally(() => setLoading(false))
  }, [visible, targetType, targetId])

  if (!visible) return null

  const selected = fields.find((f) => f.key === fieldKey)

  const onSubmit = async () => {
    if (!selected || !suggested.trim() || submitting) return
    setSubmitting(true)
    try {
      const r = await submitCorrection(targetType, targetId, {
        fieldName: selected.key,
        suggestedValue: suggested.trim(),
        reason: reason.trim() || undefined
      })
      if (r?.success) {
        void vibrateSuccess()
        Taro.showToast({ title: r.message || '纠错已提交，感谢反馈', icon: 'none' })
        onClose()
      } else {
        // 去重守卫/校验失败：上游 400 文案原样提示（如"该字段的纠错已在审核中"）
        Taro.showToast({ title: r?.message || '提交失败，请稍后再试', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '提交失败，请检查网络', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <View
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.bgCard, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}
        onClick={process.env.TARO_ENV === 'rn' ? undefined : (e) => e?.stopPropagation?.()}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ ...fs(17), fontWeight: 'bold', color: t.textPrimary }}>信息纠错</Text>
          <Icon name="x" size={20} color={t.textTertiary} onClick={onClose} />
        </View>
        <Text style={{ ...fs(13), color: t.textTertiary, marginBottom: 10 }}>
          选择有误的字段并填写正确值，平台核实采纳后会自动更新并通知您。
        </Text>

        {loading ? (
          <Text style={{ ...fs(14), color: t.textTertiary, paddingTop: 20, paddingBottom: 20, textAlign: 'center' }}>加载字段中...</Text>
        ) : (
          <ScrollView scrollY style={{ maxHeight: 420 }}>
            {/* 字段选择：chip 流式布局，选中高亮 */}
            <Text style={{ ...fs(14), fontWeight: 'bold', color: t.textSecondary, marginBottom: 8 }}>纠错字段</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
              {fields.map((f) => {
                const active = f.key === fieldKey
                return (
                  <View
                    key={f.key}
                    style={{
                      paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 14, marginRight: 8, marginBottom: 8,
                      backgroundColor: active ? t.primaryLight : t.bgInput,
                      borderWidth: 1, borderColor: active ? t.primary : 'transparent'
                    }}
                    onClick={() => setFieldKey(f.key)}
                  >
                    <Text style={{ ...fs(13), color: active ? t.primary : t.textSecondary }}>{f.label}</Text>
                  </View>
                )
              })}
            </View>

            {/* 当前值核对区 */}
            {selected && (
              <View style={{ backgroundColor: t.bgInput, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <Text style={{ ...fs(12), color: t.textTertiary }}>当前值（{selected.label}）</Text>
                <Text style={{ ...fs(14), color: t.textSecondary, marginTop: 4 }}>
                  {selected.currentValue || '（空）'}
                </Text>
              </View>
            )}

            <Text style={{ ...fs(14), fontWeight: 'bold', color: t.textSecondary, marginBottom: 6 }}>应改为 *</Text>
            <Input
              value={suggested}
              onInput={(e) => setSuggested(e.detail.value)}
              placeholder="填写正确的内容"
              placeholderStyle={`color:${t.textTertiary}`}
              style={{ ...fs(15), color: t.textPrimary, backgroundColor: t.bgInput, borderRadius: 10, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, marginBottom: 12 }}
            />

            <Text style={{ ...fs(14), fontWeight: 'bold', color: t.textSecondary, marginBottom: 6 }}>纠错说明（选填）</Text>
            <Textarea
              value={reason}
              onInput={(e) => setReason(e.detail.value)}
              placeholder="依据来源，如官方手册型号表"
              placeholderStyle={`color:${t.textTertiary}`}
              maxlength={200}
              style={{ ...fs(15), color: t.textPrimary, backgroundColor: t.bgInput, borderRadius: 10, padding: 12, height: 72, marginBottom: 16 }}
            />
          </ScrollView>
        )}

        <View
          style={{
            height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
            backgroundColor: selected && suggested.trim() && !submitting ? t.primary : t.bgInput
          }}
          onClick={onSubmit}
        >
          <Text style={{ ...fs(16), color: selected && suggested.trim() && !submitting ? '#FFFFFF' : t.textTertiary }}>
            {submitting ? '提交中...' : '提交纠错'}
          </Text>
        </View>
      </View>
    </View>
  )
}
