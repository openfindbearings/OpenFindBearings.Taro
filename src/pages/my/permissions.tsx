// 权限管理页（v1.7.18）：列出本 App 用到的系统权限与用途说明（合规展示），
// 提供"去系统设置"入口——小程序/H5/RN 三端对打开系统设置的支持不一，
// 统一 try openAppAuthorizeSetting，失败降级为提示文案（RN/H5 无该 API）
// 改动说明：本页字号走固定值（信息型页面不随字号设置缩放，保持版式稳定），
// 故不引入 useFs
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'

// 编译期配置：禁用外层 ScrollView，滚动由页内 ScrollView 统一提供
definePageConfig({ disableScroll: true })

/** 权限条目：名称 + 使用场景说明（与实际用到的能力一致，不虚标） */
const PERMISSIONS = [
  { icon: 'camera', name: '相机', desc: '用于拍摄并上传轴承照片、营业执照等证照材料' },
  { icon: 'image', name: '照片与媒体', desc: '用于从相册选择证照材料、商品图片与 Excel 导入文件' },
]

export default function PermissionsPage() {
  const t = useTheme()

  // 打开系统授权设置：小程序原生支持；H5/RN 无此 API → 降级提示（浏览器/系统设置手动管理）
  const openSystemSettings = () => {
    const api = (Taro as any).openAppAuthorizeSetting
    if (typeof api === 'function') {
      api({ success: () => {}, fail: () => Taro.showToast({ title: '请前往系统设置管理权限', icon: 'none' }) })
    } else {
      Taro.showToast({ title: '请在系统设置或浏览器设置中管理权限', icon: 'none' })
    }
  }

  return (
    <PageLayout nav={<NavBar title='权限管理' showBack onBack={() => Taro.navigateBack()} />}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: t.textTertiary, marginTop: 12, marginBottom: 4, paddingLeft: 16, paddingRight: 16 }}>
          以下权限仅在您使用对应功能时才会请求，可随时在系统中关闭。
        </Text>
        <View style={{ margin: 12, backgroundColor: t.bgCard, borderRadius: 12, padding: 4 }}>
          {PERMISSIONS.map((p, i) => (
            <View
              key={p.name}
              style={{
                flexDirection: 'row', alignItems: 'center', padding: 14,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.border,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={p.icon} size={18} color={t.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 14, color: t.textPrimary }}>{p.name}</Text>
                <Text style={{ fontSize: 11, color: t.textTertiary, marginTop: 2 }}>{p.desc}</Text>
              </View>
            </View>
          ))}
        </View>
        {/* 去系统设置按钮 */}
        <View
          style={{ margin: 12, height: 44, borderRadius: 22, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}
          onClick={openSystemSettings}
        >
          <Text style={{ fontSize: 15, color: '#FFFFFF', fontWeight: '600' }}>去系统设置</Text>
        </View>
      </ScrollView>
    </PageLayout>
  )
}
