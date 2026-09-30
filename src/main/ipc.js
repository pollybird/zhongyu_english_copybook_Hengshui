import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import fs from 'fs'

const ZYECB_FILTER = [{ name: '字帖工程文件', extensions: ['zyecb'] }]
const PDF_FILTER = [{ name: 'PDF文件', extensions: ['pdf'] }]

function documentsPath() {
  return app.getPath('documents')
}

/**
 * 注册主进程 IPC 处理器
 * @param {() => BrowserWindow} getMainWindow
 */
export function registerIpc(getMainWindow) {
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
      title: '加载工程',
      filters: ZYECB_FILTER,
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })

  ipcMain.handle('dialog:save-project', async (_event, defaultPath) => {
    const win = getMainWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '保存工程',
      defaultPath: defaultPath || join(documentsPath(), 'Untitled.zyecb'),
      filters: ZYECB_FILTER
    })
    if (canceled || !filePath) return null
    return filePath.endsWith('.zyecb') ? filePath : filePath + '.zyecb'
  })

  ipcMain.handle('dialog:save-pdf', async (_event, defaultPath) => {
    const win = getMainWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '导出PDF',
      defaultPath: defaultPath || join(documentsPath(), '英文字帖.pdf'),
      filters: PDF_FILTER
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
    const pdfWin = new BrowserWindow({
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

    const rendered = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error('PDF 渲染超时'))
      }, 30000)
      const onRendered = (event) => {
        if (event.sender.id !== pdfWin.webContents.id) return
        cleanup()
        resolve()
      }
      const cleanup = () => {
        clearTimeout(timer)
        ipcMain.removeListener('pdf:rendered', onRendered)
      }
      ipcMain.on('pdf:rendered', onRendered)
    })

    const rendererUrl = process.env.ELECTRON_RENDERER_URL
    if (rendererUrl) {
      await pdfWin.loadURL(rendererUrl + '/print.html')
    } else {
      await pdfWin.loadFile(join(__dirname, '../renderer/print.html'))
    }

    pdfWin.webContents.send('pdf:data', data)
    await rendered

    const pdf = await pdfWin.webContents.printToPDF({
      pageSize: 'A4',
      marginsType: 1,
      printBackground: true,
      landscape: false
    })
    fs.writeFileSync(filePath, pdf)
    pdfWin.close()
    return true
  })
}

// 通过命令行 / 系统文件关联传入、等待渲染进程接收的工程文件
export const pendingOpenFiles = []

export function queueOpenFile(filePath) {
  if (filePath && filePath.toLowerCase().endsWith('.zyecb')) {
    pendingOpenFiles.push(filePath)
  }
}
