import { app, BrowserWindow, Menu, shell, dialog } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { registerIpc, queueOpenFile } from './ipc'
import { registerOcr } from './ocr'

// ---------------- 启动诊断日志（写入用户数据目录，同步刷盘防崩溃丢失） ----------------
let logFile = null
try {
  logFile = join(app.getPath('userData'), 'startup.log')
} catch {
  logFile = null
}
function bootLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try {
    if (logFile) fs.appendFileSync(logFile, line)
  } catch {
    /* 忽略日志自身错误 */
  }
}
bootLog('==== 进程启动 ====')
bootLog(
  `platform=${process.platform} arch=${process.arch} electron=${process.versions.electron} ` +
    `chrome=${process.versions.chrome} node=${process.versions.node} packaged=${app.isPackaged}`
)
bootLog(`argv=${JSON.stringify(process.argv)}`)
bootLog(`__dirname=${__dirname}`)
bootLog(`preload=${join(__dirname, '../preload/index.js')}`)
bootLog(`iconPackaged=${join(__dirname, '../../resources/app_icon.png')}`)

process.on('uncaughtException', (err) => {
  bootLog(`!! uncaughtException: ${err && err.stack ? err.stack : err}`)
  try {
    dialog.showErrorBox('程序启动异常', `${err && err.message ? err.message : err}\n\n详细日志：\n${logFile || ''}`)
  } catch {
    /* 忽略 */
  }
})
process.on('unhandledRejection', (reason) => {
  bootLog(`!! unhandledRejection: ${reason && reason.stack ? reason.stack : reason}`)
})
app.on('child-process-gone', (_e, details) => {
  bootLog(`!! child-process-gone: ${JSON.stringify(details)}`)
})

let mainWindow = null
let readyToQuit = false

// 单实例：第二个实例通过系统文件关联打开 .zyecb 时转发到已有窗口
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const file = argv.find((a) => a.toLowerCase().endsWith('.zyecb'))
    if (file && mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      mainWindow.webContents.send('open-file', file)
    }
  })

  app.whenReady().then(() => {
    bootLog('app.whenReady 完成')
    try {
      registerIpc(() => mainWindow)
      registerOcr(() => mainWindow, resolvePreload)
      bootLog('IPC/OCR 注册完成')

      // 启动参数中携带的工程文件
      const launchFile = process.argv.find((a) => a.toLowerCase().endsWith('.zyecb'))
      if (launchFile) queueOpenFile(launchFile)

      createWindow()
      bootLog('createWindow 返回')

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
      })
    } catch (err) {
      bootLog(`!! whenReady 内异常: ${err && err.stack ? err.stack : err}`)
      throw err
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

function resolvePreload() {
  return join(__dirname, '../preload/index.js')
}

function resolveIcon() {
  // 图标打包在 app.asar 内（app.asar/resources/app_icon.png），
  // 避免作为 extraResources 与 hicolor 图标在 deb/rpm 中形成跨目录硬链接
  if (app.isPackaged) return join(__dirname, '../../resources/app_icon.png')
  return join(process.cwd(), 'resources', 'app_icon.png')
}

function createWindow() {
  bootLog('createWindow 开始')
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    title: '钟毓英语衡水体字帖生成器',
    icon: resolveIcon(),
    backgroundColor: '#f3f4f6',
    webPreferences: {
      preload: resolvePreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  bootLog('BrowserWindow 已创建')

  // 渲染层诊断事件
  mainWindow.webContents.on('did-finish-load', () => bootLog('渲染页面 did-finish-load'))
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    bootLog(`!! did-fail-load code=${code} desc=${desc} url=${url}`)
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    bootLog(`!! render-process-gone: ${JSON.stringify(details)}`)
  })
  mainWindow.webContents.on('preload-error', (_e, preloadPath, err) => {
    bootLog(`!! preload-error path=${preloadPath} err=${err && err.stack ? err.stack : err}`)
  })
  mainWindow.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) bootLog(`renderer[${level}] ${message}`)
  })

  // 与原版一致：启动后最大化
  mainWindow.maximize()

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) {
    bootLog(`loadURL: ${rendererUrl}`)
    mainWindow.loadURL(rendererUrl)
  } else {
    const page = join(__dirname, '../renderer/index.html')
    bootLog(`loadFile: ${page}`)
    mainWindow.loadFile(page).catch((err) => bootLog(`!! loadFile 失败: ${err && err.stack ? err.stack : err}`))
  }

  buildMenu()
  bootLog('菜单构建完成')

  // 关闭前让渲染进程逐一确认未保存的标签页
  mainWindow.on('close', (event) => {
    if (readyToQuit) return
    event.preventDefault()
    mainWindow.webContents
      .executeJavaScript(
        'window.__appHooks && window.__appHooks.canClose ? window.__appHooks.canClose() : true'
      )
      .then((can) => {
        if (can) {
          readyToQuit = true
          mainWindow.close()
        }
      })
      .catch(() => {
        readyToQuit = true
        mainWindow.close()
      })
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function sendMenuAction(id) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-action', id)
  }
}

// Electron 顶层菜单栏（Linux GTK 与 Windows 均如此）会把 "(&X)" 整体从显示文本剥离、仅注册助记符，
// 故顶层采用 "文字(X)(&X)" 双写：显示 "(X)" 且保留 Alt 快捷键；子菜单项只剥离 "&" 本身（字母带下划线）
const topMenuLabel = (text, key) => `${text}(${key})(&${key})`
const itemLabel = (text, key, suffix = '') => `${text}(&${key})${suffix}`

function buildMenu() {
  const template = [
    {
      label: topMenuLabel('文件', 'F'),
      submenu: [
        { label: itemLabel('新建', 'N'), accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('new') },
        { type: 'separator' },
        { label: itemLabel('打开', 'O', '...'), accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open') },
        { label: itemLabel('保存', 'S'), accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('save') },
        {
          label: itemLabel('另存为', 'A', '...'),
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction('saveAs')
        },
        { type: 'separator' },
        {
          label: itemLabel('导出PDF', 'E', '...'),
          accelerator: 'CmdOrCtrl+F',
          click: () => sendMenuAction('exportPdf')
        },
        { type: 'separator' },
        { role: 'close', label: itemLabel('关闭', 'C') }
      ]
    },
    {
      label: topMenuLabel('编辑', 'E'),
      submenu: [
        { role: 'cut', label: itemLabel('剪切', 'T') },
        { role: 'copy', label: itemLabel('复制', 'C') },
        { role: 'paste', label: itemLabel('粘贴', 'P') },
        { type: 'separator' },
        { role: 'selectAll', label: itemLabel('全选', 'A') }
      ]
    },
    {
      label: topMenuLabel('帮助', 'H'),
      submenu: [
        {
          label: itemLabel('帮助', 'H'),
          accelerator: 'F1',
          click: () => sendMenuAction('help')
        },
        { label: itemLabel('用户协议', 'A'), click: () => sendMenuAction('agreement') },
        { type: 'separator' },
        {
          label: '官网',
          click: () => shell.openExternal('https://www.tzzhy.cn/')
        },
        { label: itemLabel('关于', 'A'), click: () => sendMenuAction('about') }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
