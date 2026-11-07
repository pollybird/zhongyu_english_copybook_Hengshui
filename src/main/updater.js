/**
 * 自动更新（Electron 集成层）
 *
 * - 简中系统优先 GitCode、英文/其他优先 GitHub，主源失败自动换另一源重试；
 * - 发现新版本先弹窗确认，用户选择后才下载（autoDownload = false）；
 * - 仅 Windows / Linux 启用：macOS 包未签名，自动安装无法通过签名校验。
 */
import { app, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { getFeedFileName, prefersGitCodeFirst, resolveFeedUrl } from './update-feed'

const FEED_FILE = getFeedFileName()
const FEED_TTL_MS = 10 * 60 * 1000
// macOS 包未签名，自动安装无法通过签名校验；Linux arm64 的更新清单（latest-linux-arm64.yml）
// 不被 electron-updater 识别，会误取 x64 包，因此仅 Windows（x64+arm64 合并安装包）与 Linux x64 启用。
const SUPPORTED =
  process.platform === 'win32' || (process.platform === 'linux' && process.arch === 'x64')

let getMainWindow = () => null
let manualCheck = false
let cachedFeedUrl = null
let cachedAt = 0

function forward(channel, payload) {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

function prefsPath() {
  return join(app.getPath('userData'), 'update-preference.json')
}

function readSkippedVersion() {
  try {
    return String(JSON.parse(readFileSync(prefsPath(), 'utf8')).skippedVersion || '')
  } catch {
    return ''
  }
}

function writeSkippedVersion(version) {
  try {
    mkdirSync(dirname(prefsPath()), { recursive: true })
    writeFileSync(prefsPath(), JSON.stringify({ skippedVersion: String(version) }))
  } catch (err) {
    console.error('[updater] failed to persist skipped version:', err.message)
  }
}

/**
 * 解析可用 feed（结果缓存 10 分钟），并配置 electron-updater 的 generic provider。
 * excludeBase 用于主源检查失败后强制换源重试。
 */
async function resolveFeed(force, excludeBase) {
  if (!force && excludeBase === undefined && cachedFeedUrl && Date.now() - cachedAt < FEED_TTL_MS) {
    return cachedFeedUrl
  }
  const url = await resolveFeedUrl({
    feedFile: FEED_FILE,
    gitCodeFirst: prefersGitCodeFirst(app.getLocale()),
    ...(excludeBase ? { excludeBase } : {}),
    log: (message) => console.log(message)
  }).catch(() => null)
  if (url) {
    cachedFeedUrl = url
    cachedAt = Date.now()
    // GitCode WAF 对 electron-updater 追加的 ?noCache=<随机串> 返回 404；
    // 带 private-token 请求头时 electron-updater 不再追加该参数，空值对 GitCode 无副作用。
    autoUpdater.requestHeaders = url.includes('gitcode.com') ? { 'Private-Token': '' } : {}
    autoUpdater.setFeedURL({ provider: 'generic', url })
  }
  return url
}

function reportCheckFailure() {
  const manual = manualCheck
  manualCheck = false
  if (manual) forward('update:error', { manual: true })
}

async function runCheck() {
  const feedUrl = await resolveFeed(false)
  if (!feedUrl) {
    console.error('[updater] neither GitHub nor GitCode feed reachable')
    reportCheckFailure()
    return
  }
  try {
    await autoUpdater.checkForUpdates()
    return
  } catch (err) {
    console.error('[updater] check failed on primary source:', err?.message || err)
  }
  const altUrl = await resolveFeed(true, feedUrl)
  if (altUrl) {
    try {
      await autoUpdater.checkForUpdates()
      return
    } catch (err) {
      console.error('[updater] check failed on fallback source:', err?.message || err)
    }
  }
  reportCheckFailure()
}

/** 初始化：注册事件与 IPC，启动 5 秒后静默检查一次 */
export function initAutoUpdater(getWindow) {
  getMainWindow = getWindow
  if (!app.isPackaged) {
    console.log('[updater] dev mode, skipping auto-update')
    return
  }

  autoUpdater.logger = console
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => forward('update:checking'))
  autoUpdater.on('update-available', (info) => {
    const manual = manualCheck
    manualCheck = false
    // 「不再提示此版本」只影响静默检查；手动检查不受限制
    const skipped = readSkippedVersion()
    if (!manual && skipped === info.version) {
      console.log(`[updater] update ${info.version} skipped by user preference`)
      return
    }
    forward('update:available', { version: info.version, releaseDate: info.releaseDate })
  })
  autoUpdater.on('update-not-available', (info) => {
    const manual = manualCheck
    manualCheck = false
    forward('update:not-available', { version: info.version, manual })
  })
  autoUpdater.on('download-progress', (progress) => {
    forward('update:download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      total: progress.total,
      transferred: progress.transferred
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    forward('update:downloaded', { version: info.version })
  })
  // 失败提示统一由 runCheck / downloadUpdate 收口，避免 error 事件与 Promise 拒绝重复弹窗
  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err?.message || String(err))
  })

  ipcMain.handle('update:check', () => {
    if (!SUPPORTED) {
      forward('update:unsupported')
      return null
    }
    manualCheck = true
    return runCheck().then(() => null)
  })
  ipcMain.handle('update:download', () => {
    return autoUpdater.downloadUpdate().catch((err) => {
      console.error('[updater] downloadUpdate failed:', err.message)
      forward('update:error', { manual: true })
    })
  })
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })
  ipcMain.handle('update:skip-version', (_event, version) => {
    writeSkippedVersion(version)
  })

  if (!SUPPORTED) {
    console.log('[updater] auto-update disabled on this platform (unsigned macOS build)')
    return
  }
  setTimeout(() => {
    void runCheck()
  }, 5000)
}

/** 手动触发更新检查（帮助菜单「检查更新」） */
export function checkForUpdates() {
  if (!app.isPackaged) return
  if (!SUPPORTED) {
    forward('update:unsupported')
    return
  }
  manualCheck = true
  void runCheck()
}
