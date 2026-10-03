import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import fs from 'fs'

function documentsPath() {
  return app.getPath('documents')
}

/** 打印/导出共用的打印参数：A4 无页边距、打印背景 */
const PRINT_OPTIONS = {
  printBackground: true,
  pageSize: 'A4',
  margins: { marginType: 'none' }
}

/**
 * 等待渲染窗口（print.html / preview.html）完成页面渲染
 */
function waitForRender(win, t) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(t('err.renderTimeout')))
    }, 30000)
    const onRendered = (event) => {
      if (event.sender.id !== win.webContents.id) return
      cleanup()
      resolve()
    }
    const cleanup = () => {
      clearTimeout(timer)
      ipcMain.removeListener('print:rendered', onRendered)
    }
    ipcMain.on('print:rendered', onRendered)
  })
}

/** 加载渲染页（dev 走 dev server，打包走文件） */
function loadRendererPage(win, page) {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) return win.loadURL(`${rendererUrl}/${page}`)
  return win.loadFile(join(__dirname, '../renderer', page))
}

/**
 * 创建隐藏窗口渲染全部字帖页面（PDF 导出与直接打印共用），渲染完成后返回窗口
 */
async function createRenderWindow(data, t) {
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  const rendered = waitForRender(win, t)
  await loadRendererPage(win, 'print.html')
  win.webContents.send('print:data', data)
  await rendered
  return win
}

/**
 * 注册主进程 IPC 处理器
 * @param {() => BrowserWindow} getMainWindow
 * @param {() => Electron.NativeImage} resolveIcon
 * @param {(key: string, vars?: object) => string} t 国际化翻译函数
 */
export function registerIpc(getMainWindow, resolveIcon, t) {
  // 打印预览窗口（单例）
  let previewWin = null
  // 渲染进程启动完毕，取走待打开的工程文件
  ipcMain.handle('app:get-initial-files', () => {
    const files = pendingOpenFiles.splice(0)
    return files
  })

  ipcMain.handle('window:set-title', (_event, title) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) win.setTitle(title)
  })

  // 关闭窗口前由渲染进程检查未保存的标签页
  ipcMain.handle('app:check-close', async () => {
    const win = getMainWindow()
    if (!win) return true
    const result = await win.webContents.executeJavaScript(
      `window.__appHooks && window.__appHooks.canClose ? window.__appHooks.canClose() : true`
    )
    return Boolean(result)
  })

  ipcMain.handle('dialog:open-project', async () => {
    const win = getMainWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: t('dlg.openTitle'),
      filters: [{ name: t('dlg.projectFilter'), extensions: ['zyecb'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })

  ipcMain.handle('dialog:save-project', async (_event, defaultPath) => {
    const win = getMainWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: t('dlg.saveTitle'),
      defaultPath: defaultPath || join(documentsPath(), 'Untitled.zyecb'),
      filters: [{ name: t('dlg.projectFilter'), extensions: ['zyecb'] }]
    })
    if (canceled || !filePath) return null
    return filePath.endsWith('.zyecb') ? filePath : filePath + '.zyecb'
  })

  ipcMain.handle('dialog:save-pdf', async (_event, defaultPath) => {
    const win = getMainWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: t('dlg.pdfTitle'),
      defaultPath: defaultPath || join(documentsPath(), `${t('dlg.defaultPdfName')}.pdf`),
      filters: [{ name: t('dlg.pdfFilter'), extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return null
    return filePath.endsWith('.pdf') ? filePath : filePath + '.pdf'
  })

  ipcMain.handle('file:read', async (_event, filePath) => {
    const buffer = fs.readFileSync(filePath)
    // 以 Uint8Array 传给渲染进程，由其自行解析 pickle / json
    return new Uint8Array(buffer)
  })

  ipcMain.handle('file:write', async (_event, { filePath, bytes }) => {
    const buffer = Buffer.from(bytes)
    fs.writeFileSync(filePath, buffer)
    return true
  })

  // PDF 导出：在隐藏窗口中渲染全部页面，再 printToPDF
  ipcMain.handle('pdf:export', async (_event, { filePath, data }) => {
    const pdfWin = await createRenderWindow(data, t)
    try {
      const pdf = await pdfWin.webContents.printToPDF({
        landscape: false,
        ...PRINT_OPTIONS
      })
      fs.writeFileSync(filePath, pdf)
    } finally {
      pdfWin.close()
    }
    return true
  })

  // 直接打印：隐藏窗口渲染全部页面后弹出系统打印对话框
  ipcMain.handle('print:direct', async (_event, data) => {
    const win = await createRenderWindow(data, t)
    return new Promise((resolve) => {
      win.webContents.print({ silent: false, ...PRINT_OPTIONS }, (success, failureReason) => {
        win.close()
        resolve({ ok: Boolean(success), reason: failureReason || '' })
      })
    })
  })

  // 打印预览：打开预览窗口渲染全部页面（单例，重复调用则刷新数据并聚焦）
  ipcMain.handle('print:preview', async (_event, data) => {
    if (previewWin && !previewWin.isDestroyed()) {
      previewWin.focus()
      const rendered = waitForRender(previewWin, t)
      previewWin.webContents.send('print:data', data)
      await rendered
      return true
    }
    previewWin = new BrowserWindow({
      width: 1000,
      height: 840,
      minWidth: 760,
      minHeight: 600,
      show: false,
      title: t('preview.title'),
      icon: resolveIcon ? resolveIcon() : undefined,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })
    previewWin.on('closed', () => {
      previewWin = null
    })
    // 预览窗口不需要应用菜单（macOS 菜单在顶部栏，无需处理）
    if (process.platform !== 'darwin') previewWin.setMenu(null)
    const rendered = waitForRender(previewWin, t)
    await loadRendererPage(previewWin, 'preview.html')
    previewWin.webContents.send('print:data', data)
    await rendered
    // 渲染完成后再显示，避免白屏
    previewWin.show()
    return true
  })

  // 预览窗口内点击"打印"：弹出系统打印对话框（完成后保留预览窗口）
  ipcMain.on('print:preview-print', () => {
    if (!previewWin || previewWin.isDestroyed()) return
    previewWin.webContents.print({ silent: false, ...PRINT_OPTIONS }, () => {})
  })
}

// 通过命令行 / 系统文件关联传入、等待渲染进程接收的工程文件
export const pendingOpenFiles = []

export function queueOpenFile(filePath) {
  if (filePath && filePath.toLowerCase().endsWith('.zyecb')) {
    pendingOpenFiles.push(filePath)
  }
}
