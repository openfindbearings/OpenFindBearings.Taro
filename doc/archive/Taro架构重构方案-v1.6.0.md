# Taro 移动端 RN 度量重构方案

> **状态**：方案定稿（缩放机制源码实证 + scalable:false 已实测 + 安全区方式确定，待确认实施）
> **版本**：v1.6.0
> **日期**：2026-09-07
> **目标**：按 Taro 标准 RN 模板，实现一个**漂亮、舒服、标准的 React Native 应用**（Android + iOS）
> **适用**：Taro 3.6.40 + React Native 0.70
> **范围**：本轮只做 RN，不涉及 H5 / 小程序

---

## 〇、分期路线（本轮只做第一步）

| 阶段 | 内容 | 状态 |
|---|---|---|
| **第一步** | 按 **Taro 标准 RN 模板** 实现漂亮舒服、达标主题/功能的 RN App | **本轮实施** |
| 第二步 | 扩展兼容 H5 | 后续 |
| 第三步 | 扩展兼容微信小程序等 | 后续 |

本轮专注第一步：完全按标准 RN 来，不为 H5/小程序做任何迁就。业务代码/组件仍用 Taro 跨端写法（View/Text/ScrollView），为后续两阶段留复用空间，但**验收只看 RN**。

---

## 一、设计目标：怎样才算"标准、漂亮舒服的 RN"

一个"对味"的 RN App 不靠堆样式，靠原生规范落地。本方案以下列 7 条为验收基准：

1. **安全区精确**：顶部让开状态栏、底部让开手势条 / Home Indicator。
2. **顶栏 / 底栏尺寸对齐平台**：顶栏 44pt(iOS)/56dp(Material)、底 Tab 56dp、图标 24–28、label 12。
3. **8pt 间距网格**：所有 margin/padding 取 8 的倍数，留白一致 → 呼吸感。
4. **排版层级清晰**：大标题/标题/正文/辅助四档字号 + 1.4–1.5 行高 + 系统字体（SF Pro / Roboto）。
5. **柔和阴影 + 统一圆角**：卡片用轻阴影、圆角 8–12，不用重黑边。
6. **触控目标 ≥44×44 + 按压反馈**：按下透明度反馈，点起来"跟手"。
7. **色彩克制**：1 主色 + 中性灰阶 + 语义色，对比度达 WCAG AA。

---

## 二、缩放机制（源码实证，非猜测）

### 2.1 现象根因

RN 样式编译链：`SCSS → postcss-pxtransform → taro-css-to-react-native → StyleSheet`。

关键在 `taro-css-to-react-native/css-to-react-native/index.js` 的 `transformRawValue`：

```js
var num = Number(numberMatch[1])
if (/(\d+)px/.test(value))        // 仅小写 px（正则无 i，不匹配大写 PX）
  return "scalePx2dp(" + num + ")" // → 运行时按屏宽缩放
else
  return num                       // 大写 PX / 无单位 → 纯数值，不缩放
```

- **默认 `scalable:true`**：`44px` → `scalePx2dp(44)` → 运行时 `44 × 屏幕dp宽 / designWidth(750)`。本机 393dp → `44×0.524 = 23dp`。**这就是"整体偏小一半"的真相**。
- **`scalable:false`**：上游把 `44px` 转大写 `44PX` → 不匹配小写正则 → 走 `else` 返回**纯数值 44** → RN 固定 **44dp**。

`scalable` 开关读取点：`@tarojs/rn-style-transformer/transforms/index.js:193` = `config.rn.postcss.scalable`（默认 true）。

### 2.2 Icon size 不缩放

`Icon` 组件 `size` 是 JS 数字，不经样式编译链，**直接是 dp**。这是旧代码"图标盖文字"根因：`size=26`（26dp）塞进 SCSS `32px`（缩放后仅 16dp）容器。

### 2.3 实测验证（已完成）

- `config` 加 `rn.postcss.scalable:false` 后 `build:rn` 通过，bundle 内尺寸/字号均为**纯数值**（`height:44`），无 `"44PX"` 字符串、无 `scalePx2dp` → RN 不会因字符串崩溃。

---

## 三、核心解法：关闭 RN 缩放，SCSS 直写 dp

### 3.1 配置（已落地）

`config/index.ts` 的 `rn` 段：

```ts
rn: {
  postcss: {
    scalable: false,   // 关闭 scalePx2dp，SCSS 的 px 在 RN 端 1:1 当作 dp
    cssModules: { enable: false }
  }
}
```

### 3.2 度量规则

| 写法 | RN 结果 |
|---|---|
| SCSS `height: 44px` | **44dp（固定，跨机型稳定）** |
| SCSS `font-size: 15px` | **15dp（固定）** |
| `Icon size={24}`（JS 数字） | **24dp** |
| inline `{paddingTop: 44}` | **44dp** |

- SCSS 尺寸/字号**直接写目标 dp 数值**，所见即所得，tabbar 恒 56dp 不被大屏撑高（符合原生 App）。
- `Icon size`（dp）与 SCSS 容器（dp）同单位 → **图标不再压文字**。

### 3.3 RN 度量标准值（写进 SCSS，px = dp，对齐 Material/HIG）

**布局**

| 元素 | dp |
|---|---|
| NavBar 高 | 44 |
| NavBar 左右栏宽 | 56 |
| NavBar 水平 padding | 16 |
| 导航图标容器（Icon size 24） | 44 |
| TabBar 高 | 56 |
| tab 图标容器（Icon size 24） | 44 |
| tab 文字 | 12 |
| 商家大圆 / 内 logo / 上移 | 56 / 48 / 14 |
| 快捷入口圆（Icon size 28） | 56 |
| 搜索框高 | 36 |
| 卡片 padding | 16 |
| 圆角 小/中/大/特大 | 6/8/12/16 |
| 间距 1/2/3/4/5/6/8 | 4/8/12/16/20/24/32 |

**字号（1.4–1.5 行高）**

| 用途 | dp |
|---|---|
| 大标题 | 18 |
| 标题 | 17 |
| 正文 | 15 |
| 辅助 | 13 |
| 标签 / tab | 12 |

### 3.4 主题（清新 / 现代 / 简洁 / 明快，全纯色，RN 友好）

| 用途 | 色值 |
|---|---|
| 主色 | `#0EA5E9`（浅 `#38BDF8` / 深 `#0284C7`） |
| 页面底 | `#F5F7FA` |
| 卡片 | `#FFFFFF` |
| 输入 / 占位底 | `#F1F5F9` |
| 文字 主/次/辅 | `#0F172A` / `#475569` / `#94A3B8` |
| 分割线 | `#E2E8F0` |
| 成功 / 警告 / 危险 | `#10B981` / `#F59E0B` / `#EF4444` |
| 快捷入口（实心圆 + 白图标） | 语音蓝 `#0EA5E9` / 拍照绿 `#10B981` / 扫码橙 `#F59E0B` |
| 会员卡 | 主色纯色（RN 不支持渐变） |

- 全纯色，无 `linear-gradient`。
- 字体系统默认（RN 内置 Roboto / SF Pro），零版权风险。

### 3.5 阴影 / 圆角（原生质感）

- 卡片：`box-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.05)`（Taro RN 映射为 iOS shadow + Android elevation）。
- 圆角走 token（6/8/12/16），大圆 999。
- 不用重黑边，分割线 `#E2E8F0` 1px。

### 3.6 安全区（新建 `utils/safe-area.ts`）

**已确认 Taro RN（runtime-rn / components-rn）不内置 SafeAreaProvider**，安全区必须自己做。`safe-area.ts` 用 `Taro.getSystemInfoSync()` 取 `statusBarHeight`、`safeArea.bottom`（dp），以 **inline style**（不缩放）注入 NavBar `paddingTop`、TabBar `paddingBottom`。不依赖 Provider，最稳。

### 3.7 border 拆分

`border-bottom: 1px solid X` → `border-bottom-width:1px; border-bottom-color:X; border-bottom-style:solid`（RN 不认 shorthand）。

### 3.8 TabBar 定位

去 `.tab-bar` 的 `position:absolute`，改为页面 `flex column` 的普通末子项。页面结构统一：

```
<View flex column height=windowHeight>
  <NavBar/>            // 顶部（含状态栏 paddingTop）
  <ScrollView flex:1>  // 中间滚动
  <CustomTabBar/>      // 底部 flex 末项（含底部安全区）
</View>
```

删除各页 `padding-bottom: 74px` 避让 hack。

### 3.9 按压反馈

可点元素加按下透明度反馈（Taro `View` 的 `hoverClass`，或 RN `Pressable`），触控目标 ≥44×44。

---

## 四、交互要点（保持现有逻辑，本轮仅重度量）

1. **三 Tab + 商家动态图标**：启动读 `merchant_approved`（严格 `==='true'`）。未入驻 → 中间 tab 普通尺寸店铺图标(store)、文案"入驻"；已入驻有 logo → 大圆 + logo；已入驻无 logo → 大圆 + 放大 store 图标。放大仅 approved 时生效。
2. **首页两模式**：普通模式 NavBar 固定搜索框（扫码 + 输入 + 语音/拍照），下方快捷三钮 + 历史 + 热门；简洁模式无 NavBar，搜索框 + 三钮垂直居中、隐藏历史/热门。
3. **我的页**：NavBar 居中"我的" + 右侧消息(bell)/设置(settings)；下会员卡片；再功能卡（收藏轴承/关注商家/浏览历史/全部功能 四横钮），"全部功能"进功能大全页。
4. **导航栏规则**：简洁首页无 NavBar；其余有 NavBar 的页标题居中（首页普通模式中间是搜索框）；入驻/商家标题动态；我的/设置/搜索按名。

---

## 五、涉及文件（实施清单）

| 文件 | 改动 |
|---|---|
| `config/index.ts` | `rn.postcss.scalable:false`（**已落地**） |
| `src/styles/_rn.scss` | 尺寸/字号 token 改为目标 dp 直写；主题纯色 + 阴影 |
| `src/utils/safe-area.ts` | 新建 |
| `src/components/NavBar/{index.tsx,index.scss}` | 状态栏 paddingTop、dp token、border 拆分、按压反馈 |
| `src/components/CustomTabBar/{index.tsx,index.scss}` | 底部安全区、flex 末项去 absolute、dp token、border 拆分 |
| `src/pages/home/{index.tsx,index.scss}` | 快捷入口/搜索框 dp token、去 padding-bottom hack |
| `src/pages/merchant/{index.tsx,index.scss}` | dp token、去 hack |
| `src/pages/my/{index.tsx,index.scss}` | 会员卡/功能卡 dp token、去 hack |
| `src/pages/my/settings.tsx + settings.scss` | dp token |
| `src/pages/home/search.tsx + search.scss` | dp token |

> Icon 组件（`index.rn.tsx`）不改：`size` 已是 dp 直传，与 SCSS 一致。
> `src/app.boot.ts` 是 H5 遗留（`createApp` 导出实际不存在），不参与 RN 构建，本轮忽略，第二步做 H5 时再处理。

---

## 六、实施顺序（每批可独立 build 验证）

1. **批次 A**：`_rn.scss` token + `safe-area.ts`（config 已改）。`build:rn` 验证 bundle 尺寸为纯数值。
2. **批次 B**：NavBar + CustomTabBar。`build:rn` + 真机看顶/底栏高度、图标不压文字、安全区。
3. **批次 C**：home 页。真机看快捷入口比例、搜索框。
4. **批次 D**：my / merchant / search / settings。
5. **批次 E**：整体真机走查（三 tab、两模式、我的页结构、按压反馈）。

---

## 七、验收标准

1. RN 真机：NavBar 44dp 且**不顶状态栏**；TabBar 56dp 固定底部、**图标不压文字**、让开手势区。
2. 快捷入口 56dp 圆、图标 28dp，比例协调，整体"像标准 App"。
3. 商家 tab 动态图标正确；首页两模式正确；我的页结构正确。
4. 8pt 间距一致、卡片阴影柔和、圆角统一、按压有反馈。
5. 主题色统一、字体系统默认。
6. RN `build:rn` 通过，真机无崩溃。

---

## 八、风险与回滚

- `scalable:false` 全局生效：改后**所有** SCSS px 在 RN 端从"缩放"变"固定 dp"。必须**同步重写全部页面 SCSS 到 dp 标准**（3.3 表），不能只改开关——否则旧的小 px 值（如 12px 文字）会变 12dp 偏大。
- 回滚：`scalable` 改回 true 即恢复旧行为（页面 SCSS 若已改 dp 值需一并回退）。

---

## 九、文档历史

| 版本 | 日期 | 说明 |
|---|---|---|
| v1.5.0 | 2026-09-04 | 图标系统定稿（Icon 抽象层） |
| v1.6.0 | 2026-09-07 | RN 度量重构方案定稿（**纯 RN 标准 App，第一步**）：源码实证 scalePx2dp 机制 → `rn.postcss.scalable:false` 关闭缩放、SCSS 直写 dp（实测出纯数值）；确立"漂亮舒服 RN"7 条设计基准（安全区/顶底栏尺寸/8pt 网格/排版层级/柔和阴影/触控反馈/克制配色）；dp 度量标准表 + 纯色清新主题 + 系统字体 + getSystemInfoSync 安全区 + border 拆分 + TabBar flex 末项 + 按压反馈；明确三阶段路线（RN→H5→小程序），本轮只做 RN；列实施批次与成套重写风险 |
