// SwipeCell 左滑操作单元格（H5 / 小程序版）——京东购物车式：内容层跟手左移，露出右侧操作条
// 实现方式为主流通用方案：Taro 触摸事件驱动 translate3d（GPU 合成层）跟手，
// 松手用 CSS transition 吸附/回弹；拖拽期间关闭 transition 保证跟手，方向锁避免与纵向页面滚动打架。
// RN 端由 index.rn.tsx 提供 PanResponder + Animated(native driver) 的同接口实现（Metro 自动按平台解析）。
import { View, Text } from '@tarojs/components'
import type { ITouchEvent } from '@tarojs/components'
import { ReactNode, CSSProperties, useEffect, useRef, useState } from 'react'
import { useFs } from '../../hooks/useFontScale'
import './index.scss'
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
  containerStyle?: CSSProperties
  /** 单个操作条宽度（px） */
  actionWidth?: number
  /** 容器圆角（与内容卡片一致，裁切滑出的操作条边角） */
  radius?: number
  children: ReactNode
}

/** 判定方向锁的位移阈值（px），低于此值不认定手势，避免触摸抖动误锁 */
const LOCK_THRESHOLD = 4

/** 决定性甩速阈值（px/ms）：超过才允许速度覆盖位置阈值判定（RNGH Swipeable 语义） */
const FLING_V = 0.35

/** 速度样本有效期（ms）：release 前超过此时长无 move 采样视为已停手，速度归零防噪声误判 */
const STALE_MS = 80

/**
 * 左滑操作单元格：内容层绝对定位盖在操作条之上，横向拖拽平移内容层露出操作。
 * 手势流：touchstart 记基准点 -> touchmove 方向锁（|dx|>|dy|×1.3 认定横向接管，反之放弃本次）
 * -> touchend 过半吸附展开、否则回弹，全程 translate3d + 受控 transition。
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
  const [dx, setDx] = useState(0)
  // anim=true 时启用 CSS transition（吸附/回弹阶段），拖拽跟手阶段关闭
  const [anim, setAnim] = useState(false)
  const [isOpened, setIsOpened] = useState(opened)
  const gRef = useRef({ x: 0, y: 0, lock: '' as '' | 'h' | 'v', base: 0, lx: 0, lt: 0, vx: 0 })
  const dxRef = useRef(0)
  const openedRef = useRef(opened)
  openedRef.current = isOpened

  /** 吸附到目标位（0=关闭 / -total=展开），并同步展开态与回调 */
  const snap = (target: number) => {
    setAnim(true)
    dxRef.current = target
    setDx(target)
    const open = target !== 0
    setIsOpened(open)
    // 改动说明（v1.7.13）：滑出动作菜单时轻震反馈（应用级震动开关内建，关则无感）
    if (open) void vibrateTap()
    onOpenChange?.(open)
  }

  // 外部受控互斥收起：兄弟单元格展开时本组件 opened 变 false，静默复位（不回调，防误清新开者）
  useEffect(() => {
    if (!opened && isOpened) {
      setAnim(true)
      dxRef.current = 0
      setDx(0)
      setIsOpened(false)
    }
  }, [opened, isOpened])

  const onTouchStart = (e: ITouchEvent) => {
    const pt = e.touches[0]
    if (!pt) return
    setAnim(false)
    gRef.current = {
      x: pt.pageX,
      y: pt.pageY,
      lock: '',
      base: isOpened ? -total : 0,
      lx: pt.pageX,
      lt: Date.now(),
      vx: 0
    }
  }

  const onTouchMove = (e: ITouchEvent) => {
    const pt = e.touches[0]
    if (!pt) return
    const g = gRef.current
    const ddx = pt.pageX - g.x
    const ddy = pt.pageY - g.y
    if (!g.lock) {
      // 方向锁：先达到阈值的一侧定胜负，横向接管平移、纵向让位给页面滚动
      if (Math.abs(ddx) > LOCK_THRESHOLD && Math.abs(ddx) > Math.abs(ddy) * 1.2) g.lock = 'h'
      else if (Math.abs(ddy) > LOCK_THRESHOLD) g.lock = 'v'
    }
    if (g.lock === 'h') {
      // 采样瞬时速度（px/ms），供 release 甩动判定
      const now = Date.now()
      const dt = now - g.lt
      if (dt > 0) {
        g.vx = (pt.pageX - g.lx) / dt
        g.lx = pt.pageX
        g.lt = now
      }
      const v = Math.min(0, Math.max(-total, g.base + ddx))
      if (v !== dxRef.current) {
        dxRef.current = v
        setDx(v)
      }
    }
  }

  const onTouchEnd = (e: ITouchEvent) => {
    const g = gRef.current
    if (g.lock === 'h') {
      // 微信端 touchend 自带 velocityX（px/s）优先采用；否则用最后采样速度。
      // 改动说明：与 RN 版同步改为"决定性速度门控"——仅 |vx|>FLING_V 时速度覆盖判定，
      //   停手后松手的右向漂移噪声（曾致"滑出又缩回"）不再影响落点；采样过期（>80ms 无 move）按停手处理
      const vt = (e.changedTouches?.[0] as { velocityX?: number } | undefined)?.velocityX
      let vx: number
      if (typeof vt === 'number' && !Number.isNaN(vt)) vx = vt / 1000
      else vx = Date.now() - g.lt > STALE_MS ? 0 : g.vx
      const target = vx < -FLING_V ? -total : vx > FLING_V ? 0 : dxRef.current < -total / 2 ? -total : 0
      snap(target)
    }
    g.lock = ''
  }

  const onAction = (a: SwipeCellAction) => {
    snap(0)
    a.onPress()
  }

  return (
    <View className='swipe-cell' style={{ borderRadius: radius, ...containerStyle }}>
      {/* 操作条垫底，内容层盖在其上，左滑露出 */}
      <View className='swipe-cell-actions'>
        {actions.map((a) => (
          <View
            key={a.key}
            className='swipe-cell-action'
            style={{ width: actionWidth, backgroundColor: a.bg }}
            onClick={() => onAction(a)}
          >
            <Text style={{ ...fs(13), color: a.color }}>{a.label}</Text>
          </View>
        ))}
      </View>
      <View
        className='swipe-cell-content'
        style={{ transform: `translate3d(${dx}px, 0, 0)`, transition: anim ? 'transform 220ms ease' : 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </View>
      {/* 展开态遮罩：盖住内容区（不含右侧露出的操作条），首次点击=收起，不透传卡片点击 */}
      {isOpened && (
        <View
          className='swipe-cell-mask'
          style={{ right: total }}
          onClick={() => snap(0)}
        />
      )}
    </View>
  )
}
