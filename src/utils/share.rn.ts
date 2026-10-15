// 分享工具（v1.6.0 搜索寻货联动）：RN 实现——走 react-native 原生 Share 面板。
// Metro 按 .rn. 后缀解析本文件替代 share.ts；ShareContent 类型从 share.ts 复用（type 引入，编译期擦除）。
import { Share } from 'react-native'
import type { ShareContent } from './share'

export type { ShareContent }

/** RN 命令式分享：原生 Share（微信/QQ/抖音等由系统分享面板承载） */
export async function shareContent(content: ShareContent): Promise<void> {
  await Share.share({ message: `${content.title} ${content.path}`, url: content.path })
}