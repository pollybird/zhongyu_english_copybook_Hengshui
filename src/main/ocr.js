import { ipcMain, desktopCapturer, screen, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { tmpdir } from 'os'

let getMainWindow = null
let selWindows = []
const ocrWorkers = new Map()
let translator = (key) => key

// 懒加载 tesseract.js，避免打包后主进程启动时模块初始化失败导致应用无法打开
let createWorker = null
async function getCreateWorker() {
  if (!createWorker) {
    const tesseract = await import('tesseract.js')
    createWorker = tesseract.createWorker
  }
  return createWorker
}

// 语言数据目录：dev 为项目 resources，打包后在系统资源目录
function resolveOcrDataDir() {
  return app.isPackaged
    ? join(process.resourcesPath, 'ocr-data')
    : join(process.cwd(), 'resources', 'ocr-data')
}

export function registerOcr(getWin, resolvePreload, t) {
  translator = t
  getMainWindow = getWin
  ipcMain.on('ocr:start-capture', () => startCapture(resolvePreload))
  ipcMain.on('ocr:region-selected', (_e, dataUrl) => finishSelection(dataUrl))
  ipcMain.on('ocr:capture-cancel', () => cancelSelection())
  ipcMain.handle('ocr:recognize', (_e, { dataUrl, lang }) => recognize(dataUrl, lang))
}

function showMain() {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.show()
    win.focus()
  }
}

function closeSelWindows() {
  for (const w of selWindows) {
    if (!w.isDestroyed()) w.close()
  }
  selWindows = []
}

// 开始截图：隐藏主窗口 → 冻结各屏幕画面 → 每个显示器打开一个全屏选区窗口
async function startCapture(resolvePreload) {
  const main = getMainWindow()
  if (!main || selWindows.length) return
  main.hide()
  await new Promise((r) => setTimeout(r, 300))

  try {
    const displays = screen.getAllDisplays()
    const maxScale = Math.max(...displays.map((d) => d.scaleFactor))
    const thumbSize = {
      width: Math.round(Math.max(...displays.map((d) => d.size.width)) * maxScale),
      height: Math.round(Math.max(...displays.map((d) => d.size.height)) * maxScale)
    }
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: thumbSize })
    if (!sources.length) throw new Error(translator('err.captureFailed'))

    for (const display of displays) {
      const source =
        sources.find((s) => s.display_id === String(display.id)) || sources[0]
      if (!source) break

      const win = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.size.width,
        height: display.size.height,
        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        enableLargerThanScreen: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        show: false,
        backgroundColor: '#000000',
        webPreferences: {
          preload: resolvePreload(),
          sandbox: false
        }
      })
      win.setMenu(null)
      win.once('ready-to-show', () => {
        win.show()
        win.focus()
      })
      win.on('closed', () => {
        selWindows = selWindows.filter((w) => w !== win)
      })

      const url = process.env.ELECTRON_RENDERER_URL
      if (url) {
        await win.loadURL(`${url}/sel.html`)
      } else {
        await win.loadFile(join(__dirname, '../renderer/sel.html'))
      }
      win.webContents.send('sel:init', {
        dataUrl: source.thumbnail.toDataURL()
      })
      selWindows.push(win)
    }
    if (!selWindows.length) {
      showMain()
    }
  } catch (err) {
    showMain()
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('ocr:captured', null)
    }
  }
}

function finishSelection(dataUrl) {
  closeSelWindows()
  showMain()
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('ocr:captured', dataUrl || null)
  }
}

function cancelSelection() {
  closeSelWindows()
  showMain()
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('ocr:captured', null)
  }
}

// tesseract.js worker 按语言缓存（本地语言数据，离线可用）
async function getWorker(lang) {
  if (ocrWorkers.has(lang)) return ocrWorkers.get(lang)
  const _createWorker = await getCreateWorker()
  const worker = await _createWorker(lang, 1, {
    langPath: resolveOcrDataDir(),
    cachePath: tmpdir(),
    logger: () => {}
  })
  ocrWorkers.set(lang, worker)
  return worker
}

async function recognize(dataUrl, lang) {
  const base64 = String(dataUrl).split(',')[1]
  if (!base64) throw new Error(translator('err.invalidImage'))
  const buffer = Buffer.from(base64, 'base64')
  const worker = await getWorker(lang || 'eng')
  const { data } = await worker.recognize(buffer)
  return data.text
}
