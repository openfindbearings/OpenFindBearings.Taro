// 关于页（v1.7.20 重设计）：主流 App 关于页结构——品牌区（图标/名称/版本）+
// 功能卡（检查更新/用户协议/隐私政策/备案信息）+ 简介 + 版权行。
// 图标用纯 View 绘制 app-icon 造型（蓝底白环+钢珠，三端一致——RN 不支持 svg 文件与
// linear-gradient，绘制法规避两坑）；样式复用 settings.scss 的 section/list 类（v1.7.19
// 首版裸奔缺样式的修复）；自动更新开关留在设置页帮助组，本页仅手动检查
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { checkUpdateManually } from '../../services/update'
import { getSiteConfig, getBeiAnForPlatform } from '../../services/config-api'
import { getAppVersion } from '../../utils/version'
import './settings.scss'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/** 关于页 */
export default function AboutPage() {
  const t = useTheme()
  const fs = useFs()
  const [beian, setBeian] = useState('')

  useDidShow(() => {
    // 改动说明（v1.7.24 备案拆分）：App/小程序/网站备案独立出号，按运行平台取对应键
    getSiteConfig().then((c) => setBeian(getBeiAnForPlatform(c))).catch(() => { /* 无备案则隐藏该行 */ })
  })

  return (
    <PageLayout nav={<NavBar title='关于' onBack={() => Taro.navigateBack()} showBack />}>
      <ScrollView style={{ flex: 1 }}>
        {/* 品牌区：直接用 app 图标位图（mipmap ic_launcher 拷入 assets，三端 Image 一致；
            改动说明：此前纯 View 手绘指针三角在 RN 渲染变形，位图方案根治且与桌面图标完全同源） */}
        <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 44, paddingBottom: 20 }}>
          <Image src={require('../../assets/icon/app-icon.png')} style={{ width: 80, height: 80, borderRadius: 40 }} />
          <Text style={{ ...fs(19), color: t.textPrimary, fontWeight: '600', marginTop: 14 }}>OpenFindBearings</Text>
          <Text style={{ ...fs(13), color: t.textTertiary, marginTop: 4 }}>版本 v{getAppVersion()}</Text>
        </View>

        {/* 功能卡：检查更新 + 备案信息（用户协议/隐私政策入口在设置页隐私组，不重复放） */}
        <View className='section'>
          <View className='list' style={{ backgroundColor: t.bgCard }}>
            <View className='list-item' style={{ borderBottomColor: t.border }} onClick={() => { void checkUpdateManually() }}>
              <View className='list-left'>
                <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                  <Icon name="refresh-cw" size={20} color={t.primary} />
                </View>
                <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>检查更新</Text>
              </View>
              <View className='list-right'>
                <Text className='list-value' style={{ ...fs(13), color: t.textTertiary }}>v{getAppVersion()}</Text>
                <Icon name="chevron_right" size={18} color={t.textTertiary} />
              </View>
            </View>
            {/* 备案信息：站点配置下发（Admin 未配置则整行隐藏）；点击复制（外链在小程序被禁） */}
            {beian ? (
              <View
                className='list-item list-item-last'
                onClick={() => { Taro.setClipboardData({ data: beian }); Taro.showToast({ title: '备案号已复制', icon: 'none' }) }}
              >
                <View className='list-left'>
                  <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                    <Icon name="badge-check" size={20} color={t.primary} />
                  </View>
                  <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>备案信息</Text>
                </View>
                <Text className='list-value' style={{ ...fs(13), color: t.textTertiary }}>{beian}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 简介 + 版权行 */}
        <Text style={{ ...fs(12), color: t.textTertiary, textAlign: 'center', marginTop: 20, lineHeight: 18 }}>
          轴承信息撮合平台 · 寻货发布、商户应答、点对点直达
        </Text>
        <Text style={{ ...fs(11), color: t.textTertiary, textAlign: 'center', marginTop: 6 }}>
          © 2026 OpenFindBearings · 保留所有权利
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </PageLayout>
  )
}
