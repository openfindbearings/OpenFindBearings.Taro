// 个人信息编辑页：昵称/头像/职业/公司/行业。保存经 BFF PUT /mobile/profile（双写 Identity + 业务库），
// 成功后 store 重拉 profile，全站昵称/资料即时更新。手机号为登录账号不可改（Identity 无自助换绑端点）。
import { useState } from 'react'
import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useAuthStore } from '../../stores/auth'
import { getProfile, updateProfile, uploadAvatar, type ProfileInfo } from '../../services/user'
import { usableImage, PRESET_AVATARS } from '../../services/config'

definePageConfig({ disableScroll: true })

/** 职业编码（对齐 API UserOccupation 枚举：1采购/2销售/3工程师/4其他） */
const OCCUPATIONS = [
  { value: 1, label: '采购' },
  { value: 2, label: '销售' },
  { value: 3, label: '工程师' },
  { value: 4, label: '其他' }
]

/** 个人信息编辑页：载入当前聚合资料，可编辑展示字段并保存 */
export default function ProfileEditPage() {
  const t = useTheme()
  const fs = useFs()
  const fetchProfile = useAuthStore((s) => s.fetchProfile)

  const [form, setForm] = useState({ nickname: '', avatar: '', occupation: 0, companyName: '', industry: '' })
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // 头像选择面板开关与上传中标记
  const [pickerOpen, setPickerOpen] = useState(false)
  const [uploading, setUploading] = useState(false)

  /** 从相册/相机选图并上传，成功后回填表单头像（保存时统一落库） */
  const pickFromAlbum = () => {
    Taro.chooseImage({ count: 1, sizeType: ['compressed'] })
      .then(async (res) => {
        const filePath = res.tempFilePaths[0]
        if (!filePath) return
        setUploading(true)
        try {
          const r = await uploadAvatar(filePath)
          if (r?.success && r.url) {
            setField('avatar', r.url)
            setPickerOpen(false)
            Taro.showToast({ title: '头像已选择，保存后生效', icon: 'none' })
          } else {
            Taro.showToast({ title: r?.message || '上传失败', icon: 'none' })
          }
        } catch {
          Taro.showToast({ title: '上传失败', icon: 'none' })
        } finally { setUploading(false) }
      })
      .catch((e) => {
        // 改动说明：原静默 catch 把"原生模块缺失"这类真实故障也吞了（Metro 无痕迹难排查），
        // 现区分输出：用户主动取消无 errMsg，其余打日志并提示
        if (e && (e as any).errMsg) {
          console.error('[profile] chooseImage 失败', (e as any).errMsg)
          Taro.showToast({ title: '打开相册/相机失败', icon: 'none' })
        }
      })
  }

  /** 拉取聚合资料回填表单（仅首次显示时） */
  useDidShow(() => {
    if (loaded) return
    getProfile()
      .then((p: ProfileInfo) => {
        if (!p) return
        setPhone(p.phoneNumber || '')
        setForm({
          nickname: p.nickname || '',
          avatar: p.avatar || '',
          occupation: p.occupation || 0,
          companyName: p.companyName || '',
          industry: p.industry || ''
        })
        setLoaded(true)
      })
      .catch(() => { /* 拉取失败保持空表单，仍可编辑提交 */ })
  })

  const setField = (k: keyof typeof form, v: string | number) => setForm((prev) => ({ ...prev, [k]: v }))

  /** 职业选择（ActionSheet，0 表示未设置） */
  const pickOccupation = () => {
    Taro.showActionSheet({ itemList: ['未设置', ...OCCUPATIONS.map((o) => o.label)] })
      .then((res) => {
        const v = res.tapIndex === 0 ? 0 : OCCUPATIONS[res.tapIndex - 1]?.value || 0
        setField('occupation', v)
      })
      .catch(() => { /* 用户取消 */ })
  }

  /** 保存：提交展示字段（部分更新语义），成功后重拉聚合资料并返回 */
  const onSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const r = await updateProfile({
        nickname: form.nickname.trim(),
        avatar: form.avatar.trim(),
        occupation: form.occupation || undefined,
        companyName: form.companyName.trim(),
        industry: form.industry.trim()
      })
      if (r?.success) {
        // 重拉聚合资料，"我的"页与本页返回后即时显示新昵称
        await fetchProfile()
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 600)
      } else {
        Taro.showToast({ title: r?.message || '保存失败', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '保存失败', icon: 'none' })
    } finally { setSaving(false) }
  }

  /** 单行字段：左标题 + 右输入（RN 安全样式，无 position/伪元素） */
  const fieldRow = (label: string, node: any) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgCard, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border }}>
      <Text style={{ ...fs(15), color: t.textPrimary, width: 88 }}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{node}</View>
    </View>
  )

  const inputStyle = { ...fs(15), color: t.textPrimary, textAlign: 'right' as const, flex: 1 }

  return (
    <PageLayout nav={<NavBar title="个人信息" showBack />}>
      {/* 头像预览：点击打开选择面板（预置 6 格 + 相册上传）；仅绝对地址可渲染 */}
      <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 20, backgroundColor: t.bgCard, marginBottom: 12 }}>
        <View
          style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.bgInput, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          onClick={() => setPickerOpen(!pickerOpen)}
        >
          {usableImage(form.avatar)
            ? <Image style={{ width: 72, height: 72 }} src={usableImage(form.avatar)} mode="aspectFill" />
            : <Icon name="user" size={36} color={t.textTertiary} />}
        </View>
        <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 8 }}>点击更换头像</Text>

        {/* 头像选择面板（内联展开，RN 无 position:fixed 约束） */}
        {pickerOpen && (
          <View style={{ width: 280, marginTop: 14, backgroundColor: t.bgInput, borderRadius: 12, paddingTop: 14, paddingBottom: 14, paddingLeft: 12, paddingRight: 12 }}>
            <Text style={{ ...fs(13), color: t.textSecondary, marginBottom: 10 }}>预置头像</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {PRESET_AVATARS.map((url) => {
                const selected = form.avatar === url
                return (
                  <View
                    key={url}
                    style={{ width: 64, height: 64, borderRadius: 32, marginBottom: 10, alignItems: 'center', justifyContent: 'center', borderWidth: selected ? 3 : 0, borderColor: t.primary, overflow: 'hidden' }}
                    onClick={() => { setField('avatar', url); setPickerOpen(false) }}
                  >
                    <Image style={{ width: 56, height: 56, borderRadius: 28 }} src={url} mode="aspectFill" />
                  </View>
                )
              })}
            </View>
            <View
              style={{ backgroundColor: uploading ? t.textTertiary : t.primary, borderRadius: 20, paddingTop: 8, paddingBottom: 8, alignItems: 'center', marginTop: 4 }}
              onClick={uploading ? undefined : pickFromAlbum}
            >
              <Text style={{ ...fs(14), color: t.textOnPrimary }}>{uploading ? '上传中…' : '从相册上传'}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={{ marginBottom: 12 }}>
        {fieldRow('手机号', <Text style={{ ...fs(15), color: t.textTertiary }}>{phone || '未绑定'}</Text>)}
        {fieldRow('昵称', <Input style={inputStyle} value={form.nickname} maxlength={30} placeholder="请输入昵称" placeholderClass="auth-ph" onInput={(e) => setField('nickname', e.detail.value)} />)}
        {/* 改动说明：删除"头像地址"输入行——头像由上方预览直接展示，URL 编辑体验差；
            form.avatar 仍随资料回填与保存透传，不清空已存头像 */}
        {fieldRow('职业', (
          <View style={{ flexDirection: 'row', alignItems: 'center' }} onClick={pickOccupation}>
            <Text style={{ ...fs(15), color: form.occupation ? t.textPrimary : t.textTertiary }}>
              {OCCUPATIONS.find((o) => o.value === form.occupation)?.label || '未设置'}
            </Text>
            <Icon name="chevron-right" size={16} color={t.textTertiary} />
          </View>
        ))}
        {fieldRow('公司名称', <Input style={inputStyle} value={form.companyName} maxlength={50} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('companyName', e.detail.value)} />)}
        {fieldRow('所属行业', <Input style={inputStyle} value={form.industry} maxlength={30} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('industry', e.detail.value)} />)}
      </View>

      <View
        style={{ backgroundColor: saving ? t.textTertiary : t.primary, borderRadius: 24, paddingTop: 12, paddingBottom: 12, alignItems: 'center', marginLeft: 16, marginRight: 16 }}
        onClick={saving ? undefined : onSave}
      >
        <Text style={{ ...fs(16), color: t.textOnPrimary }}>{saving ? '保存中…' : '保存'}</Text>
      </View>
      <Text style={{ ...fs(12), color: t.textTertiary, textAlign: 'center', marginTop: 10 }}>
        手机号为登录账号，如需变更请联系客服
      </Text>
    </PageLayout>
  )
}
