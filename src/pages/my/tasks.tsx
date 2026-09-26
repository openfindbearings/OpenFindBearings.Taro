// 任务中心页（v1.7.18）：每日签到日期条 + 赚分任务列表
// 设计：签到做成"今天居中、前后各 3 天"的 7 格日期条，一眼看到漏签/已签/未来；
//       任务列表来自 API /points/tasks（规则+完成态）——daily 任务完成态只看今日流水，
//       次日自动刷新回未完成；once 任务（注册/入驻）看历史，完成即永久完成。
// RN 约束：仅 flex 布局、无 fixed/vh/gradient、Text 包裹、lineHeight 数值
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import LoginGuide from '../../components/LoginGuide'
import NavBar from '../../components/NavBar'
import { useAuthStore } from '../../stores/auth'
import { vibrateSuccess } from '../../utils/haptics'
import {
  getPointAccount, dailyCheckin, getPointTransactions, getPointTasks,
  type PointAccount, type PointTask
} from '../../services/points'

// 编译期配置：禁用外层 ScrollView，滚动由页内 ScrollView 统一提供
definePageConfig({ disableScroll: true })

/** 日期条窗口：今天前后各 3 天 */
const STRIDE_DAYS = 3

/** 业务日期串：后端日任务按业务日界切日（BusinessClock，偏移由 /points/account 的
 *  tzOffsetHours 下发，缺省 +8 北京），前端同口径换算——UTC 早上偏移前的动作归前一天
 *  会导致对勾/今日态错位 */
function bizDateKey(d: Date, offsetHours: number): string {
  const b = new Date(d.getTime() + offsetHours * 3600000)
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, '0')}-${String(b.getUTCDate()).padStart(2, '0')}`
}

/** 星期短标（一二三四五六日） */
const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

/** 任务图标映射（仅用项目内已验证存在的 lucide 名） */
function taskIcon(grantType: string): string {
  switch (grantType) {
    case 'daily_checkin': return 'clock'
    case 'daily_login': return 'user'
    case 'correction_adopted': return 'file_text'
    case 'merchant_approved': return 'users'
    case 'register_bonus': return 'heart'
    default: return 'info'
  }
}

/** 任务行动按钮的目标页（无跳转能力的任务只展示状态） */
function taskAction(grantType: string): 'checkin' | 'home' | 'merchant' | null {
  switch (grantType) {
    case 'daily_checkin': return 'checkin'
    case 'correction_adopted': return 'home'
    // v1.34.0：资料完善/首件上架都跳商家 Tab（商户管理页内完成动作）
    case 'merchant_approved':
    case 'merchant_profile_complete':
    case 'merchant_first_product': return 'merchant'
    default: return null
  }
}

export default function TasksPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [account, setAccount] = useState<PointAccount>({ balance: 0, totalEarned: 0, totalSpent: 0, todayCheckedIn: false, consecutiveDays: 0 })
  const [tasks, setTasks] = useState<PointTask[]>([])
  // 已签到日集合（业务日期串，来自流水过滤 daily_checkin，按后端下发偏移换算）
  const [checkedDates, setCheckedDates] = useState<Set<string>>(new Set())
  const [checking, setChecking] = useState(false)

  // 拉取账户+任务+签到历史（进入/签到后刷新）
  const refresh = async () => {
    if (!isLoggedIn) return
    const acc = await getPointAccount()
    setAccount(acc)
    // 日界偏移取后端下发值（缺省 +8 兜底），与 BusinessClock 实时对齐
    const off = acc.tzOffsetHours ?? 8
    setTasks(await getPointTasks())
    const paged = await getPointTransactions(1, 50)
    const set = new Set<string>()
    for (const it of paged?.items || []) {
      if (it.grantType === 'daily_checkin') set.add(bizDateKey(new Date(it.createdAt), off))
    }
    setCheckedDates(set)
  }

  useDidShow(() => { void refresh() })

  // 签到：成功长震+toast，刷新三块数据
  const doCheckin = async () => {
    if (checking || account.todayCheckedIn) return
    setChecking(true)
    const r = await dailyCheckin()
    setChecking(false)
    if (!r) {
      Taro.showToast({ title: '签到失败，请稍后重试', icon: 'none' })
      return
    }
    if (r.alreadyCheckedIn) {
      Taro.showToast({ title: '今日已签到', icon: 'none' })
    } else {
      void vibrateSuccess()
      Taro.showToast({ title: `签到成功 +${r.amount} 积分`, icon: 'success' })
    }
    await refresh()
  }

  // 任务行动：签到=就地执行；去纠错/去入驻=跳对应 Tab
  const runTask = (task: PointTask) => {
    if (task.done) return
    switch (taskAction(task.grantType)) {
      case 'checkin': void doCheckin(); break
      case 'home': Taro.switchTab({ url: '/pages/home/index' }); break
      case 'merchant': Taro.switchTab({ url: '/pages/merchant/index' }); break
      default: break
    }
  }

  // 7 格日期条数据：今天居中，前后各 3 天（偏移按后端下发 tzOffsetHours，与 bizDateKey 同口径）
  const tzOff = account.tzOffsetHours ?? 8
  const today = new Date(Date.now() + tzOff * 3600000)
  const cells: { key: string; label: string; dayNum: number; state: 'done' | 'missed' | 'today' | 'future' }[] = []
  for (let offset = -STRIDE_DAYS; offset <= STRIDE_DAYS; offset++) {
    const d = new Date(today.getTime() + offset * 86400000)
    const key = bizDateKey(d, tzOff)
    const done = checkedDates.has(key)
    cells.push({
      key,
      label: offset === 0 ? '今天' : WEEK_LABELS[d.getUTCDay()],
      dayNum: d.getUTCDate(),
      state: done ? 'done' : offset > 0 ? 'future' : offset === 0 ? 'today' : 'missed'
    })
  }

  return (
    <PageLayout nav={<NavBar title='任务中心' showBack onBack={() => Taro.navigateBack()} />}>
      <ScrollView style={{ flex: 1 }}>
        {!isLoggedIn && <LoginGuide icon='gift' text='登录后可签到赚积分' />}
        {isLoggedIn && (
        <>
        {/* 顶部余额条 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: 12, padding: 16, backgroundColor: t.bgCard, borderRadius: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ ...fs(26), color: t.primary, fontWeight: 'bold' }}>{account.balance}</Text>
            <Text style={{ ...fs(13), color: t.textSecondary, marginLeft: 6 }}>积分</Text>
          </View>
          <Text style={{ ...fs(13), color: t.textSecondary }}>
            {account.consecutiveDays > 0 ? `已连续签到 ${account.consecutiveDays} 天` : '签到赚积分'}
          </Text>
        </View>

        {/* 积分用途说明卡（v1.7.21 额度可见化）：让赚的分有明确消费认知——
            当前真实用途是寻货超额度加量，商城兑换预告 */}
        <View style={{ display: 'flex', flexDirection: 'column', margin: 12, marginTop: 0, backgroundColor: t.bgCard, borderRadius: 12, padding: 14 }}>
          <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>积分能做什么</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Text style={{ ...fs(13), color: t.textSecondary, flex: 1 }}>寻货加量：超出每日免费额度后，花积分继续发布/应答</Text>
            <Text style={{ ...fs(13), color: t.primary }} onClick={() => Taro.switchTab({ url: '/pages/discover/index' })}>去寻货</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Text style={{ ...fs(13), color: t.textSecondary, flex: 1 }}>积分商城：兑换精选礼品</Text>
            <Text style={{ ...fs(13), color: t.textTertiary }}>即将上线</Text>
          </View>
        </View>

        {/* 卡片 1：每日签到日期条 */}
        <View style={{ display: 'flex', flexDirection: 'column', margin: 12, backgroundColor: t.bgCard, borderRadius: 12, padding: 16 }}>
          <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>每日签到</Text>
          <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 2 }}>连续签到天数越多，单日积分越高</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
            {cells.map((c) => (
              <View key={c.key} style={{ alignItems: 'center', width: 38 }}>
                <Text style={{ ...fs(11), color: c.state === 'today' ? t.primary : t.textTertiary, marginBottom: 6 }}>{c.label}</Text>
                <View
                  style={{
                    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: c.state === 'done' ? t.primary : 'transparent',
                    borderWidth: 1.5,
                    borderColor: c.state === 'done' ? t.primary : c.state === 'today' ? t.primary : t.border,
                  }}
                >
                  {c.state === 'done'
                    ? <Icon name='check' size={16} color='#FFFFFF' />
                    : <Text style={{ ...fs(12), color: c.state === 'today' ? t.primary : c.state === 'missed' ? t.textTertiary : t.textSecondary }}>{c.dayNum}</Text>}
                </View>
              </View>
            ))}
          </View>
          <View
            style={{
              marginTop: 16, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
              backgroundColor: account.todayCheckedIn ? t.bgInput : t.primary,
            }}
            onClick={doCheckin}
          >
            <Text style={{ ...fs(15), fontWeight: '600', color: account.todayCheckedIn ? t.textTertiary : '#FFFFFF' }}>
              {account.todayCheckedIn ? '今日已签到' : checking ? '签到中…' : '立即签到'}
            </Text>
          </View>
        </View>

        {/* 卡片 2：赚分任务列表 */}
        <View style={{ display: 'flex', flexDirection: 'column', margin: 12, backgroundColor: t.bgCard, borderRadius: 12, padding: 16 }}>
          <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>赚积分任务</Text>
          {tasks.length === 0 && (
            <Text style={{ ...fs(13), color: t.textTertiary, marginTop: 12 }}>
              {isLoggedIn ? '暂无可参加的任务' : '登录后可查看任务'}
            </Text>
          )}
          {tasks.map((task, i) => (
            <View
              key={task.grantType}
              style={{
                flexDirection: 'row', alignItems: 'center', marginTop: i === 0 ? 12 : 0, paddingTop: i === 0 ? 0 : 12,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.border,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={taskIcon(task.grantType)} size={18} color={t.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ ...fs(14), color: t.textPrimary }}>{task.displayName}</Text>
                  {/* 阶梯任务标注分值区间 */}
                  <Text style={{ ...fs(13), color: t.primary, fontWeight: '600', marginLeft: 6 }}>
                    {task.ladder && task.ladder.length > 0 ? `+${task.amount}~${task.ladder[task.ladder.length - 1]}` : `+${task.amount}`}
                  </Text>
                </View>
                {/* 节奏说明：每日刷新 / 一次性 */}
                <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }} numberOfLines={1}>
                  {task.daily ? '每日可完成' : '一次性任务'}{task.description ? ` · ${task.description}` : ''}
                </Text>
              </View>
              {task.done ? (
                <View style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, borderRadius: 14, backgroundColor: t.bgInput }}>
                  <Text style={{ ...fs(12), color: t.textTertiary }}>{task.daily ? (task.count && task.count > 1 ? `今日已完成  次` : '今日已完成') : '已完成'}</Text>
                </View>
              ) : taskAction(task.grantType) ? (
                <View style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, borderRadius: 14, backgroundColor: t.primary }} onClick={() => runTask(task)}>
                  <Text style={{ ...fs(12), color: '#FFFFFF', fontWeight: '600' }}>
                    {task.grantType === 'daily_checkin' ? '去签到'
                      : task.grantType === 'correction_adopted' ? '去纠错'
                      : task.grantType === 'merchant_profile_complete' ? '去维护'
                      : task.grantType === 'merchant_first_product' ? '去上架'
                      : '去入驻'}
                  </Text>
                </View>
              ) : (
                // 无行动入口的任务（如每日登录自动发放）仅提示
                <Text style={{ ...fs(12), color: t.textTertiary }}>自动发放</Text>
              )}
            </View>
          ))}
        </View>

        {/* 合规三纪律脚注（与商城页口径一致） */}
        <Text style={{ ...fs(11), color: t.textTertiary, textAlign: 'center', marginTop: 4, marginBottom: 24 }}>
          积分不可充值、不可提现、不可转让
        </Text>
        </>
        )}
      </ScrollView>
    </PageLayout>
  )
}
