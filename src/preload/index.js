import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // 界面语言（系统 locale，如 zh-CN / en-US）
  getLocale: () => ipcRenderer.invoke('app:get-locale'),

  // 菜单动作
  onMenuAction: (callback) => {
    const handler = (_event, id) => callback(id)
    ipcRenderer.on('menu-action', handler)
    return () => ipcRenderer.removeListener('menu-action', handler)
  },

  // 自动更新
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  skipUpdateVersion: (version) => ipcRenderer.invoke('update:skip-version', version),
  onUpdateEvent: (callback) => {
    const channels = [
      ['update:checking', 'checking'],
      ['update:available', 'available'],
      ['update:not-available', 'not-available'],
      ['update:download-progress', 'download-progress'],
      ['update:downloaded', 'downloaded'],
      ['update:error', 'error'],
      ['update:unsupported', 'unsupported']
    ]
    const listeners = channels.map(([channel, type]) => {
      const listener = (_event, payload) => callback({ type, ...(payload || {}) })
      ipcRenderer.on(channel, listener)
      return { channel, listener }
    })
    return () => {
      listeners.forEach(({ channel, listener }) => ipcRenderer.removeListener(channel, listener))
    }
  },

  // 系统文件关联
  getInitialFiles: () => ipcRenderer.invoke('app:get-initial-files'),
  onOpenFile: (callback) => {
    const handler = (_event, filePath) => callback(filePath)
    ipcRenderer.on('open-file', handler)
    return () => ipcRenderer.removeListener('open-file', handler)
  },

  // 窗口
  setTitle: (title) => ipcRenderer.invoke('window:set-title', title),
  // 主进程请求渲染进程确认是否可关闭（有未保存工程时由渲染进程弹窗确认）
  onCloseCheckRequest: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('app:request-close-check', handler)
    return () => ipcRenderer.removeListener('app:request-close-check', handler)
  },
  sendCloseCheckResult: (allowed) => ipcRenderer.send('app:close-check-result', allowed),

  // 对话框与文件读写
  openProjectDialog: () => ipcRenderer.invoke('dialog:open-project'),
  saveProjectDialog: (defaultPath) => ipcRenderer.invoke('dialog:save-project', defaultPath),
  savePdfDialog: (defaultPath) => ipcRenderer.invoke('dialog:save-pdf', defaultPath),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, bytes) => ipcRenderer.invoke('file:write', { filePath, bytes }),

  // PDF 导出 / 打印（隐藏打印窗口）
  exportPdf: (filePath, data) => ipcRenderer.invoke('pdf:export', { filePath, data }),
  printJob: (data, mode) =>
    ipcRenderer.invoke(mode === 'preview' ? 'print:preview' : 'print:direct', data),

  // 打印渲染窗口专用通道（print.html / preview.html）
  onPrintData: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('print:data', handler)
  },
  printRendered: () => ipcRenderer.send('print:rendered'),
  printError: (message) => ipcRenderer.send('print:error', String(message || '')),
  previewPrint: () => ipcRenderer.send('print:preview-print'),

  // 截图 OCR（主窗口）
  startOcrCapture: () => ipcRenderer.send('ocr:start-capture'),
  onOcrCaptured: (callback) => {
    const handler = (_event, dataUrl) => callback(dataUrl)
    ipcRenderer.on('ocr:captured', handler)
    return () => ipcRenderer.removeListener('ocr:captured', handler)
  },
  ocrRecognize: (dataUrl, lang) => ipcRenderer.invoke('ocr:recognize', { dataUrl, lang }),

  // 截图选区窗口专用通道
  onSelInit: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('sel:init', handler)
  },
  ocrSelectConfirm: (dataUrl) => ipcRenderer.send('ocr:region-selected', dataUrl),
  ocrSelectCancel: () => ipcRenderer.send('ocr:capture-cancel')
})
