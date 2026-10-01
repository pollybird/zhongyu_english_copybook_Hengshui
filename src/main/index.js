import { app, BrowserWindow, Menu, shell } from 'electron'
import { join } from 'path'
import { registerIpc, queueOpenFile } from './ipc'
import { registerOcr } from './ocr'

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
    registerIpc(() => mainWindow)
    registerOcr(() => mainWindow, resolvePreload)

    // 启动参数中携带的工程文件
    const launchFile = process.argv.find((a) => a.toLowerCase().endsWith('.zyecb'))
    if (launchFile) queueOpenFile(launchFile)

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
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

  // 与原版一致：启动后最大化
  mainWindow.maximize()

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  buildMenu()

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

// Linux(GTK) 顶层菜单栏会把 Qt/Win 风格的 "(&X)" 整体从显示文本中剥离（但 Alt+X 助记符仍然生效），
// 顶层采用 "文字(X)(&X)" 双写：显示 "(X)" 且保留快捷键；子菜单项只剥离 "&" 本身（字母保留并带下划线），
// 用原生 "&X" 写法即可。Windows 原生显示无需处理
const topMenuLabel = (text, key) =>
  process.platform === 'linux' ? `${text}(${key})(&${key})` : `${text}(&${key})`
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
