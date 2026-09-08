# Taro 移动端 RN 度量重构方案

> **状态**：v1.7.0（吸收 general 审核全部 P0/P1 修正），待确认实施
> **版本**：v1.7.0
> **日期**：2026-09-07
> **目标**：按 Taro 标准 RN 模板，实现一个**漂亮、舒服、标准的 React Native 应用**（Android + iOS）
> **适用**：Taro 3.6.40 + React Native 0.70
> **范围**：本轮只做 RN（第一步），H5 / 小程序为第二、三步

---

## 〇、分期路线

| 阶段 | 内容 | 状态 |
|---|---|---|
| **第一步** | 按 Taro 标准 RN 模板实现漂亮舒服、达标主题/功能的 RN App | **本轮实施** |
| 第二步 | 扩展兼容 H5 | 后续 |
| 第三步 | 扩展兼容微信小程序等 | 后续 |

本轮专注第一步：完全按标准 RN 来，不为 H5/小程序迁就。业务代码/组件仍用 Taro 跨端写法（View/Text/ScrollView），但**验收只看 RN**。

---

## 一、设计基准：怎样才算"标准、漂亮舒服的 RN"

1. **安全区精确**：顶部让开状态栏、底部让开手势条 / Home Indicator。
2. **顶栏 / 底栏尺寸对齐平台**：顶栏 44dp（搜索态 48dp）、底 Tab 56dp、图标 24、label 12。
3. **4pt 基准网格**：间距优先取 8 的倍数（4/8/12/16/20/24/32），留白一致。
4. **排版层级清晰**：20/17/15/13/12 五档字号 + dp 行高 + 系统字体（SF Pro / Roboto）。
5. **柔和阴影 + 统一圆角**：iOS shadow + **Android elevation 双写**（Taro 不自动转 elevation），圆角 8–12。
6. **触控目标 ≥44×44 + 按压反馈**：触控由整个可点区域承担（如整个 tab-item），按下透明度反馈。
7. **色彩克制且对比度达标**：1 主色 + 中性灰阶 + 语义色；**文字级颜色满足 WCAG AA**（见 3.4）。

---

## 二、缩放机制（源码实证 + 审核修正）

### 2.1 完整链路（两级变换，v1.6.0 曾漏掉第一级）

```
SCSS → sass → postcss-pxtransform(platform:'rn') → taro-css-to-react-native(scalable) → StyleSheet
```

**第一级 pxtransform（减半）**：rn 平台 `rootValue = (1 / deviceRatio[designWidth]) × 2`。默认 `deviceRatio[750]=1` → rootValue=2 → **所有小写 px 先 ÷2**（与 scalable 无关）。bundle 实证：SCSS `64px` → `scalePx2dp(32)`。

**第二级 css-to-react-native（缩放或定值）**：`transformRawValue` 中
- 小写 `Npx` → `scalePx2dp(N)` → 运行时 `N × windowWidth/375`（平板 750）；
- 大写 `NPX`（`scalable:false` 产生）→ 纯数值 `N`，不缩放。

**叠加效果（默认配置）**：`44px → 22 → scalePx2dp(22) ≈ 23dp`（偏小一半的真相）。
**只加 scalable:false（v1.6.0 的错误方案）**：`44px → 22 → 纯数值 22dp`——**仍差一半**。

### 2.2 正确解法（审核仿真验证）

`rn.postcss.pxtransform.config.deviceRatio: { 750: 2 }` → rootValue = (1/2)×2 = **1** → px 原样通过 → 再经 `scalable:false` 转 `PX` → **纯数值 = SCSS 写入值**。仿真输出 `{ height: 44, fontSize: 15, borderBottomWidth: 1 }`。

该配置只注入 RN 链（`rn.postcss.pxtransform` 经 recursiveMerge 覆盖顶层注入值），**H5 顶层 designWidth/deviceRatio 不受影响**。

### 2.3 Icon size 不缩放

`Icon` 的 `size` 是 JS 数字，不经样式链，直接 dp。与 SCSS（修正后）同单位 → 图标不再压文字。

### 2.4 实施时强制复核（批次 A 验收项）

改配置后重新 `build:rn`，grep bundle 确认：尺寸/字号为**纯数值且等于 SCSS 写入值**（不再出现 `scalePx2dp(`）。v1.6.0 的"已实测"结论作废（当时正则漏匹配 scalePx2dp 形式、且 bundle 为旧产物）。

---

## 三、核心解法与度量标准

### 3.1 配置（config/index.ts 的 rn 段）

```ts
rn: {
  postcss: {
    scalable: false,                 // 第二级：px→PX→纯数值，不缩放
    pxtransform: {
      enable: true,
      config: { deviceRatio: { 750: 2 } }   // 第一级：rootValue=1，px 不减半
    },
    cssModules: { enable: false }
  }
}
```

### 3.2 度量规则

| 写法 | RN 结果 |
|---|---|
| SCSS `height: 44px` | **44dp（固定）** |
| SCSS `font-size: 15px` | **15dp** |
| SCSS `line-height: 21px` | **21dp** |
| `Icon size={24}` | **24dp** |
| inline `{paddingTop: 44}` | **44dp** |

### 3.3 度量标准值（SCSS px = dp）

**布局**

| 元素 | dp |
|---|---|
| NavBar 高（普通 / 搜索态） | 44 / 48 |
| NavBar 左右栏宽 | 96（容纳我的页双 44dp 触控目标，标题仍居中） |
| NavBar 水平 padding | 16 |
| 导航图标触控区（Icon size 24） | 44 |
| TabBar 高 | 56 |
| tab 图标 | 24（触控由整个 tab-item 承担，≥44） |
| tab 文字 | 12 |
| 商家大圆 / 内 logo / 无logo时Icon / 上移 | 56 / 48 / 28 / 14 |
| 快捷入口圆（Icon size 28） | 56 |
| 搜索框高 | 36 |
| 卡片 padding | 16 |
| 圆角 小/中/大/特大 | 6/8/12/16 |
| 间距 | 4/8/12/16/20/24/32 |

**字号 + dp 行高（RN 禁无单位 lineHeight）**

| 用途 | 字号 | 行高 |
|---|---|---|
| 大标题 | 20 | 28 |
| 标题 | 17 | 24 |
| 正文 | 15 | 21 |
| 次正文（旧 14 归入） | 14 | 20 |
| 辅助 | 13 | 18 |
| 标签 / tab | 12 | 16 |

**旧字号映射**：11→12、13→13、14→14、15→15、17→17、20→20；其余就近归档，禁止重写时自由发挥。

### 3.4 主题（清新 / 现代 / 简洁 / 明快；对比度达 AA）

| 用途 | 色值 | 对比度说明 |
|---|---|---|
| 主色（图标/大色块/装饰） | `#0EA5E9` | 不做文字色 |
| **文字级主色**（tab 选中/链接/强调文字） | `#0284C7` | 对白 4.09:1，大字过 AA |
| 主色深档（会员卡底/按压态） | `#0369A1` | 对白 5.93:1，AA 全过 |
| 页面底 | `#F5F7FA` | 全项目统一此值（弃 #F8FAFC） |
| 卡片 | `#FFFFFF` | |
| 输入 / 占位底 | `#F1F5F9` | |
| 文字 主 / 次 / 辅 | `#0F172A` / `#475569` / `#64748B` | 辅助 4.76:1 过 AA（弃 #94A3B8 做正文） |
| 占位符文字 | `#94A3B8` | 占位符豁免 AA |
| 分割线 | `#E2E8F0` | |
| 成功 / 警告 / 危险 | `#10B981` / `#F59E0B` / `#EF4444` | |
| 快捷入口（实心圆 + 白图标） | 蓝 `#0EA5E9` / 绿 `#10B981` / 橙 `#F59E0B` | 白图标在大色块上豁免 |
| 会员卡 | `#0369A1` 纯色 + 白字 | 同时解决对比度与质感 |

- 全纯色，无 `linear-gradient`；字体系统默认（Roboto / SF Pro）。

### 3.5 阴影（iOS + Android 双写）

**审核实证：Taro RN 只把 box-shadow 转成 iOS shadow 四件套，不生成 elevation。** 所有阴影处必须手动补 `elevation`：

- 卡片：`box-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.05); elevation: 2;`
- 商家大圆（突出）：`elevation: 4` + 同档 box-shadow。
- NavBar/TabBar 顶底分割优先用 1px `#E2E8F0` 线而非阴影。

### 3.6 安全区（新建 `utils/safe-area.ts`）

Taro RN 不内置 SafeAreaProvider（已核实）。公式：

- `statusBarHeight`：`getSystemInfoSync().statusBarHeight` 直接用（dp）。
- **底部内嵌 = `screenHeight − safeArea.bottom`**（Taro 返回的 `safeArea.bottom` 是坐标不是 inset；Android 非沉浸式自动得 0，iOS 得 34）。
- 以 inline style 注入 NavBar `paddingTop`、TabBar `paddingBottom`。
- 页面根高度用 `windowHeight`；与 screenHeight 的差异列入批次 B 真机核对项。

### 3.7 border 拆分

`border-bottom: 1px solid X` → `border-bottom-width:1px; border-bottom-color:X; border-bottom-style:solid`。

### 3.8 页面骨架：新建 `PageLayout` 组件（审核 P2-10 采纳）

替代 5 页重复结构 + inline rnHeight hack，安全区口径唯一：

```
<PageLayout nav={<NavBar .../> | null} tabbar={true|false}>
  {children}   // 内部 ScrollView flex:1
</PageLayout>
= View(flex column, height=windowHeight)
  + 状态栏占位 + nav
  + ScrollView(flex:1)
  + CustomTabBar(flex 末项, 含底部安全区)   // tabbar=true 时
```

- 去 `.tab-bar` 的 `position:absolute`；删除各页 `padding-bottom:74px` hack（含 settings 的冗余 hack）。
- 简洁模式首页：`nav=null`、`tabbar=true`（**简洁模式仍保留底部 TabBar**）。

### 3.9 按压反馈

可点元素按下透明度 0.7（RN 用 Pressable/TouchableOpacity 语义；Taro View 的 hoverClass 需真机验证，不生效则批次 D 换 Pressable 包装）。

### 3.10 深色模式口径（本轮锁定浅色）

现状 settings 用 `useThemeColors()` inline 换色、其余页固定浅色，体验分裂。**本轮 RN 锁定浅色**：设置页深色入口保留但点击 toast"深色模式将在后续版本全页支持"；第二步用 `useThemeColors` 全页 inline 化实现真深色。

---

## 四、交互要点（保持现有逻辑，仅重度量/补元素）

1. **三 Tab + 商家动态图标**：启动读 `merchant_approved`（严格 `==='true'`，保留 globalData 预读防冷启闪烁）。未入驻 → 普通尺寸 store 图标 + 文案"入驻"；已入驻有 logo → 大圆 + logo（`onError` 回退默认 store 图标 + 占位底色）；已入驻无 logo → 大圆 + 28dp store 图标。商家名 `numberOfLines=1` 限宽截断。放大仅 approved 时生效。
2. **首页两模式**：普通模式 NavBar（48dp 搜索态）固定搜索框（扫码 + 输入 + 语音/拍照），下方快捷三钮 + 历史 + 热门；简洁模式无 NavBar、搜索框 + 三钮垂直居中、隐藏历史/热门、**保留 TabBar**。简洁模式 ScrollView 居中行为列入批次 C 真机验证。
3. **我的页**：NavBar 居中"我的" + 右侧消息(bell)/设置(settings)（96dp 右栏容纳双 44dp 触控）；会员卡片；功能卡四横钮（收藏轴承/关注商家/浏览历史/全部功能）；**补：积分/收支卡片占位 + 底部版本信息 "OpenFindBearings v1.0.0"**（规范 2.4 要求，现缺失）。
4. **导航栏规则**：简洁首页无 NavBar；其余页标题居中（首页普通模式中间是搜索框）；入驻/商家标题动态；我的/设置/搜索按名。

---

## 五、本轮明确不做（防"静默丢失"，后续功能批次）

| 项 | 去向 |
|---|---|
| 入驻申请表单 / 审核中状态页 / 商家管理面板（现占位） | 功能批次（第一步内后续） |
| 轴承详情页 / 商家详情页 / 登录页 | 功能批次 |
| 首页"推荐商家"模块、"热门轴承"（API 数据，区别于热门关键词） | 功能批次 |
| EmptyState / LoadingState / AuthGuard / PriceTag / MerchantBadge | 功能批次 |
| 深色模式全页、动效（tab 缩放/转场）、FlatList 虚拟化、骨架屏、键盘避让 | 第二步或功能批次 |
| H5 / 小程序适配 | 第二、三步 |

---

## 六、涉及文件（实施清单）

| 文件 | 改动 |
|---|---|
| `config/index.ts` | `scalable:false` + `pxtransform.config.deviceRatio:{750:2}` |
| `src/styles/_rn.scss` | dp token（含行高）+ 3.4 色板 + elevation 注释；清除无单位行高 |
| `src/utils/safe-area.ts` | 新建（3.6 公式） |
| `src/components/PageLayout/` | 新建（3.8） |
| `src/components/NavBar/{index.tsx,index.scss}` | 状态栏 paddingTop、44/48dp、96dp 侧栏、border 拆分、按压反馈 |
| `src/components/CustomTabBar/{index.tsx,index.scss}` | 底部安全区、flex 末项、56dp、elevation、logo onError、名字截断 |
| `src/pages/home/{index.tsx,index.scss}` | PageLayout、dp token、去 hack |
| `src/pages/merchant/{index.tsx,index.scss}` | 同上 |
| `src/pages/my/{index.tsx,index.scss}` | 同上 + 积分卡占位 + 版本信息 |
| `src/pages/my/all-features.{tsx,scss}` | dp token（**v1.6.0 漏列，补**） |
| `src/pages/my/settings.{tsx,scss}` | dp token、去冗余 hack、深色入口 toast |
| `src/pages/home/search.{tsx,scss}` | dp token |
| `src/app.scss` | 清理 `page{line-height:1.5}` 无单位行高（**补**） |

> Icon 组件不改（size 已 dp 直传）。`src/app.boot.ts` 为 H5 遗留，不参与 RN 构建，本轮忽略。

---

## 七、实施顺序（每批 build:rn 验证）

1. **批次 A**：config 双开关 + `_rn.scss` token + `safe-area.ts`。**验收：bundle 尺寸=SCSS 写入值纯数值、无 scalePx2dp**。
2. **批次 B**：PageLayout + NavBar + CustomTabBar。真机：顶/底栏高度、安全区、图标不压文字、大圆不裁剪、windowHeight vs screenHeight 核对。
3. **批次 C**：home（两模式）+ search。真机：搜索态 48dp、简洁模式居中 + TabBar 在位。
4. **批次 D**：my（含积分卡/版本）+ all-features + merchant + settings。
5. **批次 E**：整体走查（三 tab、三态图标、按压反馈、对比度目检）。
6. **批次 F**：文档同步——界面设计规范升 v1.2.0（TabBar 56/大圆 56/快捷入口实心圆/第四钮"全部功能"对齐）、UI 组件规范升 v1.1.0（图标=lucide-react-native+svg，删 PNG tabbar/emoji 过时描述）、v1.5.0 8.10 节修正备注。

---

## 八、验收标准

1. RN 真机：NavBar 44dp（搜索 48）不顶状态栏；TabBar 56dp 固定底部、图标不压文字、让开手势区。
2. 快捷入口 56dp 圆 + 28dp 白图标；商家三态图标正确、大圆阴影在 **Android 可见**（elevation）。
3. 8pt/4pt 网格一致、卡片阴影柔和、圆角统一、按压有反馈、文字对比度过 AA。
4. 我的页含积分卡占位 + 版本信息；简洁模式保留 TabBar。
5. bundle 尺寸为纯数值且等于 SCSS 值；`build:rn` 通过、真机无崩溃。

---

## 九、风险与回滚

- 双开关必须**同批**生效并重写全部 SCSS 到 dp（3.3 表），缺一即尺寸错半或错倍。
- 回滚：删 `deviceRatio` 覆盖 + `scalable` 改 true 即恢复旧行为（SCSS 需一并回退）。
- `deviceRatio` 覆盖仅在 `rn.postcss` 下，H5/小程序链不受影响（第二步再定 H5 口径）。

---

## 十、文档历史

| 版本 | 日期 | 说明 |
|---|---|---|
| v1.5.0 | 2026-09-04 | 图标系统定稿（Icon 抽象层） |
| v1.6.0 | 2026-09-07 | 首版度量重构方案（scalable:false 单开关，机制描述有误） |
| v1.7.0 | 2026-09-07 | 吸收 general 审核：P0 修正缩放机制（pxtransform 减半 + deviceRatio:{750:2} 双开关）；补 elevation 双写、safe-area 底部公式、NavBar 96dp 侧栏/48dp 搜索态、TabBar 触控口径、对比度色板（#0284C7/#0369A1/#64748B）、dp 行高 token、PageLayout 组件、all-features/app.scss 入清单、我的页积分卡+版本信息、深色模式本轮锁浅色、"明确不做"清单、文档同步批次 F |
