// 商户成员管理页（v1.7.3 重构 + v1.7.4 邀请确认制，对标抖店/美团移动端）
// 列表行 = 头像 + 昵称（本人标"我"）+ 角色/状态徽标；管理员点他人行 → 底部操作面板
//   （设为管理员/降级、停用/恢复、移除），替代原行内挤压小按钮。
// 改动说明：
//   1. isSelf 改用后端权威标记（m.isSelf）——原 m.id === userId 比较的是 API 成员 id 与
//      Identity sub 两套不同源 id，恒 false，本人行错误露出停用/降级按钮（后端守卫会拒但 UI 误导）；
//   2. 新增"移除成员"（DELETE /staff/{userId}，BFF v1.6.3 代理），比停用更彻底；
//   3. 手机号不在列表展示（主流隐私做法，联系走站内渠道）；
//   4. v1.7.4 邀请确认制：添加成员转为发邀请（对方同意后入伙），列表合并"已邀请"行
//      （Status=Invited，无成员 id，key 用 invitationId），点行仅可撤销邀请。
// 守卫由后端执行：最后一名在职管理员不可被停用/降级/移除，不能操作自己
import { useState } from 'react'
import { View, Text, Image, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { useMerchantStore } from '../../stores/merchant'
import {
  getMerchantStaff, suspendMerchantMember, activateMerchantMember, changeMerchantMemberRole, removeMerchantMember, addMerchantMember, revokeStaffInvitation,
  type MerchantStaff
} from '../../services/merchant'
import { usableImage } from '../../services/config'

export default function MerchantMembersPage() {
  const t = useTheme()
  const fs = useFs()
  // 改动说明 B5：按当前选中商户判定管理员角色（原 merchants[0] 写死首个）
  const cur = useMerchantStore((s) => s.merchants.find((m) => m.merchantId === s.currentMerchantId) ?? s.merchants[0] ?? null)
  const isAdmin = cur?.role === 'MerchantAdmin'

  const [members, setMembers] = useState<MerchantStaff[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  // 操作面板目标成员（null=收起）
  const [target, setTarget] = useState<MerchantStaff | null>(null)
  // v1.7.3 添加成员表单（管理员）：contact 手机号或邮箱 + 角色
  const [adding, setAdding] = useState(false)
  const [contact, setContact] = useState('')
  const [addRole, setAddRole] = useState<'MerchantStaff' | 'MerchantAdmin'>('MerchantStaff')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    getMerchantStaff()
      .then((r) => setMembers(r?.items ?? []))
      .catch(() => { /* 拉取失败 */ })
  }

  useDidShow(() => {
    load()
  })

  /** 提交添加成员（v1.7.3）：按联系方式（手机号/邮箱）查注册用户并入伙，失败透传后端文案 */
  const onAddSubmit = () => {
    const v = contact.trim()
    if (!v) { Taro.showToast({ title: '请输入对方手机号或邮箱', icon: 'none' }); return }
    if (submitting) return
    setSubmitting(true)
    const isEmail = v.includes('@')
    addMerchantMember({
      phone: isEmail ? undefined : v,
      email: isEmail ? v : undefined,
      role: addRole
    })
      .then((r) => {
        // 改动说明（v1.7.4 邀请确认制）：后端 message 已是真实文案（邀请已发送/已是在职成员），兜底同步语义
        Taro.showToast({ title: r?.message || '邀请已发送，对方同意后加入', icon: 'none' })
        setAdding(false); setContact(''); setAddRole('MerchantStaff')
        load()
      })
      .catch((e: any) => Taro.showToast({ title: e?.message || '添加失败', icon: 'none' }))
      .finally(() => setSubmitting(false))
  }

  // 修复 B1：busy 状态收敛进 doConfirm 内部统一清理
  // （原实现 doConfirm 无返回值却在调用点链式 .finally，点击操作即运行时 TypeError）
  const doConfirm = (m: MerchantStaff, title: string, content: string, action: () => Promise<any>) => {
    setTarget(null)
    showConfirmDialog({ title, content })
      .then(async (ok) => {
        if (!ok) return
        // 改动说明（v1.7.4）：邀请行无成员 id，busy 标记用 invitationId
        setBusyId(m.invitationId || m.id)
        try {
          await action()
          Taro.showToast({ title: '操作成功', icon: 'success' })
          load()
        } catch (e: any) {
          Taro.showToast({ title: e?.message || '操作失败', icon: 'none' })
        } finally {
          setBusyId(null)
        }
      })
  }

  const onSuspend = (m: MerchantStaff) => {
    doConfirm(m, '停用成员', `停用后「${m.nickname}」立即失去操作权限，可恢复。确认停用？`, () => suspendMerchantMember(m.id))
  }

  const onActivate = (m: MerchantStaff) => {
    doConfirm(m, '恢复成员', `恢复后「${m.nickname}」可重新操作商户。确认恢复？`, () => activateMerchantMember(m.id))
  }

  const onRemove = (m: MerchantStaff) => {
    doConfirm(m, '移除成员', `移除后「${m.nickname}」不再属于本商户，需重新添加。确认移除？`, () => removeMerchantMember(m.id))
  }

  /** 撤销待确认邀请（v1.7.4 邀请确认制：管理员撤回，对方不再能接受） */
  const onRevoke = (m: MerchantStaff) => {
    doConfirm(m, '撤销邀请', `撤销后「${m.nickname}」将不能再接受此邀请。确认撤销？`, () => revokeStaffInvitation(m.invitationId || ''))
  }

  const onChangeRole = (m: MerchantStaff, targetRole: 'MerchantAdmin' | 'MerchantStaff') => {
    const label = targetRole === 'MerchantAdmin' ? '设为管理员' : '设为员工'
    doConfirm(m, label, `将「${m.nickname}」${targetRole === 'MerchantAdmin' ? '提升为管理员' : '降级为员工'}？`, () => changeMerchantMemberRole(m.id, targetRole))
  }

  /** 面板单行动作 */
  const sheetAction = (label: string, color: string, onPress: () => void) => (
    <View
      style={{ backgroundColor: t.bgCard, borderRadius: 10, paddingTop: 13, paddingBottom: 13, alignItems: 'center', marginBottom: 8 }}
      onClick={onPress}
    >
      <Text style={{ ...fs(15), color }}>{label}</Text>
    </View>
  )

  const suspended = target?.status === 'Suspended'
  const targetIsAdmin = target?.role === '管理员'

  return (
    <PageLayout nav={<NavBar title="成员管理" showBack />}>
      <View style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 12 }}>
        {/* v1.7.3 操作栏：管理员可添加成员（对标主流店铺员工管理） */}
        {isAdmin && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.primary, borderRadius: 18, paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7 }}
              onClick={() => setAdding((v) => !v)}
            >
              <Icon name="user-plus" size={14} color={t.textOnPrimary} />
              <Text style={{ ...fs(13), color: t.textOnPrimary, marginLeft: 4 }}>添加成员</Text>
            </View>
          </View>
        )}

        {/* 添加成员表单（内联展开）：手机号/邮箱 + 角色二选 */}
        {adding && isAdmin && (
          <View style={{ backgroundColor: t.bgCard, borderRadius: 12, padding: 12, marginTop: 10 }}>
            <Text style={{ ...fs(13), color: t.textSecondary, marginBottom: 8 }}>输入对方注册时用的手机号或邮箱</Text>
            <Input
              style={{ ...fs(14), color: t.textPrimary, backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8 }}
              value={contact}
              placeholder="手机号 / 邮箱"
              placeholderClass="auth-ph"
              onInput={(e) => setContact(e.detail.value)}
            />
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              {(['MerchantStaff', 'MerchantAdmin'] as const).map((r) => (
                <View
                  key={r}
                  style={{ marginRight: 10, borderRadius: 16, paddingLeft: 14, paddingRight: 14, paddingTop: 6, paddingBottom: 6, backgroundColor: addRole === r ? t.primary : t.bgInput }}
                  onClick={() => setAddRole(r)}
                >
                  <Text style={{ ...fs(13), color: addRole === r ? t.textOnPrimary : t.textSecondary }}>{r === 'MerchantAdmin' ? '管理员' : '员工'}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <View
                style={{ backgroundColor: t.bgInput, borderRadius: 16, paddingLeft: 18, paddingRight: 18, paddingTop: 7, paddingBottom: 7, marginRight: 10 }}
                onClick={() => { setAdding(false); setContact(''); setAddRole('MerchantStaff') }}
              >
                <Text style={{ ...fs(13), color: t.textPrimary }}>取消</Text>
              </View>
              <View
                style={{ backgroundColor: submitting ? t.textTertiary : t.primary, borderRadius: 16, paddingLeft: 18, paddingRight: 18, paddingTop: 7, paddingBottom: 7 }}
                onClick={submitting ? undefined : onAddSubmit}
              >
                <Text style={{ ...fs(13), color: t.textOnPrimary }}>{submitting ? '提交中…' : '添加'}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={{ padding: 14 }}>
        {members.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Icon name="user" size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>暂无成员</Text>
          </View>
        ) : (
          <View style={{ borderRadius: 12, overflow: 'hidden' }}>
            {members.map((m) => {
              // 改动说明（v1.7.3）：isSelf 用后端标记（前端 id 不同源无法自判，原比较恒 false）
              // 改动说明（v1.7.4 邀请确认制）：Invited 行为待确认邀请（无成员 id），
              //   key 用 invitationId 防多邀请行 id 全空冲突；点击进面板仅可撤销
              const isSelf = m.isSelf
              const isInvited = m.status === 'Invited'
              const mSuspended = m.status === 'Suspended'
              const rowKey = m.invitationId || m.id
              return (
                <View
                  key={rowKey}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgCard, padding: 12, borderBottomWidth: 1, borderBottomColor: t.border, opacity: busyId === rowKey ? 0.5 : 1 }}
                  onClick={isAdmin && (isInvited || !isSelf) ? () => setTarget(m) : undefined}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.bgInput, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12 }}>
                    {usableImage(m.avatar)
                      ? <Image style={{ width: 40, height: 40 }} src={usableImage(m.avatar)} mode="aspectFill" />
                      : <Icon name={isInvited ? 'mail' : 'user'} size={20} color={t.textTertiary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ ...fs(15), color: t.textPrimary }} numberOfLines={1}>{m.nickname}</Text>
                      {isSelf && (
                        <View style={{ marginLeft: 6, borderRadius: 4, backgroundColor: t.bgInput, paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1 }}>
                          <Text style={{ ...fs(10), color: t.textTertiary }}>我</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <View style={{ borderRadius: 4, backgroundColor: t.bgInput, paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1, marginRight: 8 }}>
                        <Text style={{ ...fs(11), color: m.role === '管理员' ? t.primary : t.textSecondary }}>{isInvited ? (m.role || '待确认') : (m.role || '员工')}</Text>
                      </View>
                      {isInvited && (
                        <View style={{ backgroundColor: '#F59E0B', borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1 }}>
                          <Text style={{ ...fs(11), color: '#FFFFFF' }}>已邀请</Text>
                        </View>
                      )}
                      {mSuspended && (
                        <View style={{ backgroundColor: t.textTertiary, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1 }}>
                          <Text style={{ ...fs(11), color: t.textOnPrimary }}>已停用</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {isAdmin && (isInvited || !isSelf) && <Icon name="chevron-right" size={16} color={t.textTertiary} />}
                </View>
              )
            })}
          </View>
        )}
      </View>

      {/* 底部操作面板（自绘覆盖层，absolute 于页面根；RN 无 fixed） */}
      {target && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.45)' }} onClick={() => setTarget(null)}>
          <View
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.bgPage, paddingTop: 16, paddingLeft: 16, paddingRight: 16, paddingBottom: 24, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Text style={{ ...fs(13), color: t.textTertiary, textAlign: 'center', marginBottom: 12 }}>
              {target.nickname}（{target.role || '员工'}）
            </Text>
            {/* 改动说明（v1.7.4 邀请确认制）：Invited 行仅可撤销邀请，成员行保留角色/停用/移除操作 */}
            {target.status === 'Invited'
              ? sheetAction('撤销邀请', '#DC2626', () => onRevoke(target))
              : (
                <>
                  {!suspended && sheetAction(targetIsAdmin ? '降级为员工' : '设为管理员', t.textPrimary, () => onChangeRole(target, targetIsAdmin ? 'MerchantStaff' : 'MerchantAdmin'))}
                  {!suspended && sheetAction('停用成员', '#DC2626', () => onSuspend(target))}
                  {suspended && sheetAction('恢复成员', t.primary, () => onActivate(target))}
                  {sheetAction('移除成员', '#DC2626', () => onRemove(target))}
                </>
              )}
            {sheetAction('取消', t.textSecondary, () => setTarget(null))}
          </View>
        </View>
      )}
    </PageLayout>
  )
}
