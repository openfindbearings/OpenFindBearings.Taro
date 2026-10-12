// 替代提交页（v2.16.0 替代品治理）：商家报候选——平台建标准、商家报候选、平台审核生效。
// 商家提交"本店可交付的替代型号"作为候选，待平台审核通过后对公域可见；本页同时展示本人提交的审核进度与驳回理由。
import { useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { searchBearings, type Bearing } from '../../services/bearing'
import { submitInterchange, getMyInterchanges, type MyInterchange } from '../../services/merchant'

definePageConfig({ disableScroll: true })

/** 三级替代类型（与 API InterchangeType 对齐，口径=标准等效/条件/仅供参考） */
const TYPES = [
  { key: 'exact', label: '标准等效替代' },
  { key: 'conditional', label: '条件替代（需评估）' },
  { key: 'functional', label: '仅供参考' },
]

/** 审核状态语义色（0=已生效 1=待审核 2=已驳回） */
function statusColor(t: ReturnType<typeof useTheme>, s: number): string {
  if (s === 0) return '#16A34A'
  if (s === 1) return '#F59E0B'
  return t.danger
}

export default function MerchantInterchangesPage() {
  const t = useTheme()
  const fs = useFs()

  const [list, setList] = useState<MyInterchange[]>([])
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)

  // 源/目标型号检索
  const [sourceKw, setSourceKw] = useState('')
  const [targetKw, setTargetKw] = useState('')
  const [sourceResults, setSourceResults] = useState<Bearing[]>([])
  const [targetResults, setTargetResults] = useState<Bearing[]>([])
  const [source, setSource] = useState<Bearing | null>(null)
  const [target, setTarget] = useState<Bearing | null>(null)
  // 表单字段
  const [itype, setItype] = useState('exact')
  const [confidence, setConfidence] = useState('80')
  const [remarks, setRemarks] = useState('')
  const [bidirectional, setBidirectional] = useState(true)

  const load = () => {
    getMyInterchanges().then((r) => setList(r || [])).catch(() => setList([]))
  }

  useDidShow(() => { load() })

  /** 按关键字检索平台轴承（选源/目标型号用） */
  const doSearch = async (kw: string, which: 'source' | 'target') => {
    if (!kw.trim()) { Taro.showToast({ title: '请输入型号关键字', icon: 'none' }); return }
    try {
      const r = await searchBearings({ keyword: kw.trim(), pageSize: 10 })
      const items = r?.items || []
      if (which === 'source') setSourceResults(items)
      else setTargetResults(items)
      if (items.length === 0) Taro.showToast({ title: '未找到匹配型号', icon: 'none' })
    } catch {
      Taro.showToast({ title: '查询失败', icon: 'none' })
    }
  }

  /** 重置表单 */
  const resetForm = () => {
    setSourceKw(''); setTargetKw(''); setSourceResults([]); setTargetResults([])
    setSource(null); setTarget(null); setItype('exact'); setConfidence('80'); setRemarks(''); setBidirectional(true)
  }

  /** 提交替代候选 */
  const onSubmit = async () => {
    if (!source) { Taro.showToast({ title: '请选择源型号（被替代方）', icon: 'none' }); return }
    if (!target) { Taro.showToast({ title: '请选择目标型号（本店可交付的替代方）', icon: 'none' }); return }
    if (source.id === target.id) { Taro.showToast({ title: '源与目标型号不能相同', icon: 'none' }); return }
    const conf = Number(confidence)
    if (isNaN(conf) || conf < 0 || conf > 100) { Taro.showToast({ title: '可信度需为 0-100', icon: 'none' }); return }
    setBusy(true)
    try {
      await submitInterchange({
        sourceBearingId: source.id,
        targetBearingId: target.id,
        interchangeType: itype,
        confidence: conf,
        remarks: remarks || undefined,
        isBidirectional: bidirectional,
      })
      Taro.showToast({ title: '已提交，待平台审核', icon: 'success' })
      setShowForm(false); resetForm(); load()
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '提交失败', icon: 'none' })
    } finally {
      setBusy(false)
    }
  }

  const card = { backgroundColor: t.bgCard, borderRadius: 12, margin: 16, marginTop: 0, padding: 14 }

  return (
    <PageLayout nav={<NavBar title='替代提交' showBack />}>
      <View>
        {/* 提交入口 */}
        <View style={{ margin: 16 }}>
          <View
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: t.primary, borderRadius: 10, paddingTop: 10, paddingBottom: 10 }}
            onClick={() => setShowForm((v) => !v)}
          >
            <Icon name={showForm ? 'x' : 'plus'} size={16} color={t.textOnPrimary} />
            <Text style={{ ...fs(14), color: t.textOnPrimary, marginLeft: 6 }}>{showForm ? '收起' : '提交替代候选'}</Text>
          </View>
          <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 6 }}>
            提交本店可交付的替代型号作为候选，平台审核通过后生效；仅供参考档不构成平台推荐
          </Text>
        </View>

        {/* 提交表单 */}
        {showForm && (
          <View style={card}>
            {/* 源型号 */}
            <Text style={{ ...fs(13), color: t.textPrimary }}>源型号（被替代方）</Text>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <Input
                value={sourceKw}
                placeholder='输入型号关键字'
                onInput={(e: any) => setSourceKw(e.detail.value)}
                style={{ flex: 1, backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, height: 38, fontSize: 13, color: t.textPrimary }}
              />
              <View style={{ marginLeft: 8, backgroundColor: t.primaryLight, borderRadius: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }} onClick={() => doSearch(sourceKw, 'source')}>
                <Text style={{ ...fs(13), color: t.primary }}>搜索</Text>
              </View>
            </View>
            {source ? (
              <Text style={{ ...fs(12), color: '#16A34A', marginTop: 6 }}>已选：{source.partNumber} · {source.brandName || '—'}</Text>
            ) : sourceResults.map((b) => (
              <View key={b.id} style={{ paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: t.borderLight }} onClick={() => setSource(b)}>
                <Text style={{ ...fs(13), color: t.textPrimary }}>{b.partNumber} · {b.brandName || '—'} · {b.bearingType}</Text>
              </View>
            ))}

            {/* 目标型号 */}
            <Text style={{ ...fs(13), color: t.textPrimary, marginTop: 14 }}>目标型号（本店可交付的替代方）</Text>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <Input
                value={targetKw}
                placeholder='输入型号关键字'
                onInput={(e: any) => setTargetKw(e.detail.value)}
                style={{ flex: 1, backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, height: 38, fontSize: 13, color: t.textPrimary }}
              />
              <View style={{ marginLeft: 8, backgroundColor: t.primaryLight, borderRadius: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }} onClick={() => doSearch(targetKw, 'target')}>
                <Text style={{ ...fs(13), color: t.primary }}>搜索</Text>
              </View>
            </View>
            {target ? (
              <Text style={{ ...fs(12), color: '#16A34A', marginTop: 6 }}>已选：{target.partNumber} · {target.brandName || '—'}</Text>
            ) : targetResults.map((b) => (
              <View key={b.id} style={{ paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: t.borderLight }} onClick={() => setTarget(b)}>
                <Text style={{ ...fs(13), color: t.textPrimary }}>{b.partNumber} · {b.brandName || '—'} · {b.bearingType}</Text>
              </View>
            ))}

            {/* 替代类型 */}
            <Text style={{ ...fs(13), color: t.textPrimary, marginTop: 14 }}>替代类型</Text>
            <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
              {TYPES.map((tp) => (
                <View
                  key={tp.key}
                  style={{ borderRadius: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 7, paddingBottom: 7, marginRight: 8, marginBottom: 8, backgroundColor: itype === tp.key ? t.primary : t.bgInput }}
                  onClick={() => setItype(tp.key)}
                >
                  <Text style={{ ...fs(12), color: itype === tp.key ? t.textOnPrimary : t.textSecondary }}>{tp.label}</Text>
                </View>
              ))}
            </View>

            {/* 可信度 */}
            <Text style={{ ...fs(13), color: t.textPrimary, marginTop: 8 }}>可信度（0-100）</Text>
            <Input
              type='number'
              value={confidence}
              onInput={(e: any) => setConfidence(e.detail.value)}
              style={{ backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, height: 38, fontSize: 13, color: t.textPrimary, marginTop: 6 }}
            />

            {/* 备注 */}
            <Text style={{ ...fs(13), color: t.textPrimary, marginTop: 14 }}>备注（可选，如“需更换密封圈”）</Text>
            <Input
              value={remarks}
              onInput={(e: any) => setRemarks(e.detail.value)}
              style={{ backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, height: 38, fontSize: 13, color: t.textPrimary, marginTop: 6 }}
            />

            {/* 双向 */}
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 14 }} onClick={() => setBidirectional((v) => !v)}>
              <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: bidirectional ? t.primary : t.border, backgroundColor: bidirectional ? t.primary : 'transparent', alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
                {bidirectional && <Icon name='check' size={14} color={t.textOnPrimary} />}
              </View>
              <Text style={{ ...fs(13), color: t.textSecondary, marginLeft: 8 }}>双向替代（A 可替 B，B 也可替 A）</Text>
            </View>

            <View
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: busy ? t.textTertiary : t.primary, borderRadius: 10, paddingTop: 11, paddingBottom: 11, marginTop: 16 }}
              onClick={busy ? undefined : onSubmit}
            >
              <Text style={{ ...fs(15), color: t.textOnPrimary }}>提交候选</Text>
            </View>
          </View>
        )}

        {/* 我的提交 */}
        <View style={{ margin: 16, marginTop: 0 }}>
          <Text style={{ ...fs(14), color: t.textPrimary, fontWeight: '600' }}>我的提交（{list.length}）</Text>
        </View>
        {list.length === 0 ? (
          <Text style={{ ...fs(13), color: t.textTertiary, textAlign: 'center', marginTop: 20 }}>还没有提交替代候选</Text>
        ) : (
          list.map((it) => (
            <View key={it.id} style={card}>
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ ...fs(14), color: t.textPrimary, flex: 1 }} numberOfLines={1}>
                  {it.sourceBearing.partNumber} → {it.targetBearing.partNumber}
                </Text>
                <Text style={{ ...fs(11), color: '#FFFFFF', backgroundColor: statusColor(t, it.reviewStatus), borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1 }}>
                  {it.reviewStatusLabel}
                </Text>
              </View>
              <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
                {it.typeLabel} · 可信度 {it.confidence}{it.isBidirectional ? ' · 双向' : ' · 单向'}
              </Text>
              {it.remarks ? <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 2 }}>备注：{it.remarks}</Text> : null}
              {it.reviewStatus === 2 && it.reviewComment ? (
                <Text style={{ ...fs(12), color: t.danger, marginTop: 4 }}>驳回原因：{it.reviewComment}</Text>
              ) : null}
            </View>
          ))
        )}

        <Text style={{ ...fs(11), color: t.textTertiary, textAlign: 'center', marginTop: 4, marginBottom: 24 }}>
          替代候选经平台审核后生效；仅供参考档不构成平台推荐
        </Text>
      </View>
    </PageLayout>
  )
}