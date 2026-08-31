import type { UserConfigExport } from '@tarojs/cli'

export default {
  logger: {
    quiet: false,
    stats: true,
  },
  mini: {},
  h5: {
    server: {
      host: '0.0.0.0',
      port: 10087,
      proxy: {
        // API 请求代理到后端服务器（解决 H5 跨域问题）
        '/api': {
          target: 'https://api.515813.xyz',
          changeOrigin: true,
          secure: false,
        },
        // Identity OAuth 端点代理
        '/connect': {
          target: 'https://auth.abcsxl.com',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  },
} satisfies UserConfigExport
