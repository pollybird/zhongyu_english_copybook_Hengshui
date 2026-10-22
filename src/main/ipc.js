import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join, resolve } from 'path'
import fs from 'fs/promises'

function documentsPath() {
  return app.getPath('documents')
}

/**
 * 渲染进程允许读写的文件白名单。
 * 只有经过系统对话框选择、命令行打开或文件关联传入的路径才放行，
 * 避免渲染进程被 XSS 突破后任意读写磁盘。
 */
const allowedPaths = new Set()

export function allowPath(filePath) {
  if (filePath) allowedPaths.add(resolve(filePath))
}

function assertAllowed(filePath, t) {
  if (!filePath || !allowedPaths.has(resolve(filePath))) {
    throw new Error(t('err.pathNotAllowed'))
  }
}

/** 打印/导出共用的打印参数：A4 无页边距、打印背景 */
const PRINT_OPTIONS = {
  printBackground: true,
  pageSize: 'A4',
  margins: { marginType: 'none' }
}

/**
 * 等待渲染窗口（print.html / preview.html）完成页面渲染。
 * 渲染进程成功时发 print:rendered，失败时发 print:error，两者任一到达即结束等待，
 * 避免失败后主进程空等到 30 秒超时。
 */
function waitForRender(win, t) {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(t('err.renderTimeout')))
    }, 30000)
    const onDone = (event) => {
      if (event.sender.id !== win.webContents.id) return
      cleanup()
      resolvePromise()
    }
    const onError = (event, message) => {
      if (event.sender.id !== win.webContents.id) return
      cleanup()
      reject(new Error(t('err.renderFailed', { detail: message || t('msg.printUnknown') })))
    }
    const cleanup = () => {
      clearTimeout(timer)
      ipcMain.removeListener('print:rendered', onDone)
      ipcMain.removeListener('print:error', onError)
    }
    ipcMain.on('print:rendered', onDone)
    ipcMain.on('print:error', onError)
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
  try {
    await loadRendererPage(win, 'print.html')
    win.webContents.send('print:data', data)
    await rendered
    return win
  } catch (err) {
    // 渲染失败或超时：立刻销毁隐藏窗口，避免残留
    if (!win.isDestroyed()) win.destroy()
    throw err
  }
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

  ipcMain.handle('dialog:open-project', async () => {
    const win = getMainWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: t('dlg.openTitle'),
      filters: [{ name: t('dlg.projectFilter'), extensions: ['zyecb'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    allowPath(filePaths[0])
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
    const finalPath = filePath.toLowerCase().endsWith('.zyecb') ? filePath : filePath + '.zyecb'
    allowPath(finalPath)
    return finalPath
  })

  ipcMain.handle('dialog:save-pdf', async (_event, defaultPath) => {
    const win = getMainWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: t('dlg.pdfTitle'),
      defaultPath: defaultPath || join(documentsPath(), `${t('dlg.defaultPdfName')}.pdf`),
      filters: [{ name: t('dlg.pdfFilter'), extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return null
    const finalPath = filePath.toLowerCase().endsWith('.pdf') ? filePath : filePath + '.pdf'
    allowPath(finalPath)
    return finalPath
  })

  ipcMain.handle('file:read', async (_event, filePath) => {
    assertAllowed(filePath, t)
    const buffer = await fs.readFile(filePath)
    // 以 Uint8Array 传给渲染进程，由其自行解析 pickle / json
    return new Uint8Array(buffer)
  })

  ipcMain.handle('file:write', async (_event, { filePath, bytes }) => {
    assertAllowed(filePath, t)
    await fs.writeFile(filePath, Buffer.from(bytes))
    return true
  })

  // PDF 导出：在隐藏窗口中渲染全部页面，再 printToPDF
  ipcMain.handle('pdf:export', async (_event, { filePath, data }) => {
    assertAllowed(filePath, t)
    const pdfWin = await createRenderWindow(data, t)
    try {
      const pdf = await pdfWin.webContents.printToPDF({
        landscape: false,
        ...PRINT_OPTIONS
      })
      await fs.writeFile(filePath, pdf)
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
      try {
        await rendered
      } catch (err) {
        // 渲染失败时关闭预览窗，避免留下空白窗口
        if (!previewWin.isDestroyed()) previewWin.close()
        throw err
      }
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
    try {
      await loadRendererPage(previewWin, 'preview.html')
      previewWin.webContents.send('print:data', data)
      await rendered
      // 渲染完成后再显示，避免白屏
      previewWin.show()
    } catch (err) {
      if (previewWin && !previewWin.isDestroyed()) previewWin.close()
      previewWin = null
      throw err
    }
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
    allowPath(filePath)
    pendingOpenFiles.push(filePath)
  }
}
