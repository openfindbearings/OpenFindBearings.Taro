// 轴承连连看（v2.10.1 游戏中心）：图片瓷片配对消除，≤2 折路径（可绕外圈），限时 120 秒。
// 改动说明（v2.10.2 真机反馈三条）：
//   1) 瓷片纯图片去文字——3D 渲染图自带辨识度，文字行挤占小图空间；
//   2) 题库只选有 3D 图的轴承（服务端已过滤），棋盘按实际题数动态排行数（6 列定宽）；
//   3) 死局重排修复——原整盘重建会复活已消除对，改为只重排剩余块放回原位。
// 架构对齐方案 A：本文件只是"玩家客户端"，出题/发分走通用端点 /mobile/games/linkup/*。
// RN 约束：仅 flex + absolute 弹层、Text 包裹、数值 lineHeight、图片固定尺寸。
import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import Icon from '../../components/Icon'
import MediaImage from '../../components/MediaImage'
import { usableImage } from '../../services/config'
import { getGameBoard, reportGameResult, type LinkupTile } from '../../services/games'
import { vibrateSuccess } from '../../utils/haptics'

definePageConfig({ disableScroll: true })

const COLS = 6
const PAIRS = 18
const TOTAL_TIME = 120

/** 网格坐标（含外圈 padding 的 (rows+2)x(COLS+2) 坐标系） */
interface Pt { r: number; c: number }

/** 洗牌（Fisher-Yates，原地） */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
  }
  return arr
}

/** cells（内格值，-1=已消）转带外圈网格（外圈全空供绕边路径） */
function toGrid(cells: number[], rows: number): number[][] {
  const g: number[][] = []
  for (let r = 0; r < rows + 2; r++) {
    const row: number[] = []
    for (let c = 0; c < COLS + 2; c++) {
      row.push(r === 0 || r === rows + 1 || c === 0 || c === COLS + 1 ? -1 : cells[(r - 1) * COLS + (c - 1)])
    }
    g.push(row)
  }
  return g
}

/** p、q 同行/同列且之间全空（不含端点自身） */
function clearLine(g: number[][], p: Pt, q: Pt): boolean {
  if (p.r === q.r) {
    const [a, b] = p.c < q.c ? [p.c, q.c] : [q.c, p.c]
    for (let c = a + 1; c < b; c++) if (g[p.r][c] !== -1) return false
    return true
  }
  if (p.c === q.c) {
    const [a, b] = p.r < q.r ? [p.r, q.r] : [q.r, p.r]
    for (let r = a + 1; r < b; r++) if (g[r][p.c] !== -1) return false
    return true
  }
  return false
}

/** 两点（网格坐标）≤2 折连通判定：经典 0 折/1 折/2 折三段式（外圈可绕行） */
function canConnect(g: number[][], a: Pt, b: Pt): boolean {
  if (clearLine(g, a, b)) return true
  const c1: Pt = { r: a.r, c: b.c }
  const c2: Pt = { r: b.r, c: a.c }
  if (g[c1.r][c1.c] === -1 && clearLine(g, a, c1) && clearLine(g, c1, b)) return true
  if (g[c2.r][c2.c] === -1 && clearLine(g, a, c2) && clearLine(g, c2, b)) return true
  for (let r = 0; r < g.length; r++) {
    for (let c = 0; c < g[0].length; c++) {
      if (g[r][c] !== -1) continue
      const m: Pt = { r, c }
      if ((m.r === a.r || m.c === a.c) && clearLine(g, a, m)) {
        const k1: Pt = { r: m.r, c: b.c }
        const k2: Pt = { r: b.r, c: m.c }
        if (clearLine(g, m, b)) return true
        if (g[k1.r][k1.c] === -1 && clearLine(g, m, k1) && clearLine(g, k1, b)) return true
        if (g[k2.r][k2.c] === -1 && clearLine(g, m, k2) && clearLine(g, k2, b)) return true
      }
    }
  }
  return false
}

/** 内格索引转网格坐标 */
const toPt = (i: number): Pt => ({ r: Math.floor(i / COLS) + 1, c: (i % COLS) + 1 })

/** 扫描盘面是否存在可消除对（内格索引对，供死局检测与提示共用） */
function findMatchable(cells: number[], rows: number): [number, number] | null {
  const g = toGrid(cells, rows)
  const byValue = new Map<number, number[]>()
  cells.forEach((v, i) => {
    if (v < 0) return
    const arr = byValue.get(v) || []
    arr.push(i)
    byValue.set(v, arr)
  })
  for (const idxs of byValue.values()) {
    for (let i = 0; i < idxs.length; i++) {
      for (let j = i + 1; j < idxs.length; j++) {
        if (canConnect(g, toPt(idxs[i]), toPt(idxs[j]))) return [idxs[i], idxs[j]]
      }
    }
  }
  return null
}

/** 铺新局：n 对铺 rows 行 6 列（尾行不足留空位），死局重洗保证开局有解 */
function buildCells(pairCount: number): { cells: number[]; rows: number } {
  const rows = Math.ceil((pairCount * 2) / COLS)
  const total = rows * COLS
  for (let attempt = 0; attempt < 12; attempt++) {
    const vals = shuffle(Array.from({ length: pairCount }, (_, i) => i).flatMap((i) => [i, i]))
    const cells = [...vals, ...Array(total - vals.length).fill(-1)]
    if (findMatchable(cells, rows)) return { cells, rows }
  }
  const vals = shuffle(Array.from({ length: pairCount }, (_, i) => i).flatMap((i) => [i, i]))
  return { cells: [...vals, ...Array(total - vals.length).fill(-1)], rows }
}

/** 死局重排（v2.10.2 修复）：只把"剩余未消块"洗牌放回原位——原整盘重建会复活已消除对 */
function reshuffleRemaining(cells: number[], rows: number): number[] {
  const idxs = cells.map((v, i) => (v >= 0 ? i : -1)).filter((i) => i >= 0)
  const vals = idxs.map((i) => cells[i])
  for (let attempt = 0; attempt < 12; attempt++) {
    shuffle(vals)
    const next = cells.slice()
    idxs.forEach((ci, k) => { next[ci] = vals[k] })
    if (findMatchable(next, rows)) return next
  }
  return cells
}

/** 每局幂等 ID（客户端生成，服务端按它防重复发分） */
function newGameId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

/** 轴承连连看页 */
export default function LinkupPage() {
  const t = useTheme()
  const fs = useFs()

  const [tiles, setTiles] = useState<LinkupTile[]>([])
  const [cells, setCells] = useState<number[]>([])
  const [rows, setRows] = useState(6)
  const [selected, setSelected] = useState<number | null>(null)
  const [hint, setHint] = useState<[number, number] | null>(null)
  const [status, setStatus] = useState<'loading' | 'playing' | 'won' | 'lost'>('loading')
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME)
  const [granted, setGranted] = useState(-1)
  const [preloadedCount, setPreloadedCount] = useState(0)
  const [preloadDone, setPreloadDone] = useState(false)
  const gameIdRef = useRef('')
  const settlingRef = useRef(false)

  const remainPairs = cells.filter((v) => v >= 0).length / 2

  // 响应式棋盘（v2.10.2 用户要求：行列固定、大屏放大、小屏缩放）：
  // 用系统屏宽实时算瓷片尺寸（纯数值，三端一致，无需百分比/aspectRatio 等 CSS hack）
  const sysInfo = Taro.getSystemInfoSync()
  const winW = sysInfo.windowWidth || 375
  const boardW = Math.min(winW, 560) - 29
  const tileSize = Math.max(32, Math.floor((boardW - 10 - COLS * 4) / COLS))
  const imgSize = Math.floor(tileSize * 0.62)
  const txtSize = Math.max(8, Math.round(tileSize * 0.18))

  /** 开新局：拉题→铺盘→预加载图片→就绪后进场 */
  const startGame = useCallback(async () => {
    setStatus('loading')
    const board = await getGameBoard('linkup', PAIRS)
    if (board.length < 2) {
      Taro.showToast({ title: '图片样本不足，待补充后开放', icon: 'none' })
      return
    }
    const built = buildCells(board.length)
    gameIdRef.current = newGameId()
    settlingRef.current = false
    setPreloadedCount(0)
    setPreloadDone(false)
    setTiles(board)
    setCells(built.cells)
    setRows(built.rows)
    setSelected(null)
    setHint(null)
    setGranted(-1)
    setTimeLeft(TOTAL_TIME)
  }, [])

  useEffect(() => { void startGame() }, [startGame])

  // 图片预加载（跨端安全：屏幕外 1px 隐藏 Image 强制拉图进原生/浏览器缓存）
  // 全部 onLoad/onError 或 3 秒超时兜底后，标记就绪才真正开始读秒——
  // 修复"已进场在读秒、瓷片还在陆续加载"的体验问题
  useEffect(() => {
    if (status !== 'loading' || tiles.length === 0 || preloadDone) return
    if (preloadedCount >= tiles.length) { setPreloadDone(true); return }
    const timer = setTimeout(() => setPreloadDone(true), 3000)
    return () => clearTimeout(timer)
  }, [status, tiles.length, preloadedCount, preloadDone])

  // 就绪闸门：预加载完成后进入 playing 开始读秒
  useEffect(() => {
    if (status === 'loading' && preloadDone && tiles.length > 0) setStatus('playing')
  }, [status, preloadDone, tiles.length])

  // 倒计时：归零判负（已结束不再走表）
  useEffect(() => {
    if (status !== 'playing') return
    const timer = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) { setStatus('lost'); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [status])

  /** 胜利结算：上报 gameId 幂等发分 */
  useEffect(() => {
    if (status !== 'won' || settlingRef.current) return
    settlingRef.current = true
    void reportGameResult('linkup', { gameId: gameIdRef.current })
      .then((g) => setGranted(g))
      .catch(() => setGranted(0))
  }, [status])

  /** 点格：选中/配对消除/改选；消除后死局只重排剩余块 */
  const tap = (idx: number) => {
    if (status !== 'playing' || cells[idx] < 0) return
    if (selected === null) { setSelected(idx); return }
    if (selected === idx) { setSelected(null); return }
    const a = selected; const b = idx
    if (cells[a] === cells[b]) {
      const g = toGrid(cells, rows)
      if (canConnect(g, toPt(a), toPt(b))) {
        const next = cells.slice()
        next[a] = -1; next[b] = -1
        void vibrateSuccess()
        setSelected(null); setHint(null)
        if (next.every((v) => v < 0)) { setCells(next); setStatus('won'); return }
        if (!findMatchable(next, rows)) {
          Taro.showToast({ title: '无解啦，重新排列', icon: 'none' })
          setCells(reshuffleRemaining(next, rows))
        } else {
          setCells(next)
        }
        return
      }
    }
    setSelected(b)
  }

  /** 提示：高亮一组可消除对 3 秒 */
  const doHint = () => {
    if (status !== 'playing') return
    const m = findMatchable(cells, rows)
    if (!m) { Taro.showToast({ title: '当前无可消除对', icon: 'none' }); return }
    setHint(m)
    setTimeout(() => setHint(null), 3000)
  }

  const pct = Math.max(0, Math.round((timeLeft / TOTAL_TIME) * 100))
  const barColor = pct > 30 ? t.primary : '#EF4444'

  return (
    <PageLayout nav={<NavBar title='轴承连连看' showBack />}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, display: 'flex', alignItems: 'center', display: 'flex', justifyContent: status === 'loading' ? 'center' : 'flex-start' }}>
          {status === 'loading' && (
            <>
              <Text style={{ ...fs(14), color: t.textTertiary }}>
                正在预加载图片{tiles.length > 0 ? `（${Math.min(preloadedCount, tiles.length)}/${tiles.length}）` : '…'}
              </Text>
              {/* 屏幕外 1px 隐藏 Image 强制拉图进缓存（H5/小程序/RN 均有效） */}
              {tiles.length > 0 && (
                <View style={{ position: 'absolute', left: -9999, top: 0, width: 1, height: 1, overflow: 'hidden' }}>
                  {tiles.map((tl, ti) => {
                    const src = usableImage(tl.imageUrl)
                    return src ? (
                      <Image
                        key={`pre-${ti}`}
                        src={src}
                        style={{ width: 1, height: 1 }}
                        onLoad={() => setPreloadedCount((c) => c + 1)}
                        onError={() => setPreloadedCount((c) => c + 1)}
                      />
                    ) : (
                      // 无有效图也计入就绪，避免卡住闸门
                      <Text key={`pre-${ti}`} style={{ width: 1, height: 1 }} onLayout={() => setPreloadedCount((c) => c + 1)}>{ti}</Text>
                    )
                  })}
                </View>
              )}
            </>
          )}

          {status !== 'loading' && (
            <>
              {/* 状态条：剩余对数 + 倒计时进度 + 提示按钮 */}
              <View style={{ width: boardW, marginTop: 12, backgroundColor: t.bgCard, borderRadius: 14, padding: 12 }}>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ ...fs(13), color: t.textSecondary, flex: 1 }}>剩余 <Text style={{ color: t.primary, fontWeight: '700' }}>{remainPairs}</Text> 对</Text>
                  <Text style={{ ...fs(13), color: pct > 30 ? t.textSecondary : '#EF4444', fontWeight: '600' }}>{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</Text>
                  <View style={{ marginLeft: 12, backgroundColor: t.primaryLight, borderRadius: 12, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4 }} onClick={doHint}>
                    <Text style={{ ...fs(12), color: t.primary, fontWeight: '600' }}>提示</Text>
                  </View>
                </View>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: t.bgInput, marginTop: 8 }}>
                  <View style={{ height: 5, borderRadius: 3, width: `${pct}%`, backgroundColor: barColor }} />
                </View>
              </View>

              {/* 棋盘：6 列固定、瓷片尺寸随屏宽缩放（大屏放大/小屏缩小），选中金环/提示橙环 */}
              <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', width: boardW, marginTop: 14, paddingLeft: 5, paddingRight: 5 }}>
                {cells.map((v, i) => {
                  const tile = v >= 0 ? tiles[v] : null
                  const isSel = selected === i
                  const isHint = !!hint && (hint[0] === i || hint[1] === i)
                  return (
                    <View
                      key={i}
                      style={{
                        width: tileSize,
                        height: tileSize,
                        margin: 2,
                        borderRadius: 10,
                        display: 'flex', alignItems: 'center',
                        display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        backgroundColor: v < 0 ? 'transparent' : t.bgCard,
                        borderWidth: isSel ? 2 : 1,
                        borderStyle: 'solid',
                        borderColor: isSel ? t.primary : isHint ? '#F59E0B' : t.borderColor || t.bgInput
                      }}
                      onClick={() => tap(i)}
                    >
                      {/* 改动说明（v2.10.2 用户定案收回"纯图片"）：保留型号小字——
                          "玩着玩着就认识型号"是教育卖点，图+字瓷片辨识度也更高 */}
                      {/* 改动说明（v2.10.2）：瓷片走 MediaImage 统一管线（onError 降级占位图标），
                          与详情页同链——URL 意外裂图也不出现空白瓷片；型号小字保留（教育卖点） */}
                      {v >= 0 && tile && (
                        <>
                          <MediaImage
                            url={tile.imageUrl}
                            style={{ width: imgSize, height: imgSize }}
                            mode='aspectFit'
                            fallbackIcon='package'
                            fallbackColor={t.primary}
                            fallbackSize={Math.max(14, Math.floor(imgSize * 0.55))}
                          />
                          <Text style={{ ...fs(txtSize), color: t.textTertiary, marginTop: 1 }} numberOfLines={1}>{tile.partNumber}</Text>
                        </>
                      )}
                    </View>
                  )
                })}
              </View>

              <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 10 }}>
                点两张相同轴承（路径不超过两个拐弯）即可消除
              </Text>
            </>
          )}
        </View>

        {/* 胜利/失败弹层（absolute 遮罩，RN 兼容） */}
        {(status === 'won' || status === 'lost') && (
          <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <View style={{ width: 280, backgroundColor: t.bgCard, borderRadius: 20, padding: 24, display: 'flex', alignItems: 'center' }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: status === 'won' ? t.primaryLight : t.bgInput, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Icon name={status === 'won' ? 'trophy' : 'timer'} size={32} color={status === 'won' ? '#F59E0B' : t.textTertiary} />
              </View>
              <Text style={{ ...fs(20), color: t.textPrimary, fontWeight: '700', marginTop: 12 }}>
                {status === 'won' ? '全部消除！' : '时间到'}
              </Text>
              <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6 }}>
                {status === 'won'
                  ? (granted < 0 ? '正在结算奖励…' : granted > 0 ? `轴承币 +${granted}` : '今日游戏轴承币已达上限')
                  : '差一点，再来一局'}
              </Text>
              <View
                style={{ alignSelf: 'stretch', backgroundColor: t.primary, borderRadius: 22, paddingTop: 12, paddingBottom: 12, display: 'flex', alignItems: 'center', marginTop: 18 }}
                onClick={() => void startGame()}
              >
                <Text style={{ ...fs(15), color: '#FFFFFF', fontWeight: '600' }}>再来一局</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </PageLayout>
  )
}
