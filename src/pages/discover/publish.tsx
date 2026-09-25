// 发布寻货页（v1.7.19）：个人用户发布求购询价单。
// 额度模型：免费 N 条/天 → 超限返回 NEED_POINTS 协议 → 弹积分确认框 → usePoints=true 重提交
// RN 约束：仅 flex、无 fixed/vh、Text 包裹、样式数值
import { useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { vibrateSuccess } from '../../utils/haptics'
import { publishDemand, parseNeedPoints, type PublishDemandBody } from '../../services/sourcing'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/** 表单字段定义（型号必填，其余可选——降低发布门槛保供给密度） */
interface FormState {
  partNumber: string
  brand: string
  quantity: string
  expectedDelivery: string
  region: string
  description: string
}

const EMPTY: FormState = { partNumber: '', brand: '', quantity: '', expectedDelivery: '', region: '', description: '' }

/** 发布寻货页 */
export default function PublishSourcingPage() {
  const t = useTheme()
  const fs = useFs()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)

  const setField = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  // 提交：usePoints=false 首发；命中 NEED_POINTS 协议弹确认后自动重提交
  const submit = async (usePoints: boolean) => {
    if (!form.partNumber.trim()) {
      Taro.showToast({ title: '请填写寻货型号', icon: 'none' })
      return
    }
    setSubmitting(true)
    const body: PublishDemandBody = {
      partNumber: form.partNumber.trim(),
      bearingId: null,
      brand: form.brand.trim() || null,
      quantity: form.quantity.trim() || null,
      expectedDelivery: form.expectedDelivery.trim() || null,
      region: form.region.trim() || null,
      description: form.description.trim() || null,
      usePoints,
    }
    const r = await publishDemand(body)
    setSubmitting(false)
    if (r.success) {
      void vibrateSuccess()
      Taro.showToast({ title: '寻货已发布', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
      return
    }
    const needPoints = parseNeedPoints(r.message)
    if (needPoints !== null) {
      const ok = await showConfirmDialog({
        title: '今日免费额度已用完',
        content: `继续发布需花费 ${needPoints} 积分，确认发布？`,
        confirmText: '花积分发布',
      })
      if (ok) await submit(true)
      return
    }
    Taro.showToast({ title: r.message || '发布失败', icon: 'none' })
  }

  /** 单行输入字段（label + input 行式布局） */
  const field = (key: keyof FormState, label: string, placeholder: string, required = false) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: 1, borderBottomColor: t.border }}>
      <Text style={{ ...fs(14), color: required ? t.textPrimary : t.textSecondary, width: 76 }}>
        {label}{required ? ' *' : ''}
      </Text>
      <Input
        style={{ flex: 1, color: t.textPrimary }}
        placeholder={placeholder}
        placeholderTextColor={t.textTertiary}
        value={form[key]}
        onInput={(e) => setField(key, e.detail.value)}
      />
    </View>
  )

  return (
    <PageLayout>
      <NavBar title='发布寻货' onBack={() => Taro.navigateBack()} showBack />
      <ScrollView style={{ flex: 1 }}>
        <View style={{ margin: 12, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}>
          {field('partNumber', '型号', '必填，如 6205-2RS / 深沟球轴承', true)}
          {field('brand', '期望品牌', '如 NSK / SKF / HRB（可空）')}
          {field('quantity', '数量', '如 500 套（可空）')}
          {field('expectedDelivery', '期望交期', '如 一周内（可空）')}
          {field('region', '收货地区', '如 河南洛阳（可空）')}
          <View style={{ flexDirection: 'row', minHeight: 72, paddingTop: 12 }}>
            <Text style={{ ...fs(14), color: t.textSecondary, width: 76 }}>补充说明</Text>
            <Input
              style={{ flex: 1, color: t.textPrimary }}
              placeholder='成色要求、可否验货等（可空）'
              placeholderTextColor={t.textTertiary}
              value={form.description}
              onInput={(e) => setField('description', e.detail.value)}
            />
          </View>
        </View>

        <Text style={{ ...fs(12), color: t.textTertiary, marginLeft: 16, marginRight: 16, marginTop: 4, lineHeight: 18 }}>
          发布后商户可应答报价，您从应答中选定一家后双方互见联系方式。寻货 14 天有效，请留意站内信通知。
        </Text>

        <View
          style={{
            margin: 16, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
            backgroundColor: submitting ? t.textTertiary : t.primary,
          }}
          onClick={() => { if (!submitting) void submit(false) }}
        >
          <Text style={{ ...fs(16), color: '#FFFFFF', fontWeight: '600' }}>{submitting ? '发布中…' : '发布寻货'}</Text>
        </View>
      </ScrollView>
    </PageLayout>
  )
}
