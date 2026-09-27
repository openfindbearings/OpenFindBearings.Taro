// 游戏中心服务层（v2.10.1 方案 A 插件架构）：
// 通用端点透传 /mobile/games/{key}/board|result——加游戏不改本文件传输层，只扩注册表。
// 注册表 GAMES 是游戏中心页唯一数据源：available 可玩、comingSoon 置灰占位。
import { request } from './request'
import { API } from './config'

/** 连连看瓷片（后端随机有图轴承，imageUrl 可能为空=降级纯文字块） */
export interface LinkupTile {
  id: string
  partNumber: string
  imageUrl?: string | null
}

/** 游戏注册表项 */
export interface GameMeta {
  key: string
  name: string
  desc: string
  icon: string
  color: string
  route?: string
  status: 'available' | 'comingSoon'
}

/** 游戏注册表（数独/2048 占位，上线即改 status+route，页面零改动） */
export const GAMES: GameMeta[] = [
  { key: 'linkup', name: '轴承连连看', desc: '配对消除真轴承图，赢轴承币', icon: 'puzzle', color: '#0EA5E9', route: '/pages/games/linkup', status: 'available' },
  { key: 'sudoku', name: '数独', desc: '经典数字谜题', icon: 'grid_3x3', color: '#8B5CF6', status: 'comingSoon' },
  { key: '2048', name: '合成 2048', desc: '滑动合轴承编号', icon: 'layers', color: '#F59E0B', status: 'comingSoon' }
]

/** 出一局题板（连连看=18 对有图轴承；失败返回空数组由页面兜底） */
export async function getGameBoard(key: string, size?: number): Promise<LinkupTile[]> {
  try {
    const url = size ? `${API.GAMES}/${key}/board?size=${size}` : `${API.GAMES}/${key}/board`
    const r = await request<LinkupTile[]>(url)
    return r || []
  } catch {
    return []
  }
}

/** 结算一局：返回实发轴承币（0=今日额度满或重复提交；网络失败抛错由调用方提示） */
export async function reportGameResult(key: string, payload: Record<string, string>): Promise<number> {
  const r = await request<{ granted: number }>(`${API.GAMES}/${key}/result`, {
    method: 'POST',
    data: payload
  })
  return r?.granted ?? 0
}
