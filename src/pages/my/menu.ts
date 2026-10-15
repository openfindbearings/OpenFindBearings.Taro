// 我的功能菜单唯一配置（v2.13.2 收敛）：我的页四宫格与"全部功能"页此前各维护一份
// icon/色/路由，已出现分叉（我的纠错 file_text vs edit、我的寻货 search/sky vs compass/blue）。
// 此处集中为单一数据源，两页按需取子集（四宫格）或全量（全部功能），路由统一。
/** 菜单项：key 为功能键，desc 供全部功能页展示 */
export interface MyMenuItem {
  key: string
  label: string
  icon: string
  color: string
  desc?: string
}

/** 全部功能条目（含 desc，顺序=全部功能页展示顺序） */
export const MY_MENU_ITEMS: MyMenuItem[] = [
  { key: 'favorites', label: '收藏轴承', icon: 'heart', color: '#EF4444', desc: '我收藏的轴承型号' },
  { key: 'followed', label: '关注商家', icon: 'users', color: '#0EA5E9', desc: '我关注的商家' },
  { key: 'history', label: '浏览历史', icon: 'clock', color: '#10B981', desc: '最近浏览记录' },
  { key: 'corrections', label: '我的纠错', icon: 'edit', color: '#EF4444', desc: '提交记录与审核结果' },
  { key: 'tasks', label: '任务中心', icon: 'gift', color: '#F59E0B', desc: '签到与赚轴承币任务' },
  { key: 'games', label: '游戏中心', icon: 'puzzle', color: '#0EA5E9', desc: '轴承连连看，玩一局赚币' },
  { key: 'achievements', label: '我的勋章', icon: 'award', color: '#A855F7', desc: '点亮勋章与称号' },
  { key: 'points', label: '收支明细', icon: 'list', color: '#14B8A6', desc: '轴承币收支流水' },
  { key: 'sourcing', label: '我的寻货', icon: 'compass', color: '#3B82F6', desc: '我发布的寻货需求' },
  { key: 'messages', label: '消息中心', icon: 'bell', color: '#F97316', desc: '系统通知与消息' },
  { key: 'settings', label: '设置', icon: 'settings', color: '#64748B', desc: '通用设置与隐私' },
]

/** 我的页四宫格显示顺序（末位"全部功能"由 MY_GRID_ALL_FEATURES 补上） */
export const MY_GRID_KEYS = ['favorites', 'followed', 'history', 'corrections', 'sourcing', 'tasks', 'games']

/** 四宫格末位"全部功能"兜底项（非真实页面，点击进全部功能页） */
export const MY_GRID_ALL_FEATURES: MyMenuItem = { key: 'all_features', label: '全部功能', icon: 'layout_grid', color: '#6366F1' }

/** 功能键 → 页面路径（唯一路由表，"全部功能"由调用方单独处理） */
export const MY_MENU_ROUTES: Record<string, string> = {
  favorites: '/pages/my/favorites',
  followed: '/pages/my/followed',
  history: '/pages/my/history',
  corrections: '/pages/my/corrections',
  tasks: '/pages/my/tasks',
  sourcing: '/pages/my/sourcing',
  games: '/pages/games/index',
  achievements: '/pages/my/achievements',
  points: '/pages/my/points',
  messages: '/pages/notifications/index',
  settings: '/pages/my/settings',
}

/** 取四宫格项（按 MY_GRID_KEYS 顺序，附"全部功能"兜底） */
export function getGridMenuItems(): MyMenuItem[] {
  const items = MY_GRID_KEYS
    .map((k) => MY_MENU_ITEMS.find((i) => i.key === k))
    .filter((i): i is MyMenuItem => !!i)
  return [...items, MY_GRID_ALL_FEATURES]
}