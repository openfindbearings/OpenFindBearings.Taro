// 商户成员管理页
// 展示当前商户成员列表（含角色/状态），管理员可停用/恢复/变更角色
// 守卫由后端执行：最后一名在职管理员不可被停用/降级，不能操作自己
import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useAuthStore } from '../../stores/auth'
import { useMerchantStore } from '../../stores/merchant'
import {
  getMerchantStaff, suspendMerchantMember, activateMerchantMember, changeMerchantMemberRole,
  type MerchantStaff
} from '../../services/merchant'
import { usableImage } from '../../services/config'

export default function MerchantMembersPage() {
  const t = useTheme()
  const fs = useFs()
  const userId = useAuthStore((s) => s.user?.id)
  // 改动说明 B5：按当前选中商户判定管理员角色（原 merchants[0] 写死首个）
  const cur = useMerchantStore((s) => s.merchants.find((m) => m.merchantId === s.currentMerchantId) ?? s.merchants[0] ?? null)
  const isAdmin = cur?.role === 'MerchantAdmin'

  const [members, setMembers] = useState<MerchantStaff[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => {
    getMerchantStaff()
      .then((r) => setMembers(r?.items ?? []))
      .catch(() => { /* 拉取失败 */ })
  }

  useDidShow(() => {
    load()
  })

  // 修复 B1：busy 状态收敛进 doConfirm 内部统一清理
  // （原实现 doConfirm 无返回值却在调用点链式 .finally，点击操作即运行时 TypeError）
  const doConfirm = (m: MerchantStaff, title: string, content: string, action: () => Promise<any>) => {
    Taro.showModal({ title, content })
      .then(async (res) => {
        if (!res.confirm) return
        setBusyId(m.id)
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
      .catch(() => { /* 取消 */ })
  }

  const onSuspend = (m: MerchantStaff) => {
    doConfirm(m, '停用成员', `停用后「${m.nickname}」立即失去操作权限，可恢复。确认停用？`, () => suspendMerchantMember(m.id))
  }

  const onActivate = (m: MerchantStaff) => {
    doConfirm(m, '恢复成员', `恢复后「${m.nickname}」可重新操作商户。确认恢复？`, () => activateMerchantMember(m.id))
  }

  const onChangeRole = (m: MerchantStaff, targetRole: 'MerchantAdmin' | 'MerchantStaff') => {
    const label = targetRole === 'MerchantAdmin' ? '设为管理员' : '设为员工'
    doConfirm(m, label, `将「${m.nickname}」${label === '设为管理员' ? '提升为管理员' : '降级为员工'}？`, () => changeMerchantMemberRole(m.id, targetRole))
  }

  return (
    <PageLayout nav={<NavBar title="成员管理" showBack />}>
      <View style={{ padding: 14 }}>
        {members.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Icon name="user" size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>暂无成员</Text>
          </View>
        ) : (
          <View style={{ borderRadius: 12, overflow: 'hidden' }}>
            {members.map((m) => {
              const isSelf = m.id === userId
              const suspended = m.status === 'Suspended'
              return (
                <View
                  key={m.id}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgCard, padding: 12, borderBottomWidth: 1, borderBottomColor: t.border, opacity: busyId === m.id ? 0.5 : 1 }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.bgInput, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12 }}>
                    {usableImage(m.avatar)
                      ? <Image style={{ width: 40, height: 40 }} src={usableImage(m.avatar)} mode="aspectFill" />
                      : <Icon name="user" size={20} color={t.textTertiary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...fs(15), color: t.textPrimary }}>{m.nickname}{isSelf ? '（我）' : ''}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Text style={{ ...fs(12), color: m.role === '管理员' ? t.primary : t.textSecondary, marginRight: 8 }}>
                        {m.role || '员工'}
                      </Text>
                      {suspended && (
                        <View style={{ backgroundColor: t.textTertiary, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1 }}>
                          <Text style={{ ...fs(11), color: t.textOnPrimary }}>已停用</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* 管理员操作（不能操作自己） */}
                  {isAdmin && !isSelf && !suspended && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ backgroundColor: t.bgInput, borderRadius: 6, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }} onClick={() => onChangeRole(m, m.role === '管理员' ? 'MerchantStaff' : 'MerchantAdmin')}>
                        <Text style={{ ...fs(12), color: t.primary }}>{m.role === '管理员' ? '降级' : '设为管理员'}</Text>
                      </View>
                      <View style={{ backgroundColor: t.bgInput, borderRadius: 6, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }} onClick={() => onSuspend(m)}>
                        <Text style={{ ...fs(12), color: '#DC2626' }}>停用</Text>
                      </View>
                    </View>
                  )}
                  {isAdmin && !isSelf && suspended && (
                    <View style={{ backgroundColor: t.bgInput, borderRadius: 6, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }} onClick={() => onActivate(m)}>
                      <Text style={{ ...fs(12), color: t.primary }}>恢复</Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </View>
    </PageLayout>
  )
}
