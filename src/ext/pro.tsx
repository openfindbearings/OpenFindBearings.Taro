// 扩展点（src/ext/pro）：开源版占位实现——首页快捷三钮/搜索图标/智能模式/品牌名等高级功能的入口。
// 开源版三钮与智能选项不渲染、品牌名为 OpenFindBearings；fork 用户要加私有功能时替换本文件实现即可，
// 仓库其余代码零改动（消费方只 import 本路径）。新增导出需保持签名一致，否则消费方 import 失败。
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

/** 开源版 App 显示名（扩展点可覆盖为品牌名） */
export const PRO_APP_DISPLAY_NAME = 'OpenFindBearings'

/** 开源版运营主体名（协议/隐私说明用） */
export const PRO_OPERATOR_NAME = 'OpenFindBearings 运营团队'


/** 隐私政策"第三方共享清单"中后端服务的呈现名（扩展点可覆盖为品牌口径） */
export const PRO_SERVICE_NAMES = {
  identity: 'OpenFindBearings Identity',
  backend: 'OpenFindBearings API / BFF',
}
