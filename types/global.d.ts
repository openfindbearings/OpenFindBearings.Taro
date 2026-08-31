declare namespace NodeJS {
  interface ProcessEnv {
    TARO_ENV: 'weapp' | 'swan' | 'alipay' | 'tt' | 'h5' | 'rn' | 'qq' | 'jd'
    NODE_ENV: 'development' | 'production'
    TARO_APP_API_BASE_URL?: string
    TARO_APP_AUTH_BASE_URL?: string
    TARO_APP_CLIENT_ID?: string
    TARO_APP_CLIENT_SECRET?: string
  }
}
