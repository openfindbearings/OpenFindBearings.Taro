// 跨端平台判断工具
// 说明：Metro dev 模式 `process.env.TARO_ENV` 可能未被 babel 注入（运行时为 undefined），
// 改用 Taro 运行时 API getEnv() 判断，保证 H5 / RN / 小程序各端可靠
// 改动说明：修复 RN 端 isRN 判断失效导致页面根节点高度未设置、TabBar 不固定的问题
import Taro from '@tarojs/taro'

export const IS_RN = Taro.getEnv() === Taro.ENV_TYPE.RN
export const IS_H5 = Taro.getEnv() === Taro.ENV_TYPE.WEB
export const IS_WEAPP = Taro.getEnv() === Taro.ENV_TYPE.WEAPP
