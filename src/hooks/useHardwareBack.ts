// 系统返回键拦截（H5/小程序端空实现）：无系统返回键拦截需求，
// 直接放行（浏览器回退按钮走 history 栈，不由 React 控制）。
export function useHardwareBack(_handler: () => boolean): void {}
