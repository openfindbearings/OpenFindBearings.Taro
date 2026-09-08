# Taro 架构设计

> 版本：v1.0.0
> 日期：2026-09-08
> 状态：现行（描述当前架构，非演进方案；重构历史见 `archive/`）
> 取代：Taro架构重构方案（已落地）、Taro移动端设计（架构部分）

## 1. 定位与技术栈

OpenFindBearings 移动端，一套代码多端编译。当前阶段专注 React Native（Android/iOS）达标，H5、微信小程序为后续阶段在其上做加法。

| 维度 | 选型 |
|---|---|
| 框架 | Taro 3.6.40 + React 18 + TypeScript |
| 原生 | React Native 0.70（Taro 3.6 锁定，不升 0.73） |
| 样式 | Sass，Flex 布局，dp 直写（见 §5） |
| 状态 | Zustand |
| 图标 | Icon 抽象层：RN=lucide-react-native+react-native-svg，H5=lucide-react |
| 安全区 | react-native-safe-area-context（4.x） |
| 网络 | 统一经 Mobile BFF（bff.515813.xyz/mobile/*），不直连 API/Identity |
| 目标平台 | rn（当前）/ h5 / weapp（后续） |

## 2. 三阶段路线

| 阶段 | 目标 | 状态 |
|---|---|---|
| 1 | 标准 RN（Android/iOS）：dp 度量、安全区、组件、主题、深色、字号、BFF 对接 | **当前** |
| 2 | 扩展 H5：CSS 变量运行时主题、rem、响应式 | 后续 |
| 3 | 扩展微信小程序：rpx、原生/浮动 tabBar、包体积 | 后续 |

原则：RN 属性支持最少，先满足 RN，他端追加能力，不回迁 RN 迁就 H5。

## 3. 目录结构

```
src/
  app.config.ts        # 路由 + 全局 window（navigationStyle:custom）
  app.tsx / app.rn.tsx # 入口（RN 挂 SafeAreaProvider）；启动初始化 主题/字号/主题色
  pages/               # 页面（每页 index.tsx + index.scss + index.config.ts）
  components/          # PageLayout / NavBar / CustomTabBar / Icon / Switch
  services/            # request / config / home / bearing / merchant / auth / user
  stores/              # zustand：theme / fontSize / theme-color / auth / settings
  hooks/               # useTheme / useFontScale / useThemeColor / use-system-theme
  styles/              # _rn.scss（dp+色 token，RN 编译期）
  utils/               # storage（异步封装）/ platform / safe-area / format
  content/             # legal.ts（隐私合规全文）
```

## 4. 分层架构

- **UI 层**：pages + components，只用 Taro 跨端组件（View/Text/Image/ScrollView/Input）+ Flex。
- **平台适配层**：`.rn.tsx`/`.h5.ts` 文件后缀分支（Metro 优先 `.rn`，webpack 用 `.tsx`）；共享接口放无后缀文件。跨端 hook（use-safe-area、use-system-theme）。
- **服务层**：`services/*` 封装 BFF 调用与 DTO；`request.ts` 统一解包 `{success,code,data,message}`、附加 JWT、401 刷新重放。
- **状态层**：Zustand 管主题/字号/主题色/登录态；设备偏好本地持久化（storage.ts 异步）。

## 5. 度量系统（dp 直写）

RN 缩放机制是两级（pxtransform 减半 + css-to-react-native 缩放）。用双开关关掉，使 SCSS 的 `Npx` = RN 的 `N`dp 1:1：

```ts
// config/index.ts → rn.postcss
scalable: false,
pxtransform: { enable: true, config: { deviceRatio: { 750: 2 } } }  // rootValue=1
```

- 只作用 RN 链，H5/小程序 designWidth 不受影响。
- 度量 token 与色板在 `styles/_rn.scss`（NavBar 44/搜索 48/侧栏 72、TabBar 56、tab 图标 24、快捷圆 56、搜索框 36、卡片圆角 12）。
- Icon `size` 为 JS 数字，不经样式链，直接 dp。
- 关键尺寸/字号/色值详见《界面设计规范 v1.3.0》。

## 6. 主题系统

### 6.1 运行时全色板 `useTheme()`

RN 无 CSS 变量、SCSS 颜色编译期常量 → 全站颜色 inline 接管。`hooks/useTheme.ts` 按 `模式 × 预设` 计算完整色板（bgPage/bgCard/bgInput/textPrimary/…/primary/primaryText/danger/…/navBarBg/memberGradientFrom…），各页 `<Text style={{...fs(n), color:t.xxx}}>` 取用。

- **三模式**：light / dark / system（`stores/theme.ts`，持久化 `app_theme`；system 用 RN `Appearance` 订阅，见 `use-system-theme`）。
- **六预设**（`styles/themes.ts`，持久化 `app_theme_color`）：天空蓝(默认)/翡翠绿/琥珀橙/玫瑰红/紫罗兰/石墨灰。
- **方案①**：深色用固定中性深色彩底，强调色仍尊重用户预设（每预设的 `primaryDark` 亮变体）→ 切深色不跳色。
- 浅色文字级主色用 #0284C7/#0369A1（#0EA5E9 对白对比不足 AA）。

### 6.2 全局字号 `useFs(base)`

`stores/fontSize.ts`（small0.9/medium1.0/large1.15，持久化 `app_font_size`）+ `hooks/useFontScale.ts`。各 Text 保留 className 供颜色/字重，加 inline `style={fs(base)}` 供缩放。

### 6.3 启动初始化

`app.tsx` useLaunch 调 `initTheme()+initFontSize()+initThemeColor()` 从存储恢复并应用。

> 主题色/深色/字号/音效/震动/首页模式 = 设备偏好，存本地；账号/合规类（推送订阅、隐私同意、注销）待登录进后端，见《设置入库与合规待办 v1.0.0》。

## 7. UI 组件架构

| 组件 | 职责 |
|---|---|
| PageLayout | 统一骨架：NavBar(顶) + ScrollView flex:1(内容，contentContainerStyle flexGrow:1) + CustomTabBar(底)；页面底色 inline=t.bgPage；去各页 rnHeight/padding-bottom hack |
| NavBar | 标准安全区（外层吃 insets.top、内层固定 44/48dp）；三栏；`searchMode`/`centerSlot`/`rightSlot`/`rightIcons`（声明式，规避跨文件 className 失效） |
| CustomTabBar | 56dp 浮动自绘；商家 tab 仅入驻通过(approved)后放大凸出大圆+logo；切 tab 用 redirectTo；颜色随 useTheme |
| Icon | 平台分支抽象层；`toPascal` 按 `-`/`_` 分割解析 Lucide 名 |
| Switch | 平台分支：RN 用原生 Switch 全控 trackColor/thumbColor（修 Taro Switch 圆点恒绿），H5 用 Taro Switch |

> RN className 文件作用域：跨文件用类名不生效 → 需组件内部渲染（如 NavBar rightIcons）。

## 8. 认证与网络

- `getBaseUrl()` 按 `process.env.TARO_ENV`：H5 返回 `''`（dev proxy），RN/小程序返回绝对地址 `https://bff.515813.xyz`（env `TARO_APP_BFF_BASE_URL` 可覆盖）。RN 真机相对路径会 `Network request failed`。
- 登录：手机号+验证码/密码，经 BFF `/mobile/auth/*` 代理 Identity OAuth；`device_id`（本地随机 GUID）随登录/刷新携带，服务端绑定校验（设备间不共享登录态）。
- token：access_token 内存、refresh_token 本地存储；401 自动刷新重放。
- 查询串用 `buildQuery`（Hermes 无 URLSearchParams.set）；图片用 `usableImage`（仅绝对地址渲染，相对路径回退占位）。
- 公开查询（首页/搜索/详情）无需登录；收藏/关注/纠错/入驻/主题色/简洁模式为登录门槛（未登录 showModal 提示）。

## 9. 页面清单

| 路由 | 说明 |
|---|---|
| pages/home/index | 首页（普通/简洁双模式，热门轴承+推荐商家，BFF /home） |
| pages/home/search | 搜索（轴承/商家/品牌/类型 四类 Tab，命中数+自动选最多） |
| pages/home/bearingDetail | 轴承详情（参数+在售商家+替代品，交叉跳转） |
| pages/merchant/index | 入驻/商家（按状态条件展示） |
| pages/merchant/merchantDetail | 商家详情（logo+联系+在售轴承，入驻标签） |
| pages/my/index | 我的（会员卡+四宫格） |
| pages/my/settings | 设置（主题/深色/字号/首页模式/隐私/账户） |
| pages/my/all-features | 全部功能 |
| pages/common/doc | 隐私合规文档页（PIPL 全文） |

## 10. 跨端约束（RN 红线）

禁：position fixed/sticky、CSS 变量/var()、SCSS linear-gradient、gap、百分比 border-radius、无单位 lineHeight、组合/伪类选择器、`border-*-style`（RN 无效，用独立分隔 View）。Text 的 fontSize/lineHeight 必须数值。详见《跨端适配说明 v1.2.0》。

## 11. 构建与调试

| 命令 | 用途 |
|---|---|
| `pnpm run dev:rn` | Metro 8081（配 `adb reverse tcp:8081 tcp:8081`） |
| `cd android; .\gradlew.bat app:installDebug` | 打 debug APK |
| `npx taro build --type rn --watch --reset-cache` | SCSS/新增配置不生效时 |
| `pnpm run build:h5` / `build:weapp` | 后续阶段 |

改 SCSS/新增 `.config.ts`/原生库 → 必须重启 Metro（`--reset-cache`），按 R 不重编。

## 12. 专项文档索引

| 文档 | 内容 |
|---|---|
| 界面设计规范 v1.3.0 | 色彩/运行时主题/字号/组件/页面布局/度量 token |
| API 对接说明 v1.1.0 | 前端调用 BFF 的接口清单与结构 |
| UI 组件规范 v1.1.0 | 图标抽象层、公共组件、样式变量 |
| 跨端适配说明 v1.2.0 | 三阶段路线、RN 度量/存储/安全区/图标/兼容坑 |
| 设置入库与合规待办 v1.0.0 | 账号/合规类设置进库设计（随登录实现，待完成） |

## 13. 版本历史

| 版本 | 日期 | 说明 |
|---|---|---|
| v1.0.0 | 2026-09-08 | 首版架构设计：整合已落地的重构方案(v1.7.0)+移动端设计，描述现行架构（度量/主题/UI/认证/页面/跨端约束），历史归档 archive/ |
