// 页面分享设置（v1.6.0 搜索寻货联动）：跨端安全的 useShareAppMessage 包装。
// 小程序（微信/抖音）由 Taro 的 useShareAppMessage 提供原生分享菜单的标题/路径；
// H5 端由框架注入（真实或 no-op）。
// 改动说明：RN 端 @tarojs/taro 未导出该 hook（值为 undefined），页面直接调用会
//   "TypeError: undefined is not a function" 崩溃（BearingDetailPage/MerchantDetailPage）。
//   故统一经本包装调用并做存在性判定，平台不支持时静默跳过，分享入口仍由 ShareButton 承担。
import { useShareAppMessage } from '@tarojs/taro'

/** 分享内容：标题 + 落地路径（含 query），可选配图 */
export interface ShareMessageContent {
  title: string
  path: string
  imageUrl?: string
}

/**
 * 设置当前页面的分享内容；平台不支持该 hook（RN）时静默跳过，避免崩溃。
 * @param factory 返回分享内容（标题/路径/可选配图）的工厂函数
 */
export function useShareMessage(factory: () => ShareMessageContent): void {
  if (typeof useShareAppMessage === 'function') {
    useShareAppMessage(factory)
  }
}