/**
 * SVG图标生成脚本
 * 将app-icon.svg转换为Android/iOS/H5所需的各种尺寸PNG
 */
const { Resvg } = require('@resvg/resvg-js');
const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const SVG_PATH = path.join(__dirname, '../src/assets/icon/app-icon.svg');
const ANDROID_RES = path.join(__dirname, '../android/app/src/main/res');
const IOS_ASSETS = path.join(__dirname, '../ios/openfindbearings/Images.xcassets');

// Android mipmap尺寸
const ANDROID_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

// iOS AppIcon尺寸
const IOS_SIZES = {
  'icon-20': 20,
  'icon-29': 29,
  'icon-40': 40,
  'icon-58': 58,
  'icon-60': 60,
  'icon-76': 76,
  'icon-80': 80,
  'icon-87': 87,
  'icon-120': 120,
  'icon-152': 152,
  'icon-167': 167,
  'icon-180': 180,
  'icon-1024': 1024
};

async function renderSvgToPng(svgBuffer, size) {
  const resvg = new Resvg(svgBuffer, {
    fitTo: { mode: 'width', value: size },
    logLevel: 'off'
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

async function generateAndroidIcons() {
  console.log('Generating Android icons...');
  const svgBuffer = fs.readFileSync(SVG_PATH);

  for (const [folder, size] of Object.entries(ANDROID_SIZES)) {
    const dir = path.join(ANDROID_RES, folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const pngBuffer = await renderSvgToPng(svgBuffer, size);

    // 生成普通图标
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), pngBuffer);

    // 生成圆形图标
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), pngBuffer);

    console.log(`  ${folder}: ${size}x${size} ✓`);
  }
}

async function generateIOSIcons() {
  console.log('Generating iOS icons...');
  const svgBuffer = fs.readFileSync(SVG_PATH);

  // 确保AppIcon.appiconset目录存在
  const appiconsetDir = path.join(IOS_ASSETS, 'AppIcon.appiconset');
  if (!fs.existsSync(appiconsetDir)) {
    fs.mkdirSync(appiconsetDir, { recursive: true });
  }

  // 生成各种尺寸
  for (const [name, size] of Object.entries(IOS_SIZES)) {
    const pngBuffer = await renderSvgToPng(svgBuffer, size);
    fs.writeFileSync(path.join(appiconsetDir, `${name}.png`), pngBuffer);
    console.log(`  ${name}: ${size}x${size} ✓`);
  }

  // 生成Contents.json
  const contents = {
    images: [
      { size: '20x20', idiom: 'iphone', filename: 'icon-20.png', scale: '2x' },
      { size: '20x20', idiom: 'iphone', filename: 'icon-40.png', scale: '3x' },
      { size: '20x20', idiom: 'ipad', filename: 'icon-20.png', scale: '1x' },
      { size: '20x20', idiom: 'ipad', filename: 'icon-40.png', scale: '2x' },
      { size: '29x29', idiom: 'iphone', filename: 'icon-58.png', scale: '2x' },
      { size: '29x29', idiom: 'iphone', filename: 'icon-87.png', scale: '3x' },
      { size: '29x29', idiom: 'ipad', filename: 'icon-29.png', scale: '1x' },
      { size: '29x29', idiom: 'ipad', filename: 'icon-58.png', scale: '2x' },
      { size: '40x40', idiom: 'iphone', filename: 'icon-80.png', scale: '2x' },
      { size: '40x40', idiom: 'iphone', filename: 'icon-120.png', scale: '3x' },
      { size: '40x40', idiom: 'ipad', filename: 'icon-40.png', scale: '1x' },
      { size: '40x40', idiom: 'ipad', filename: 'icon-80.png', scale: '2x' },
      { size: '60x60', idiom: 'iphone', filename: 'icon-120.png', scale: '2x' },
      { size: '60x60', idiom: 'iphone', filename: 'icon-180.png', scale: '3x' },
      { size: '76x76', idiom: 'ipad', filename: 'icon-76.png', scale: '1x' },
      { size: '76x76', idiom: 'ipad', filename: 'icon-152.png', scale: '2x' },
      { size: '83.5x83.5', idiom: 'ipad', filename: 'icon-167.png', scale: '2x' },
      { size: '1024x1024', idiom: 'ios-marketing', filename: 'icon-1024.png', scale: '1x' }
    ],
    info: { version: 1, author: 'xcode' }
  };

  fs.writeFileSync(
    path.join(appiconsetDir, 'Contents.json'),
    JSON.stringify(contents, null, 2)
  );
  console.log('  Contents.json ✓');
}

async function generateH5Favicon() {
  console.log('Generating H5 favicon...');
  const svgBuffer = fs.readFileSync(SVG_PATH);
  const staticDir = path.join(__dirname, '../static');

  if (!fs.existsSync(staticDir)) {
    fs.mkdirSync(staticDir, { recursive: true });
  }

  // 生成favicon.png (32x32)
  const pngBuffer = await renderSvgToPng(svgBuffer, 32);
  fs.writeFileSync(path.join(staticDir, 'favicon.png'), pngBuffer);

  console.log('  favicon.png: 32x32 ✓');
}

async function main() {
  try {
    await generateAndroidIcons();
    await generateIOSIcons();
    await generateH5Favicon();
    console.log('\nAll icons generated successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
