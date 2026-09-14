package com.openfindbearings;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.File;
import java.util.concurrent.atomic.AtomicBoolean;

import androidx.core.content.FileProvider;

/**
 * APK 应用内更新原生模块（Android）
 * 职责：用系统 DownloadManager 下载新版本安装包（通知栏展示进度），
 * 下载完成后经 FileProvider 拉起系统安装界面。
 * 改动说明：版本更新功能上线——GitHub 直连下载国内不稳，改走自建 K3s /dl 静态服务，
 * 需应用内完成"下载→提示安装"闭环，故新增本模块（零第三方依赖，纯系统 API）。
 * iOS 不提供实现，JS 侧按平台分支仅在 Android 调用。
 */
public class ApkUpdateModule extends ReactContextBaseJavaModule {

  /** JS 侧 NativeModules 访问名 */
  public static final String NAME = "ApkUpdate";

  private final ReactApplicationContext reactContext;

  /**
   * 改动说明：新增进度轮询——DownloadManager 无下载进度广播，只能定时查询字节数。
   * active 标志控制轮询循环起止，Handler 复用主线程 Looper（模块操作本就应在 UI 线程调度事件）
   */
  private final android.os.Handler progressHandler = new android.os.Handler(android.os.Looper.getMainLooper());
  private final AtomicBoolean progressActive = new AtomicBoolean(false);
  private DownloadManager progressDownloadManager;

  /** 当前挂起的下载任务 ID（广播回调里比对归属） */
  private long pendingDownloadId = -1;

  /** 下载完成广播接收器（触发一次即注销，避免泄漏） */
  private BroadcastReceiver completionReceiver;

  public ApkUpdateModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return NAME;
  }

  /**
   * 向 JS 发送原生事件（ApkUpdateProgress）
   *
   * @param eventName 事件名
   * @param payload   事件负载
   */
  private void sendEvent(String eventName, WritableMap payload) {
    if (reactContext.hasActiveReactInstance()) {
      reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
          .emit(eventName, payload);
    }
  }

  /**
   * 轮询下载进度并发送事件，直到 active 置否
   * 改动说明：DownloadManager.query 读字节数很廉价，每 500ms 一次对 UI 线程无压力
   */
  private void pollProgress() {
    if (!progressActive.get() || progressDownloadManager == null || pendingDownloadId < 0) {
      return;
    }
    try (android.database.Cursor cursor = progressDownloadManager.query(
        new DownloadManager.Query().setFilterById(pendingDownloadId))) {
      if (cursor != null && cursor.moveToFirst()) {
        int statusIdx = cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS);
        int doneIdx = cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
        int totalIdx = cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
        int status = cursor.getInt(statusIdx);
        long done = cursor.getLong(doneIdx);
        long total = cursor.getLong(totalIdx);
        WritableMap map = Arguments.createMap();
        map.putString("status", statusName(status));
        map.putDouble("downloadedBytes", (double) done);
        map.putDouble("totalBytes", (double) total);
        map.putInt("progress", total > 0 ? (int) (done * 100 / total) : 0);
        sendEvent("ApkUpdateProgress", map);
        // 终态（成功/失败）停止轮询
        if (status == DownloadManager.STATUS_SUCCESSFUL || status == DownloadManager.STATUS_FAILED) {
          progressActive.set(false);
          return;
        }
      }
    } catch (Exception e) {
      progressActive.set(false);
      return;
    }
    progressHandler.postDelayed(this::pollProgress, 500);
  }

  /** 下载状态码转 JS 可读字符串 */
  private static String statusName(int status) {
    switch (status) {
      case DownloadManager.STATUS_RUNNING:
        return "running";
      case DownloadManager.STATUS_PAUSED:
        return "paused";
      case DownloadManager.STATUS_PENDING:
        return "pending";
      case DownloadManager.STATUS_SUCCESSFUL:
        return "success";
      case DownloadManager.STATUS_FAILED:
        return "failed";
      default:
        return "unknown";
    }
  }

  /**
   * 下载并安装 APK。
   * resolve 值语义："downloading"=已入队下载（完成后自动拉起安装）；
   * "need-permission"=缺"安装未知应用"授权（已跳转系统设置页，用户开启后重试）。
   *
   * @param url      APK 完整下载地址（服务端 /dl 静态托管）
   * @param fileName 落地文件名（形如 app-v1.0.0-rc.2-arm64-v8a.apk，仅允许安全字符）
   * @param promise  JS Promise
   */
  @ReactMethod
  public void downloadAndInstall(String url, String fileName, Promise promise) {
    try {
      // 文件名校验：拒绝路径穿越与非法字符，必须是 .apk 结尾的简单文件名
      if (fileName == null || !fileName.matches("[A-Za-z0-9._+-]+\\.apk")) {
        promise.reject("BAD_FILE_NAME", "非法文件名: " + fileName);
        return;
      }
      Context ctx = reactContext.getApplicationContext();

      // Android 8+ 安装未知来源应用需单独授权，未授权先引导去设置页开启
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
          && !ctx.getPackageManager().canRequestPackageInstalls()) {
        Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + ctx.getPackageName()));
        settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(settings);
        promise.resolve("need-permission");
        return;
      }

      // 落地到应用专属外部目录（无需存储权限），FileProvider 授权给安装器读取
      File dir = ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
      File target = new File(dir, fileName);
      if (target.exists() && !target.delete()) {
        // 旧包残留会让 DownloadManager 自动改名（xxx (1).apk）导致安装路径错位，清理失败即中止
        promise.reject("FILE_CLEAN", "旧安装包清理失败，请稍后重试");
        return;
      }

      DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
      DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
      request.setMimeType("application/vnd.android.package-archive");
      request.setTitle(fileName);
      // 通知栏可见并在完成后保留，用户也可从通知栏手动触发安装（兜底）
      request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
      request.setDestinationInExternalFilesDir(ctx, Environment.DIRECTORY_DOWNLOADS, fileName);

      // 注销上一次未触发的接收器，防重复回调
      if (completionReceiver != null) {
        try {
          ctx.unregisterReceiver(completionReceiver);
        } catch (Exception ignored) {
          // 已注销过，忽略
        }
        completionReceiver = null;
      }
      completionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent intent) {
          long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
          if (id != pendingDownloadId) {
            return;
          }
          try {
            c.unregisterReceiver(this);
          } catch (Exception ignored) {
            // 已被注销，忽略
          }
          completionReceiver = null;
          // 改动说明：到达终态即停进度轮询，再按结果决定拉起安装或仅记日志
          progressActive.set(false);
          if (isDownloadSuccessful(dm, id)) {
            installApk(ctx, target);
          } else {
            Log.w(NAME, "APK 下载未完成或失败, id=" + id);
          }
        }
      };
      // Android 13+ 运行时注册接收器必须显式声明导出策略。改动说明：ACTION_DOWNLOAD_COMPLETE
      // 由下载提供者应用（非系统 UID 1000）发出，NOT_EXPORTED 会收不到该广播，故用 EXPORTED；
      // 伪造广播无风险——onReceive 内比对 pendingDownloadId 且经 DownloadManager.query 查真实状态
      if (Build.VERSION.SDK_INT >= 33) {
        ctx.registerReceiver(completionReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            Context.RECEIVER_EXPORTED);
      } else {
        ctx.registerReceiver(completionReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
      }

      pendingDownloadId = dm.enqueue(request);
      // 入队后启动进度轮询，JS 端经 ApkUpdateProgress 事件显示百分比
      progressDownloadManager = dm;
      progressActive.set(true);
      progressHandler.postDelayed(this::pollProgress, 500);
      promise.resolve("downloading");
    } catch (Exception e) {
      promise.reject("APK_UPDATE_ERROR", e.getMessage(), e);
    }
  }

  /**
   * 查询 DownloadManager 任务终态是否成功
   *
   * @param dm 下载服务
   * @param id 下载任务 ID
   */
  private boolean isDownloadSuccessful(DownloadManager dm, long id) {
    try (android.database.Cursor cursor = dm.query(new DownloadManager.Query().setFilterById(id))) {
      if (cursor == null || !cursor.moveToFirst()) {
        return false;
      }
      int statusIndex = cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS);
      return cursor.getInt(statusIndex) == DownloadManager.STATUS_SUCCESSFUL;
    } catch (Exception e) {
      Log.w(NAME, "查询下载状态失败: " + e.getMessage());
      return false;
    }
  }

  /**
   * 经 FileProvider 生成 content:// URI 并拉起系统安装界面。
   * 改动说明：Android 7+ 禁用 file:// URI 跨应用共享（FileUriExposedException），
   * 必须走 FileProvider 并授予临时读权限。
   *
   * @param ctx  应用上下文
   * @param file 已下载完成的 APK 文件
   */
  private void installApk(Context ctx, File file) {
    try {
      Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", file);
      Intent install = new Intent(Intent.ACTION_VIEW);
      install.setDataAndType(uri, "application/vnd.android.package-archive");
      install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
      ctx.startActivity(install);
    } catch (Exception e) {
      // 拉起安装失败（如个别 ROM 无响应处理器）不打崩应用，通知栏仍可手动点装
      Log.w(NAME, "拉起安装界面失败: " + e.getMessage());
    }
  }
}
