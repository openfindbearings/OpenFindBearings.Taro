// 品牌档次文案（v1.4.14）：API 下发 BrandLevel 枚举名，前端统一映射为中文短词，
// 用于品牌 Tab / 品牌资料卡等处展示，避免各页面各写一套（RN 约束：仅纯函数，无平台差异）

/** 品牌档次枚举名到中文短词的映射（对齐 API BrandLevel） */
const BRAND_LEVEL_LABELS: Record<string, string> = {
  InternationalPremium: '国际一线',
  InternationalStandard: '国际标准',
  DomesticPremium: '国产一线',
  DomesticStandard: '国产二线',
  Economy: '经济型',
}

/**
 * 取品牌档次中文短词
 * 参数：level 为 API 下发的枚举名字符串（可能为空或未知值）
 * 返回：命中的中文短词；未命中返回 null，由调用方决定是否隐藏该段文案
 */
export function getBrandLevelLabel(level?: string | null): string | null {
  if (!level) return null
  return BRAND_LEVEL_LABELS[level] ?? null
}
