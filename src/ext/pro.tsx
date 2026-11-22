// 扩展点（src/ext/pro）：首页快捷入口、搜索框扩展图标、智能模式与品牌展示的可替换实现。
// 默认实现不渲染快捷入口与扩展图标，品牌名为 OpenFindBearings；需要定制时替换本文件实现即可，
// 仓库其余代码零改动（消费方只 import 本路径）。新增导出需保持签名一致，否则消费方 import 失败。
import { View, Text } from '@tarojs/components'
import Icon from '../components/Icon'
import Taro from '@tarojs/taro'

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

/** 首页快捷宫格项：默认实现渲染为空 */
export const ProQuickActions: React.FC<ProHomeProps> = () => null

/** 搜索框内右侧扩展图标：默认实现渲染为空 */
export const ProSearchExtras: React.FC<ProHomeProps> = () => null

/** 智能模式页面内容：默认实现渲染"暂未上线"提示（存量 homeMode=smart 数据的安全兜底） */
export const ProSmartHome: React.FC<ProHomeProps> = ({ t }: ProHomeProps) => (
  <View style={{ flex: 1, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
    <Icon name="sparkles" size={40} color={t?.textTertiary || '#94A3B8'} />
    <Text style={{ fontSize: 15, color: t?.textSecondary || '#64748B', marginTop: 12 }}>智能模式暂未上线</Text>
  </View>
)

/** 设置页"首页模式"的扩展选项：默认实现为空数组（不出现「智能」） */
export const PRO_HOME_MODES: Array<{ key: string; label: string }> = []

/** 商品卡操作位 props（v2.14.0 商城导购）：主题色板 + 字号缩放 + 点击回调。
 *  fs 用宽松签名以兼容各端 useFs 返回类型（取 fontSize 使用）；替换实现须保持签名一致。 */
export interface ProProductActionProps {
  t: {
    primary?: string
    textOnPrimary?: string
  }
  fs?: (size: number, bold?: boolean) => any
  onPress: () => void
}

/** 商品卡操作位（v2.14.0 商城导购）：默认渲染"联系商家"。
 *  改动说明（v1.8.5）：点击语义由"进货源详情"改为"直接发起一对一邀请"（预填该商家跳发布页），
 *   由扩展点覆盖（可在 ext/pro 内替换动作）；共享商品卡只 import 本导出，签名须对齐。 */
export const ProProductAction: React.FC<ProProductActionProps> = ({ t, fs, onPress }: ProProductActionProps) => (
  <View
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: t?.primary || '#2563EB', borderRadius: 14, paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5 }}
    onClick={onPress}
  >
    <Text style={{ ...(fs ? fs(12, true) : { fontSize: 12, fontWeight: 600 }), color: t?.textOnPrimary || '#FFFFFF' }}>联系商家</Text>
  </View>
)

/** 默认 App 显示名（扩展点可覆盖为品牌名） */
export const PRO_APP_DISPLAY_NAME = 'OpenFindBearings'

/** 默认运营主体名（协议/隐私说明用） */
export const PRO_OPERATOR_NAME = 'OpenFindBearings 运营团队'


/** 隐私政策"第三方共享清单"中后端服务的呈现名（扩展点可覆盖为品牌口径） */
export const PRO_SERVICE_NAMES = {
  identity: 'OpenFindBearings Identity',
  backend: 'OpenFindBearings API / BFF',
}
