// 搜索入口页（v1.4.36 仿主流电商）：首页搜索框点击后进入
// 职责：承载输入框 + 「搜索」按钮 + 搜索历史 + 热门搜索；提交后跳结果页。
// 首页不再展示历史/热词，避免首屏被检索辅助信息占满。
import { useState, useCallback } from 'react'
import { View, Input, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import NavBar from '../../components/NavBar'
import PageLayout from '../../platforms/PageLayout'
import { getItem, setItem, removeItem } from '../../utils/storage'
import { useFs } from '../../hooks/useFontScale'
import { useTheme } from '../../hooks/useTheme'
import { showConfirmDialog } from '../../components/ConfirmDialog'

/** 搜索历史存储键（与首页共用同一份数据） */
const HISTORY_KEY = 'search_history'
/** 历史最多保留条数 */
const MAX_HISTORY = 10
/** 热门搜索词（静态兜底，后续可换后端热门词） */
const HOT_KEYWORDS = ['SKF', 'NSK', '6205', '6308', '轴承型号查询', '深沟球轴承']

/** 搜索入口页：输入 + 历史 + 热门，提交后进入结果页 */
export default function SearchEntryPage() {
  const [keyword, setKeyword] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const fs = useFs()
  const t = useTheme()

  // 每次显示都重新读历史，保证从结果页返回时看到最新记录
  useDidShow(() => {
    getItem(HISTORY_KEY)
      .then((saved) => {
        if (!saved) return
        try { setHistory(JSON.parse(saved)) } catch { /* 忽略坏数据 */ }
      })
      .catch(() => { /* 读取失败保持空 */ })
  })

  /** 写入历史（去重前置、超限截断）并跳结果页 */
  const submit = useCallback((kw: string) => {
    const value = kw.trim()
    if (!value) return
    const updated = [value, ...history.filter((h) => h !== value)].slice(0, MAX_HISTORY)
    setHistory(updated)
    void setItem(HISTORY_KEY, JSON.stringify(updated))
    Taro.redirectTo({ url: `/pages/home/search?keyword=${encodeURIComponent(value)}` })
  }, [history])

  /** 清空历史（二次确认） */
  const clearHistory = useCallback(() => {
    showConfirmDialog({ title: '提示', content: '确定清空搜索历史？' }).then((ok) => {
      if (!ok) return
      setHistory([])
      void removeItem(HISTORY_KEY)
    })
  }, [])

  return (
    <PageLayout nav={<NavBar title="搜索" showBack />}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        {/* 输入行：左侧扫码识别（后续接入引擎），右侧「搜索」按钮取主题色 */}
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{ flex: 1, height: 40, display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 8, borderRadius: 20, backgroundColor: t.bgInput }}
          >
            <Icon name="scan_line" size={18} color={t.textSecondary} />
            <Input
              style={{ flex: 1, marginLeft: 8, fontSize: 14, color: t.textPrimary }}
              type="text"
              focus
              placeholder="搜索轴承型号、品牌..."
              placeholderTextColor={t.textTertiary}
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value)}
              onConfirm={() => submit(keyword)}
              confirmType="search"
            />
            {keyword ? (
              <View style={{ width: 24, height: 24, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }} onClick={() => setKeyword('')}>
                <Icon name="x" size={14} color={t.textTertiary} />
              </View>
            ) : null}
          </View>
          {/* 改动说明（v1.4.51）：实心主题色按钮过重，改为与发现页一致的纯文字「搜索」 */}
          <Text
            onClick={() => submit(keyword)}
            style={{ ...fs(14), color: t.primary, marginLeft: 10, paddingTop: 9, paddingBottom: 9, paddingLeft: 4, paddingRight: 4 }}
          >
            搜索
          </Text>
        </View>

        {/* 搜索历史 */}
        {history.length > 0 ? (
          <View style={{ marginTop: 20 }}>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Icon name="clock" size={15} color={t.textTertiary} />
              <Text style={{ ...fs(14), color: t.textPrimary, fontWeight: '600', flex: 1, marginLeft: 6 }}>搜索历史</Text>
              <View onClick={clearHistory} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="trash" size={13} color={t.textTertiary} />
                <Text style={{ ...fs(12), color: t.textTertiary, marginLeft: 3 }}>清空</Text>
              </View>
            </View>
            <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
              {history.map((item) => (
                <View
                  key={item}
                  onClick={() => submit(item)}
                  style={{ marginRight: 8, marginBottom: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 14, backgroundColor: t.bgInput, maxWidth: 200 }}
                >
                  <Text style={{ ...fs(13), color: t.textSecondary }} numberOfLines={1}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* 热门搜索 */}
        <View style={{ marginTop: 20 }}>
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Icon name="flame" size={15} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textPrimary, fontWeight: '600', marginLeft: 6 }}>热门搜索</Text>
          </View>
          <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
            {HOT_KEYWORDS.map((item) => (
              <View
                key={item}
                onClick={() => submit(item)}
                style={{ marginRight: 8, marginBottom: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 14, backgroundColor: t.bgInput }}
              >
                <Text style={{ ...fs(13), color: t.textSecondary }}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </PageLayout>
  )
}