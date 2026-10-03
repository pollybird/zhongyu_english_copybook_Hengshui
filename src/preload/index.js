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

  // 系统文件关联
  getInitialFiles: () => ipcRenderer.invoke('app:get-initial-files'),
  onOpenFile: (callback) => {
    const handler = (_event, filePath) => callback(filePath)
    ipcRenderer.on('open-file', handler)
    return () => ipcRenderer.removeListener('open-file', handler)
  },

  // 窗口
  setTitle: (title) => ipcRenderer.invoke('window:set-title', title),

  // 对话框与文件读写
  openProjectDialog: () => ipcRenderer.invoke('dialog:open-project'),
  saveProjectDialog: (defaultPath) => ipcRenderer.invoke('dialog:save-project', defaultPath),
  savePdfDialog: (defaultPath) => ipcRenderer.invoke('dialog:save-pdf', defaultPath),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, bytes) => ipcRenderer.invoke('file:write', { filePath, bytes }),

  // PDF 导出 / 打印（隐藏打印窗口）
  exportPdf: (filePath, data) => ipcRenderer.invoke('pdf:export', { filePath, data }),
  printJob: (data, mode) => ipcRenderer.invoke(mode === 'preview' ? 'print:preview' : 'print:direct', data),

  // 打印渲染窗口专用通道（print.html / preview.html）
  onPrintData: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('print:data', handler)
  },
  printRendered: () => ipcRenderer.send('print:rendered'),
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
