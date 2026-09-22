// SwipeCell 左滑操作单元格（RN 版，接口与 index.tsx 完全一致，Metro 自动按平台解析）
// 实现方式为 RN 左滑行主流方案（react-native-swipe-list-view 同构）：
//   PanResponder 方向锁接管横向手势 + Animated.Value 承载位移（useNativeDriver，
//   数值直发 UI 线程 60fps 更新，不走 React 重渲染）+ 松手 Animated.timing 吸附/回弹；
//   横向锁定后拒绝 ScrollView 的终止请求（onResponderTerminationRequest=false），
//   纵向手势不接管、滚动互不干扰。
import { View as RNView, Text as RNText, Animated, PanResponder, StyleSheet, Easing } from 'react-native'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useFs } from '../../hooks/useFontScale'
import { vibrateTap } from '../../utils/haptics'

/** 右侧滑出的单个操作 */
export interface SwipeCellAction {
  key: string
  label: string
  color: string
  bg: string
  onPress: () => void
}

export interface SwipeCellProps {
  /** 右侧操作列表（自左向右排列），点击后自动收起 */
  actions: SwipeCellAction[]
  /** 受控展开态：父级只允许一个单元格展开时用于互斥收起（外部置 false 时组件复位） */
  opened?: boolean
  /** 展开态变化回调（仅由用户手势触发；外部受控复位不回调，避免互斥时误清新开者） */
  onOpenChange?: (open: boolean) => void
  /** 容器附加样式（阴影/圆角/外边距等，阴影放容器而非内容层，避免 overflow:hidden 裁掉） */
  containerStyle?: object
  /** 单个操作条宽度（dp） */
  actionWidth?: number
  /** 容器圆角（与内容卡片一致，裁切滑出的操作条边角） */
  radius?: number
  children: ReactNode
}

/** 判定方向锁的最小水平位移（dp） */
const MOVE_THRESHOLD = 4

/** 决定性甩速阈值（dp/ms）：超过才允许速度覆盖位置阈值判定 */
const FLING_V = 0.35

/**
 * 左滑操作单元格 RN 版：操作条绝对定位垫底，Animated.View 内容层跟手平移，
 * 展开态叠加透明遮罩拦截首次点击（点击=收起）。
 */
export default function SwipeCell({
  actions,
  opened = false,
  onOpenChange,
  containerStyle,
  actionWidth = 72,
  radius = 16,
  children
}: SwipeCellProps) {
  const fs = useFs()
  const total = actions.length * actionWidth

  // 位移载体：native driver 直接驱动 transform，不触发 React 渲染
  const tx = useRef(new Animated.Value(0)).current
  const [isOpened, setIsOpened] = useState(opened)
  const openedRef = useRef(opened)
  openedRef.current = isOpened
  const onOpenCbRef = useRef(onOpenChange)
  onOpenCbRef.current = onOpenChange
  // 当前手势状态：方向锁 + 起始静止位（展开态再次拖拽时从 -total 起算）+ 最近一次位移（release 兜底）
  const gRef = useRef({ lock: '' as '' | 'h' | 'v', base: 0, dx: 0 })

  /**
   * 吸附到目标位：位置过半则开、否则关；速度仅在"方向决定性"时覆盖位置判定。
   * 改动说明：上一版"位置+vx外推"会在拖满后松手瞬间的右向漂移(vx>0)把落点推回关闭，
   *   表现为"滑出来又缩回去"。正解（RNGH Swipeable 语义）：vx < -FLING_V 果断甩开、
   *   vx > FLING_V 果断甩关，其余情况只看释放位置，杜绝末帧速度噪声干扰。
   */
  const snap = (cur: number, vx = 0) => {
    gRef.current.lock = ''
    const target = vx < -FLING_V ? -total : vx > FLING_V ? 0 : cur < -total / 2 ? -total : 0
    Animated.timing(tx, {
      toValue: target,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start()
    const open = target !== 0
    setIsOpened(open)
    // 改动说明（v1.7.13）：滑出动作菜单时轻震反馈（应用级震动开关内建，关则无感）
    if (open) void vibrateTap()
    onOpenCbRef.current?.(open)
  }

  // 外部受控互斥收起/展开：兄弟单元格改变 openId 时本组件静默跟随（不回调）
  useEffect(() => {
    if (!opened && isOpened) {
      setIsOpened(false)
      Animated.timing(tx, { toValue: 0, duration: 220, useNativeDriver: true }).start()
    } else if (opened && !isOpened) {
      setIsOpened(true)
      Animated.timing(tx, { toValue: -total, duration: 220, useNativeDriver: true }).start()
    }
  }, [opened, isOpened, total, tx])

  // PanResponder 仅创建一次：闭包经 ref 读最新状态，避免陈旧值
  // 改动说明（RN 失灵根因修复）：Taro 的 View 在绑定 onClick 时，内部 useClickable 会挂
  //   PanResponder 且 onStartShouldSetPanResponder 恒响应（按下即当 responder、无 move 协商），
  //   外层 bubble 阶段的 move 协商被其挡住，导致"滑不出来"。修法：改用 capture 阶段协商
  //   （内核会向现任 responder 发终止请求，Taro useClickable 对终止请求恒放行），方向锁成立
  //   后由外层接管手势；纯点击（移动 <4dp）不协商、子树 onClick 正常。
  const lockIfHorizontal = (s: { dx: number; dy: number; vx: number }): boolean => {
    const g = gRef.current
    if (g.lock) return g.lock === 'h'
    if (Math.abs(s.dx) > MOVE_THRESHOLD && Math.abs(s.dx) > Math.abs(s.dy) * 1.2) {
      g.lock = 'h'
      g.base = openedRef.current ? -total : 0
      return true
    }
    if (Math.abs(s.dy) > 6) {
      g.lock = 'v'
      return false
    }
    // 几乎不动即快速回弹（vx 大、纵向位移极小）：也按横向处理，支持轻扫甩动展开
    if (Math.abs(s.vx) > 0.5 && Math.abs(s.dy) <= 6) {
      g.lock = 'h'
      g.base = openedRef.current ? -total : 0
      return true
    }
    return false
  }

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, s) => lockIfHorizontal(s),
    onMoveShouldSetPanResponderCapture: (_e, s) => lockIfHorizontal(s),
    onPanResponderMove: (_e, s) => {
      const g = gRef.current
      if (g.lock === 'h') {
        g.dx = s.dx
        tx.setValue(Math.min(0, Math.max(-total, g.base + s.dx)))
      }
    },
    onPanResponderRelease: (_e, s) => {
      const g = gRef.current
      if (g.lock === 'h') snap(g.base + s.dx, s.vx)
      else g.lock = ''
    },
    onPanResponderTerminate: () => {
      const g = gRef.current
      if (g.lock === 'h') snap(g.base + g.dx)
      g.lock = ''
    },
    // 横向锁定后拒绝外层 ScrollView 夺走手势；其余（纯点击/纵向）放行，交互互不干扰
    onResponderTerminationRequest: () => gRef.current.lock !== 'h'
    // 改动说明（v1.7.2）：create 参数 cast any——RN 类型定义要求回调带 typed event 参数，
    //   本实现省略未用参数是合法 JS，仅类型声明不匹配（Metro 不检查，tsc 门禁消噪）
  } as any), [total, tx])

  return (
    <RNView
      style={[styles.root, { borderRadius: radius }, containerStyle]}
      {...(pan.panHandlers as any)}
    >
      {/* 操作条垫底，内容层盖在其上，左滑露出 */}
      <RNView style={styles.actions}>
        {actions.map((a) => (
          <RNView
            key={a.key}
            style={[styles.action, { width: actionWidth, backgroundColor: a.bg }]}
            onStartShouldSetResponderCapture={() => true}
            onResponderTerminationRequest={() => false}
            onResponderRelease={() => { snap(0); a.onPress() }}
          >
            {/* 改动说明（v1.7.2）：fs() 返回类型是 RN数值|H5字符串 联合，TS 无法收窄 IS_RN；
                本文件仅 RN 编译，运行时恒为数值，cast 过 RNText 严格样式类型 */}
            <RNText style={{ ...(fs(13) as { fontSize: number; lineHeight: number }), color: a.color } as any}>{a.label}</RNText>
          </RNView>
        ))}
      </RNView>
      <Animated.View style={{ transform: [{ translateX: tx }] }}>
        {children}
      </Animated.View>
      {/* 展开态遮罩：盖住内容区（right 让出露出的操作条），首次点击=收起。
          改动说明：capture 抢 responder + 拒绝终止，防内容卡片（Taro View 带 onClick 按下即持有
          responder）把点击透传成卡片 onClick，保证"首点只收起不触发卡片" */}
      {isOpened && (
        <RNView
          style={[StyleSheet.absoluteFill, { right: total }]}
          onStartShouldSetResponderCapture={() => true}
          onResponderTerminationRequest={() => false}
          onResponderRelease={() => snap(0)}
        />
      )}
    </RNView>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    overflow: 'hidden'
  },
  actions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row'
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center'
  }
})
