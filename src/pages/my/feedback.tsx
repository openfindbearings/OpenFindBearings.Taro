// 意见反馈页（v1.7.58）：提交功能建议/问题反馈/内容举报，并查看本人反馈与平台回复。
// 交互：顶部两个分段（提交反馈 / 我的反馈）；提交区含分类、内容、附件（最多 3 张）与联系方式；
// 回复由管理员一次性给出，经站内信 + 本页"我的反馈"双触达，不支持在工单内继续对话。
import { useState } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import MediaImage from '../../components/MediaImage'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import LoginGuide from '../../components/LoginGuide'
import NavBar from '../../components/NavBar'
import { useAuthStore } from '../../stores/auth'
import { pickImagePath } from '../../services/pickImage'
import {
  FEEDBACK_CATEGORIES,
  submitFeedback,
  uploadFeedbackImage,
  getMyFeedbacks,
  type FeedbackItem
} from '../../services/user'
import { formatTime } from '../../utils/format'

definePageConfig({ disableScroll: true })

/** 内容长度下限（与 API 校验一致） */
const MIN_CONTENT = 5
/** 内容长度上限（与 API 校验一致） */
const MAX_CONTENT = 1000
/** 附件张数上限（与 API 校验一致） */
const MAX_IMAGES = 3
/** 我的反馈每页条数 */
const PAGE_SIZE = 20

/** 状态徽标配色（API status：Pending/Processing/Resolved/Closed） */
function statusBadge(status: string, t: any): { label: string; color: string } {
  if (status === 'Resolved') return { label: '已回复', color: t.success }
  if (status === 'Closed') return { label: '已关闭', color: t.textTertiary }
  if (status === 'Processing') return { label: '处理中', color: t.warning }
  return { label: '待处理', color: t.warning }
}

/** 意见反馈页：提交表单与我的反馈列表两个分段 */
export default function FeedbackPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  const [tab, setTab] = useState<'submit' | 'mine'>('submit')
  const [category, setCategory] = useState<number>(FEEDBACK_CATEGORIES[0].value)
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [contact, setContact] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [items, setItems] = useState<FeedbackItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  /** 拉取我的反馈（append=true 追加下一页） */
  const loadMine = (p: number, append: boolean) => {
    if (!isLoggedIn) { setItems([]); return }
    setLoading(true)
    getMyFeedbacks(p, PAGE_SIZE)
      .then((r) => {
        setItems(append ? [...items, ...(r?.items || [])] : (r?.items || []))
        setTotal(r?.totalCount || 0)
        setPage(p)
      })
      .catch(() => { /* 失败静默，保留已有列表 */ })
      .finally(() => setLoading(false))
  }

  useDidShow(() => {
    if (isLoggedIn) loadMine(1, false)
  })

  /** 选一张图片并先上传，拿到相对媒体键后暂存，随反馈一起提交 */
  const addImage = async () => {
    if (!isLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (uploading) return
    if (images.length >= MAX_IMAGES) {
      Taro.showToast({ title: `最多 ${MAX_IMAGES} 张图片`, icon: 'none' })
      return
    }
    try {
      const path = await pickImagePath()
      if (!path) return
      setUploading(true)
      const r = await uploadFeedbackImage(path)
      if (r.success && r.url) {
        setImages((prev) => [...prev, r.url as string])
      } else {
        Taro.showToast({ title: r.message || '上传失败', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '上传失败', icon: 'none' })
    } finally {
      setUploading(false)
    }
  }

  /** 移除已上传的附件（只从前端列表去掉，未提交前不占服务端记录） */
  const removeImage = (url: string) => {
    setImages((prev) => prev.filter((u) => u !== url))
  }

  /** 提交反馈：内容长度先本地校验，服务端每日限额与校验失败原因经 message 透传 */
  const onSubmit = async () => {
    if (!isLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (submitting) return

    const text = content.trim()
    if (text.length < MIN_CONTENT) {
      Taro.showToast({ title: `请至少填写 ${MIN_CONTENT} 个字`, icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const r = await submitFeedback({
        category,
        content: text,
        imageUrls: images,
        contact: contact.trim() || undefined
      })
      if (r.success) {
        Taro.showToast({ title: '提交成功，感谢反馈', icon: 'success' })
        setContent('')
        setImages([])
        setContact('')
        setTab('mine')
        loadMine(1, false)
      } else {
        Taro.showToast({ title: r.message || '提交失败', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const hasMore = items.length < total
  const contentLength = content.trim().length
  const canSubmit = contentLength >= MIN_CONTENT && !submitting

  return (
    <PageLayout
      nav={<NavBar title="意见反馈" showBack />}
      onEndReached={() => {
        if (tab === 'mine' && hasMore && !loading) loadMine(page + 1, true)
      }}
    >
      <View>
        {/* 分段切换 */}
        <View
          style={{
            display: 'flex', flexDirection: 'row', backgroundColor: t.bgInput,
            borderRadius: 10, margin: 12, padding: 4
          }}
        >
          {([
            { key: 'submit', label: '提交反馈' },
            { key: 'mine', label: '我的反馈' }
          ] as const).map((seg) => (
            <View
              key={seg.key}
              style={{
                flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 8, borderRadius: 8,
                backgroundColor: tab === seg.key ? t.bgCard : 'transparent'
              }}
              onClick={() => setTab(seg.key)}
            >
              <Text style={{ ...fs(14), fontWeight: tab === seg.key ? '600' : '400', color: tab === seg.key ? t.textPrimary : t.textSecondary }}>
                {seg.label}
              </Text>
            </View>
          ))}
        </View>

        {!isLoggedIn && <LoginGuide icon='message-circle' text='登录后可提交意见反馈' />}

        {/* 提交区 */}
        {tab === 'submit' && isLoggedIn && (
          <View style={{ backgroundColor: t.bgCard, borderRadius: 12, margin: 12, padding: 14 }}>
            <Text style={{ ...fs(14), fontWeight: 'bold', color: t.textSecondary }}>反馈类型 *</Text>
            <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginBottom: 6 }}>
              {FEEDBACK_CATEGORIES.map((c) => {
                const active = category === c.value
                return (
                  <View
                    key={c.value}
                    style={{
                      paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 14,
                      marginRight: 8, marginBottom: 8,
                      backgroundColor: active ? t.primaryLight : t.bgInput,
                      borderStyle: 'solid', borderWidth: 1, borderColor: active ? t.primary : 'transparent'
                    }}
                    onClick={() => setCategory(c.value)}
                  >
                    <Text style={{ ...fs(13), color: active ? t.primary : t.textSecondary }}>{c.label}</Text>
                  </View>
                )
              })}
            </View>

            <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <Text style={{ ...fs(14), fontWeight: 'bold', color: t.textSecondary }}>反馈内容 *</Text>
              <Text style={{ ...fs(12), color: t.textTertiary }}>{contentLength}/{MAX_CONTENT}</Text>
            </View>
            <Textarea
              value={content}
              onInput={(e) => setContent(e.detail.value)}
              placeholder='请描述您遇到的问题或建议，越具体越有助于我们处理'
              placeholderStyle={`color:${t.textTertiary}`}
              maxlength={MAX_CONTENT}
              style={{
                ...fs(15), color: t.textPrimary, backgroundColor: t.bgInput, borderRadius: 10,
                padding: 12, height: 132, marginTop: 8
              }}
            />

            <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <Text style={{ ...fs(14), fontWeight: 'bold', color: t.textSecondary }}>图片（选填）</Text>
              <Text style={{ ...fs(12), color: t.textTertiary }}>{images.length}/{MAX_IMAGES}</Text>
            </View>
            <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
              {images.map((url) => (
                <View key={url} style={{ marginRight: 10, marginBottom: 8, alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
                  <MediaImage url={url} mode='aspectFill' style={{ width: 76, height: 76, borderRadius: 8 }} />
                  <Text
                    style={{ ...fs(12), color: t.danger, marginTop: 4 }}
                    onClick={() => removeImage(url)}
                  >
                    删除
                  </Text>
                </View>
              ))}
              {images.length < MAX_IMAGES && (
                <View
                  style={{
                    width: 76, height: 76, borderRadius: 8, borderStyle: 'dashed', borderWidth: 1,
                    borderColor: t.border, alignItems: 'center', justifyContent: 'center', display: 'flex'
                  }}
                  onClick={addImage}
                >
                  {uploading
                    ? <Text style={{ ...fs(12), color: t.textTertiary }}>上传中</Text>
                    : <Icon name="plus" size={22} color={t.textTertiary} />}
                </View>
              )}
            </View>

            <Text style={{ ...fs(14), fontWeight: 'bold', color: t.textSecondary, marginTop: 8 }}>联系方式（选填）</Text>
            <Input
              value={contact}
              onInput={(e) => setContact(e.detail.value)}
              placeholder='手机号或微信号，便于需要时联系您'
              placeholderStyle={`color:${t.textTertiary}`}
              maxlength={100}
              style={{
                ...fs(15), color: t.textPrimary, backgroundColor: t.bgInput, borderRadius: 10,
                paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, marginTop: 8
              }}
            />

            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 10 }}>
              我们会尽快查看并回复，回复结果可在“我的反馈”查看。
            </Text>

            <View
              style={{
                height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', display: 'flex',
                marginTop: 16, backgroundColor: canSubmit ? t.primary : t.bgInput
              }}
              onClick={onSubmit}
            >
              <Text style={{ ...fs(16), color: canSubmit ? '#FFFFFF' : t.textTertiary }}>
                {submitting ? '提交中...' : '提交反馈'}
              </Text>
            </View>
          </View>
        )}

        {/* 我的反馈 */}
        {tab === 'mine' && isLoggedIn && (
          <View>
            {items.length === 0 && !loading && (
              <View style={{ display: 'flex', alignItems: 'center', paddingTop: 100 }}>
                <Icon name="message-circle" size={48} color={t.textTertiary} />
                <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>
                  还没有提交过反馈，欢迎告诉我们问题和建议
                </Text>
              </View>
            )}
            {items.map((item) => {
              const st = statusBadge(item.status, t)
              return (
                <View
                  key={item.id}
                  style={{ backgroundColor: t.bgCard, borderRadius: 12, marginLeft: 12, marginRight: 12, marginTop: 10, padding: 14 }}
                >
                  <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ ...fs(13), color: t.textSecondary }}>{item.categoryText}</Text>
                    <View style={{ backgroundColor: `${st.color}22`, borderRadius: 10, paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2 }}>
                      <Text style={{ ...fs(12), color: st.color }}>{st.label}</Text>
                    </View>
                  </View>
                  <Text style={{ ...fs(15), color: t.textPrimary, marginTop: 8 }}>{item.content}</Text>
                  {(item.imageUrls || []).length > 0 && (
                    <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                      {(item.imageUrls || []).map((url) => (
                        <MediaImage
                          key={url}
                          url={url}
                          mode='aspectFill'
                          style={{ width: 64, height: 64, borderRadius: 8, marginRight: 8, marginBottom: 8 }}
                        />
                      ))}
                    </View>
                  )}
                  {item.adminReply && (
                    <View style={{ backgroundColor: t.bgInput, borderRadius: 10, padding: 10, marginTop: 8 }}>
                      <Text style={{ ...fs(12), color: t.textTertiary }}>平台回复</Text>
                      <Text style={{ ...fs(14), color: t.textPrimary, marginTop: 4 }}>{item.adminReply}</Text>
                    </View>
                  )}
                  <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 8 }}>{formatTime(item.createdAt)}</Text>
                </View>
              )
            })}
            {loading && (
              <Text style={{ ...fs(13), color: t.textTertiary, textAlign: 'center', paddingTop: 12, paddingBottom: 24 }}>加载中...</Text>
            )}
            {!loading && hasMore && items.length > 0 && (
              <Text
                style={{ ...fs(13), color: t.textTertiary, textAlign: 'center', paddingTop: 12, paddingBottom: 24 }}
                onClick={() => loadMine(page + 1, true)}
              >
                上拉或点击加载更多
              </Text>
            )}
          </View>
        )}

        <View style={{ height: 24 }} />
      </View>
    </PageLayout>
  )
}