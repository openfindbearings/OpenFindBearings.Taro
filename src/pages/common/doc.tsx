// 通用法律/帮助文档页：按路由 params.type 取 src/content/legal.ts 中的标准文本渲染。
// 承载隐私政策、个人信息收集清单、第三方共享清单、隐私管理、用户协议等合规文本。
// 纯展示页，PageLayout + 自定义 NavBar，内容区可滚动。
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useFs } from '../../hooks/useFontScale'
import { useTheme } from '../../hooks/useTheme'
import PageLayout from '../../components/PageLayout'
import NavBar from '../../components/NavBar'
import { getLegalDoc } from '../../content/legal'
import './doc.scss'

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function DocPage() {
  const router = useRouter()
  const type = router.params.type || 'privacy-policy'
  const doc = getLegalDoc(type)
  // 全局字号缩放 + 主题色板
  const fs = useFs()
  const t = useTheme()

  // 兜底：未知类型返回上一页
  if (!doc) {
    return (
      <PageLayout nav={<NavBar title='文档' showBack onBack={() => Taro.navigateBack()} />}>
        <View className='doc-empty'>
          <Text className='doc-empty-text' style={{ ...fs(15), color: t.textTertiary }}>未找到该文档内容</Text>
        </View>
      </PageLayout>
    )
  }

  return (
    <PageLayout nav={<NavBar title={doc.title} showBack />}>
      <View className='doc'>
        <Text className='doc-updated' style={{ ...fs(13), color: t.textTertiary }}>更新日期：{doc.updatedAt}</Text>
        {doc.intro ? <Text className='doc-intro' style={{ ...fs(14), color: t.textSecondary }}>{doc.intro}</Text> : null}

        {doc.sections.map((sec, i) => (
          <View key={i} className='doc-section'>
            {sec.heading ? <Text className='doc-heading' style={{ ...fs(15), color: t.textPrimary }}>{sec.heading}</Text> : null}
            {sec.paragraphs.map((p, j) => (
              <Text key={j} className='doc-para' style={{ ...fs(14), color: t.textSecondary }}>{p}</Text>
            ))}
          </View>
        ))}

        <Text className='doc-footer' style={{ ...fs(13), color: t.textTertiary }}>© OpenFindBearings</Text>
      </View>
    </PageLayout>
  )
}
