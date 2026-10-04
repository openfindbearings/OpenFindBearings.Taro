// 自用版资产注入：从 @ofb/taro-pro 读「轴承帮」平台名 + 官方图标真图，覆盖开源版 OpenFindBearings 占位。
// 用法：自用构建前 node scripts/apply-pro.js；开源构建未安装 pro 包时自动跳过。
// 注意：脚本会修改工作区文件（名字 + 图标占位），构建后请 git restore 还原（与既有图标注入同一约定）。
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

let proPkg = null
try {
  proPkg = require.resolve('@ofb/taro-pro/package.json')
} catch (e) {
  console.log('[pro] 未安装 @ofb/taro-pro，开源构建跳过')
  process.exit(0)
}
const proRoot = path.dirname(proPkg)

// ---------- 1. 平台名注入 ----------
const nameJson = path.join(proRoot, 'assets', 'name', 'app-name.json')
if (fs.existsSync(nameJson)) {
  const names = JSON.parse(fs.readFileSync(nameJson, 'utf8'))

  function replaceFile(rel, replacer) {
    const p = path.join(root, rel)
    if (!fs.existsSync(p)) return
    const src = fs.readFileSync(p, 'utf8')
    const out = replacer(src)
    if (out !== src) {
      fs.writeFileSync(p, out)
      console.log('[pro] 名字已替换: ' + rel)
    }
  }

  replaceFile('android/app/src/main/res/values/strings.xml', (s) =>
    s.replace(/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">${names.android}</string>`))
  replaceFile('ios/openfindbearings/Info.plist', (s) =>
    s.replace(/(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${names.ios}$2`))
  ;['project.config.json', 'project.tt.json', 'project.private.config.json'].forEach((f) =>
    replaceFile(f, (s) => s.replace(/("projectname"\s*:\s*")[^"]*(")/, `$1${names.weapp}$2`)))
  replaceFile('src/index.html', (s) => s.replace(/<title>[^<]*<\/title>/, `<title>${names.htmlTitle}</title>`))
} else {
  console.log('[pro] 缺 assets/name/app-name.json，跳过名字注入')
}

// ---------- 2. 官方图标注入 ----------
const iconSrc = path.join(proRoot, 'assets', 'icon')
if (fs.existsSync(iconSrc)) {
  let copied = 0
  // pro 包 assets/icon 下镜像主仓目录结构（android/…、ios/…、src/…、static/…），逐个复制覆盖占位
  function copyDir(from, base) {
    for (const entry of fs.readdirSync(from)) {
      const s = path.join(from, entry)
      const st = fs.statSync(s)
      if (st.isDirectory()) {
        copyDir(s, path.join(base, entry))
      } else {
        const target = path.join(root, base, entry)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, fs.readFileSync(s))
        copied++
      }
    }
  }
  copyDir(iconSrc, '')
  console.log(`[pro] 图标已注入 ${copied} 个文件`)
} else {
  console.log('[pro] 缺 assets/icon，跳过图标注入')
}

console.log('[pro] 完成：构建后请 git restore 还原工作区（名字/图标回到开源版占位）')
