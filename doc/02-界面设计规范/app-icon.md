# App图标管理

## 版本

v1.0.0

## 图标源文件

```
src/assets/icon/app-icon.svg
```

## 生成命令

```bash
# 安装依赖（首次）
pnpm add -D @resvg/resvg-js

# 生成所有尺寸图标
node scripts/generate-icons.js
```

## 生成范围

### Android
- mipmap-mdpi (48x48)
- mipmap-hdpi (72x72)
- mipmap-xhdpi (96x96)
- mipmap-xxhdpi (144x144)
- mipmap-xxxhdpi (192x192)

每个目录生成：
- `ic_launcher.png`
- `ic_launcher_round.png`

### iOS
- AppIcon.appiconset 目录
- 13种尺寸 (20x20 ~ 1024x1024)
- 自动生成 Contents.json

### H5
- `static/favicon.png` (32x32)

## 修改流程

1. 修改 `src/assets/icon/app-icon.svg`
2. 运行 `node scripts/generate-icons.js`
3. 提交所有变更
