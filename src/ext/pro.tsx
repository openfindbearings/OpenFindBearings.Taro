// 开源版 pro 扩展占位（@ofb/taro-pro）
// 说明：开源构建时 webpack resolve.alias 把 @ofb/taro-pro 指到此文件——占位实现
//       返回空/空数组，因此开源版不显示首页快捷三钮、不提供智能模式选项；
//       自用构建（TARO_BUILD_PRO=1 + 真包）才会解析到 FindBearings.Taro.Pro 的真实实现。
//       新增 pro 能力时，此占位必须同步补同名导出（空实现），否则开源构建 import 失败。
import { View, Text } from '@tarojs/components'
import Icon from '../components/Icon'

/** pro 扩展组件统一 props（主题色板 + 字号缩放，由主仓传入） */
export interface ProHomeProps {
  t: {
    primary?: string
    textPrimary?: string
    textSecondary?: string
    textTertiary?: string
    bgCard?: string
    bgInput?: string
    border?: string
    textOnPrimary?: string
  }
  fs?: (size: number, bold?: boolean) => { fontSize: number; fontWeight?: number }
}

/** 首页快捷宫格 pro 项（语音/拍/扫）：开源版渲染为空 */
export const ProQuickActions: React.FC<ProHomeProps> = () => null

/** 搜索框内右侧图标（语音/拍照）：开源版渲染为空 */
export const ProSearchExtras: React.FC<ProHomeProps> = () => null

/** 智能模式页面内容：开源版渲染"暂未上线"提示（存量 homeMode=smart 数据的安全兜底） */
export const ProSmartHome: React.FC<ProHomeProps> = ({ t }: ProHomeProps) => (
  <View style={{ flex: 1, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
    <Icon name="sparkles" size={40} color={t?.textTertiary || '#94A3B8'} />
    <Text style={{ fontSize: 15, color: t?.textSecondary || '#64748B', marginTop: 12 }}>智能模式暂未上线</Text>
  </View>
)

/** 设置页"首页模式"的 pro 扩展选项：开源版为空数组（不出现「智能」） */
export const PRO_HOME_MODES: Array<{ key: string; label: string }> = []

/** 开源版 App 显示名（自用版由 pro 包覆盖为"轴承帮"） */
export const PRO_APP_DISPLAY_NAME = 'OpenFindBearings'

/** 开源版运营主体名（协议/隐私说明用） */
export const PRO_OPERATOR_NAME = 'OpenFindBearings 运营团队'

/** 商家商品"Excel 批量导入"（依赖闭源 Sync 数据管线）：开源版禁用，管理页不渲染导入按钮 */
export const PRO_MERCHANT_IMPORT_ENABLED = false
