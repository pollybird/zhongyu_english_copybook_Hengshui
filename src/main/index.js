import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron'
import { join } from 'path'
import { registerIpc, queueOpenFile } from './ipc'
import { registerOcr } from './ocr'
import { createT, isZhLocale } from '../shared/i18n.js'

// 系统语言：zh* 用中文，其余语言一律英文兜底（app.getLocale 在 ready 后可用）
let t = (key) => key

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
    t = createT(app.getLocale())
    registerIpc(() => mainWindow, resolveIcon, t)
    registerOcr(() => mainWindow, resolvePreload, t)

    // 渲染进程查询界面语言
    ipcMain.handle('app:get-locale', () => app.getLocale())

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
    title: t('appName'),
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

// 菜单助记符跨平台写法（实测 Electron 31/33）：
// - 中文：Linux GTK 与 Windows 顶层菜单会把 "(&X)" 整体剥离只注册助记符，
//   故顶层双写 "文字(X)(&X)"；子菜单 "文字(&X)" 仅剥 & 符号、字母带下划线
// - 英文：标准 "&File" 写法即可（GTK 剥符号保留字母，Win 显示下划线）
function buildLabels(zh) {
  const underline = (text, key, suffix = '') => {
    if (zh) return `${text}(&${key})${suffix}`
    if (key && text.includes(key)) return text.replace(key, `&${key}`) + suffix
    return `&${text}${suffix}`
  }
  return {
    top: (text, key) => (zh ? `${text}(${key})(&${key})` : underline(text, key)),
    item: underline
  }
}

function buildMenu() {
  const zh = isZhLocale(app.getLocale())
  const L = buildLabels(zh)
  const template = [
    {
      label: L.top(t('menu.file'), 'F'),
      submenu: [
        { label: L.item(t('menu.new'), 'N'), accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('new') },
        { type: 'separator' },
        { label: L.item(t('menu.open'), 'O', '...'), accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open') },
        { label: L.item(t('menu.save'), 'S'), accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('save') },
        {
          label: L.item(t('menu.saveAs'), 'A', '...'),
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction('saveAs')
        },
        { type: 'separator' },
        {
          label: L.item(t('menu.print'), 'P', '...'),
          accelerator: 'CmdOrCtrl+P',
          click: () => sendMenuAction('print')
        },
        { label: L.item(t('menu.printPreview'), 'V', '...'), click: () => sendMenuAction('printPreview') },
        {
          label: L.item(t('menu.exportPdf'), 'E', '...'),
          accelerator: 'CmdOrCtrl+F',
          click: () => sendMenuAction('exportPdf')
        },
        { type: 'separator' },
        { role: 'close', label: L.item(t('menu.close'), 'C') }
      ]
    },
    {
      label: L.top(t('menu.edit'), 'E'),
      submenu: [
        { role: 'cut', label: L.item(t('menu.cut'), 'T') },
        { role: 'copy', label: L.item(t('menu.copy'), 'C') },
        { role: 'paste', label: L.item(t('menu.paste'), 'P') },
        { type: 'separator' },
        { role: 'selectAll', label: L.item(t('menu.selectAll'), 'A') }
      ]
    },
    {
      label: L.top(t('menu.help'), 'H'),
      submenu: [
        {
          label: L.item(t('menu.helpItem'), 'H'),
          accelerator: 'F1',
          click: () => sendMenuAction('help')
        },
        { label: L.item(t('menu.agreement'), zh ? 'A' : 'U'), click: () => sendMenuAction('agreement') },
        { type: 'separator' },
        {
          label: t('menu.website'),
          click: () => shell.openExternal('https://www.tzzhy.cn/')
        },
        { label: L.item(t('menu.about'), 'A'), click: () => sendMenuAction('about') }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
