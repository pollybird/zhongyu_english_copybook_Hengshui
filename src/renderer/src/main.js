import './styles.css'
import { drawPageToCanvas } from './engine/copybook.js'
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  serializeProject,
  parseProject
} from './engine/zyecb-format.js'
import { showAlert, showQuestion, showPrompt, showTextPage } from './modals.js'
import agreementText from './assets/agreement.txt?raw'

const APP_NAME = '钟毓英语衡水体字帖生成器'
const HELP_TEXT = `英文字帖生成器帮助

1. 在左侧文本框中输入要生成字帖的英文内容
2. 设置字体大小、字间距、位置偏移等参数
3. 选择线格类型（四线三格或单横线）
4. 选择生成模式（描红、抄写、描红+抄写、字帖）
5. 点击保存工程可以保存当前设置
6. 点击加载工程可以加载之前保存的设置
7. 点击导出PDF可以将字帖导出为PDF文件

快捷键：
  Ctrl+N        新建工程
  Ctrl+O        打开工程
  Ctrl+S        保存工程
  Ctrl+Shift+S  另存为
  Ctrl+F        导出PDF
  PageUp/PageDown 预览翻页`

const ABOUT_TEXT = `钟毓英语衡水体字帖生成器（Electron 版）

版本：2.0.1
作者：泰州姜堰钟毓信息技术有限公司
官网：https://www.tzzhy.cn/
功能：生成英文字帖，支持多种模式和线格类型`

// ---------------- DOM ----------------
const $ = (id) => document.getElementById(id)
const els = {
  tabs: $('tabs'),
  newTab: $('btn-new-tab'),
  text: $('inp-text'),
  fontSize: $('inp-font-size'),
  spacing: $('inp-spacing'),
  posX: $('inp-x'),
  posY: $('inp-y'),
  lineType: $('inp-line-type'),
  mode: $('inp-mode'),
  title: $('inp-title'),
  pageNumber: $('inp-page-number'),
  addHeader: $('btn-add-header'),
  removeHeader: $('btn-remove-header'),
  ocr: $('btn-ocr'),
  ocrLang: $('ocr-lang'),
  ocrStatus: $('ocr-status'),
  headerList: $('header-list'),
  prev: $('btn-prev'),
  next: $('btn-next'),
  pageLabel: $('page-label'),
  exportPdf: $('btn-export'),
  canvas: $('preview-canvas')
}

// ---------------- 标签页状态 ----------------
let tabs = []
let activeTab = null
let tabSeq = 0
let syncing = false
let previewQueued = false

function cloneDefaults() {
  return structuredClone(DEFAULT_SETTINGS)
}

function createTab(state = null) {
  const tab = {
    id: ++tabSeq,
    state: state || cloneDefaults(),
    currentPage: 0,
    filePath: null,
    modified: false,
    selectedHeader: -1
  }
  tabs.push(tab)
  return tab
}

function basename(p) {
  return p.split(/[\\/]/).pop()
}

function untitledName() {
  let name = 'Untitled'
  let counter = 1
  while (tabs.some((t) => tabDisplayName(t) === name)) {
    name = `Untitled${counter++}`
  }
  return name
}

function tabDisplayName(tab) {
  const name = tab.filePath ? basename(tab.filePath) : untitledNameFor(tab)
  return tab.modified ? name + '*' : name
}

// 未保存标签的固定名称（创建时确定，与原版递增逻辑一致）
function untitledNameFor(tab) {
  return tab.untitled || 'Untitled'
}

// ---------------- 标签栏渲染 ----------------
function renderTabs() {
  els.tabs.innerHTML = ''
  for (const tab of tabs) {
    const tabEl = document.createElement('div')
    tabEl.className = 'tab' + (tab === activeTab ? ' active' : '')

    const label = document.createElement('span')
    label.className = 'tab-label'
    label.textContent = tabDisplayName(tab)
    tabEl.appendChild(label)

    const close = document.createElement('button')
    close.className = 'tab-close'
    close.textContent = '×'
    close.title = '关闭标签'
    close.onclick = (e) => {
      e.stopPropagation()
      closeTab(tab)
    }
    tabEl.appendChild(close)

    tabEl.onclick = () => activateTab(tab)
    els.tabs.appendChild(tabEl)
  }
  syncWindowTitle()
}

function activateTab(tab) {
  if (tab === activeTab) return
  activeTab = tab
  fillForm(tab.state)
  renderHeaders()
  renderTabs()
  schedulePreview()
}

async function closeTab(tab) {
  if (tab.modified) {
    const answer = await showQuestion('保存提示', '当前工程未保存，是否保存？')
    if (answer === 'cancel') return
    if (answer === 'save') {
      if (!(await saveTab(tab))) return
    }
  }
  const idx = tabs.indexOf(tab)
  tabs.splice(idx, 1)
  if (activeTab === tab) {
    activeTab = tabs[Math.min(idx, tabs.length - 1)] || null
    if (activeTab) {
      fillForm(activeTab.state)
      renderHeaders()
    }
  }
  renderTabs()
  schedulePreview()
}

function syncWindowTitle() {
  if (!activeTab) {
    window.api.setTitle(APP_NAME)
    return
  }
  window.api.setTitle(`${APP_NAME} - ${tabDisplayName(activeTab)}`)
}

// ---------------- 表单同步 ----------------
function fillForm(s) {
  syncing = true
  els.text.value = s.text_content
  els.fontSize.value = s.font_size
  els.spacing.value = s.letter_spacing
  els.posX.value = s.position_x
  els.posY.value = s.position_y
  els.lineType.value = s.line_type
  els.mode.value = s.generate_mode
  els.title.value = s.title
  els.pageNumber.checked = s.show_page_number
  syncing = false
}

function clampInt(input, min, max) {
  let v = parseInt(input.value, 10)
  if (!Number.isFinite(v)) v = min
  v = Math.min(max, Math.max(min, v))
  input.value = v
  return v
}

function bindInputs() {
  els.text.addEventListener('input', () => {
    activeTab.state.text_content = els.text.value
    markModified()
  })

  const bindNumber = (input, key, min, max) => {
    input.addEventListener('input', () => {
      if (syncing) return
      activeTab.state[key] = clampInt(input, min, max)
      markModified()
    })
  }
  bindNumber(els.fontSize, 'font_size', 10, 50)
  bindNumber(els.spacing, 'letter_spacing', -10, 20)
  bindNumber(els.posX, 'position_x', -50, 50)
  bindNumber(els.posY, 'position_y', -50, 50)

  els.lineType.addEventListener('change', () => {
    activeTab.state.line_type = els.lineType.value
    markModified()
  })
  els.mode.addEventListener('change', () => {
    activeTab.state.generate_mode = els.mode.value
    markModified()
  })
  els.title.addEventListener('input', () => {
    activeTab.state.title = els.title.value
    markModified()
  })
  els.pageNumber.addEventListener('change', () => {
    activeTab.state.show_page_number = els.pageNumber.checked
    markModified()
  })
}

function markModified() {
  if (syncing || !activeTab) return
  activeTab.modified = true
  renderTabs()
  schedulePreview()
}

// ---------------- 头部字段 ----------------
function renderHeaders() {
  els.headerList.innerHTML = ''
  if (!activeTab) return
  activeTab.state.custom_headers.forEach((name, i) => {
    const li = document.createElement('li')
    li.textContent = name
    if (i === activeTab.selectedHeader) li.classList.add('selected')
    li.onclick = () => {
      activeTab.selectedHeader = i
      renderHeaders()
    }
    els.headerList.appendChild(li)
  })
}

async function addHeader() {
  if (activeTab.state.custom_headers.length >= 3) {
    await showAlert('添加字段失败', '自定义字段最多只能有3个！')
    return
  }
  const name = await showPrompt('添加字段', '请输入字段名称:')
  if (name) {
    activeTab.state.custom_headers.push(name)
    markModified()
    renderHeaders()
  }
}

function removeHeader() {
  const idx = activeTab.selectedHeader
  if (idx < 0) return
  activeTab.state.custom_headers.splice(idx, 1)
  activeTab.selectedHeader = -1
  markModified()
  renderHeaders()
}

// ---------------- 预览 ----------------
function dpr() {
  return Math.min(window.devicePixelRatio || 1, 2)
}

function renderPreview() {
  previewQueued = false
  if (!activeTab) {
    const ctx = els.canvas.getContext('2d')
    els.canvas.width = 800
    els.canvas.height = 1131
    ctx.clearRect(0, 0, 800, 1131)
    els.pageLabel.textContent = '第 0 页 / 共 0 页'
    els.prev.disabled = true
    els.next.disabled = true
    return
  }
  const { totalPages } = drawPageToCanvas(
    els.canvas,
    activeTab.state,
    activeTab.currentPage,
    dpr()
  )
  if (activeTab.currentPage > totalPages - 1) {
    activeTab.currentPage = totalPages - 1
    drawPageToCanvas(els.canvas, activeTab.state, activeTab.currentPage, dpr())
  }
  els.pageLabel.textContent = `第 ${activeTab.currentPage + 1} 页 / 共 ${totalPages} 页`
  els.prev.disabled = activeTab.currentPage <= 0
  els.next.disabled = activeTab.currentPage >= totalPages - 1
}

function schedulePreview() {
  if (previewQueued) return
  previewQueued = true
  requestAnimationFrame(renderPreview)
}

function prevPage() {
  if (activeTab && activeTab.currentPage > 0) {
    activeTab.currentPage--
    renderPreview()
  }
}

function nextPage() {
  const { totalPages } = drawPageToCanvas(els.canvas, activeTab.state, 99999, dpr())
  if (activeTab.currentPage < totalPages - 1) {
    activeTab.currentPage++
    renderPreview()
  }
}

// ---------------- 工程文件 ----------------
async function newProject() {
  const tab = createTab()
  tab.untitled = untitledName()
  activeTab = tab
  fillForm(tab.state)
  renderHeaders()
  renderTabs()
  schedulePreview()
}

async function openProject() {
  const filePath = await window.api.openProjectDialog()
  if (filePath) await loadFromPath(filePath)
}

async function loadFromPath(filePath) {
  try {
    const bytes = await window.api.readFile(filePath)
    const state = parseProject(bytes)

    // 与原版一致：若当前仅有一个空白标签，则在其中打开
    let target
    if (
      tabs.length === 1 &&
      !tabs[0].filePath &&
      !tabs[0].modified
    ) {
      target = tabs[0]
    } else {
      target = createTab()
    }
    target.state = state
    target.filePath = filePath
    target.modified = false
    target.currentPage = 0
    target.selectedHeader = -1
    activeTab = target
    fillForm(state)
    renderHeaders()
    renderTabs()
    schedulePreview()
  } catch (err) {
    await showAlert('加载失败', `加载工程文件失败: ${err.message || err}`)
  }
}

async function saveTab(tab, saveAs = false) {
  let filePath = saveAs ? null : tab.filePath
  if (!filePath) {
    filePath = await window.api.saveProjectDialog(tab.filePath || undefined)
    if (!filePath) return false
  }
  try {
    await window.api.writeFile(filePath, serializeProject(tab.state))
    tab.filePath = filePath
    tab.modified = false
    if (tab === activeTab) renderTabs()
    else syncWindowTitle()
    return true
  } catch (err) {
    await showAlert('保存失败', `保存工程文件失败: ${err.message || err}`)
    return false
  }
}

async function exportPdf() {
  const tab = activeTab
  if (!tab) return
  let defaultName = ''
  if (tab.filePath) {
    const base = basename(tab.filePath)
    defaultName = base.replace(/\.zyecb$/i, '')
  }
  const filePath = await window.api.savePdfDialog(defaultName || undefined)
  if (!filePath) return
  try {
    await document.fonts.ready
    await window.api.exportPdf(filePath, tab.state)
    await showAlert('导出成功', 'PDF文件导出成功！')
  } catch (err) {
    await showAlert('导出失败', `导出PDF失败: ${err.message || err}`)
  }
}

// ---------------- 关闭确认 ----------------
async function canCloseAll() {
  const modified = tabs.filter((t) => t.modified)
  for (let i = modified.length - 1; i >= 0; i--) {
    const tab = modified[i]
    const answer = await showQuestion('保存提示', '当前工程未保存，是否保存？')
    if (answer === 'cancel') return false
    if (answer === 'save') {
      if (!(await saveTab(tab))) return false
    }
  }
  return true
}

// ---------------- 菜单与快捷键 ----------------
function bindMenu() {
  window.api.onMenuAction((id) => {
    switch (id) {
      case 'new':
        newProject()
        break
      case 'open':
        openProject()
        break
      case 'save':
        if (activeTab) saveTab(activeTab)
        break
      case 'saveAs':
        if (activeTab) saveTab(activeTab, true)
        break
      case 'exportPdf':
        exportPdf()
        break
      case 'help':
        showTextPage('帮助', HELP_TEXT)
        break
      case 'agreement':
        showTextPage('用户协议', agreementText, true)
        break
      case 'about':
        showTextPage('关于', ABOUT_TEXT)
        break
    }
  })

  window.api.onOpenFile((filePath) => loadFromPath(filePath))

  document.addEventListener('keydown', (e) => {
    if (e.key === 'PageUp') {
      e.preventDefault()
      prevPage()
    } else if (e.key === 'PageDown') {
      e.preventDefault()
      nextPage()
    }
  })
}

// ---------------- 截图 OCR ----------------
function bindOcr() {
  els.ocr.onclick = () => {
    els.ocr.disabled = true
    els.ocrStatus.hidden = false
    els.ocrStatus.textContent = '请拖拽框选要识别的文字区域（Esc 取消）'
    window.api.startOcrCapture()
  }

  window.api.onOcrCaptured(async (dataUrl) => {
    els.ocr.disabled = false
    if (!dataUrl) {
      els.ocrStatus.hidden = true
      return
    }
    els.ocrStatus.textContent = '正在识别文字...'
    try {
      const text = await window.api.ocrRecognize(dataUrl, els.ocrLang.value)
      const clean = (text || '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim()
      if (!clean) {
        els.ocrStatus.hidden = true
        await showAlert('识别结果', '未识别到文字，请重试或调整识别区域。')
        return
      }
      // 通过 insertText 写入，保留原生撤销并自动触发 input 事件（同步状态与预览）
      els.text.focus()
      els.text.select()
      document.execCommand('insertText', false, clean)
      els.ocrStatus.textContent = `识别完成，已填入 ${clean.length} 个字符`
      setTimeout(() => {
        els.ocrStatus.hidden = true
      }, 2500)
    } catch (err) {
      els.ocrStatus.hidden = true
      await showAlert('识别失败', `OCR识别失败: ${err.message || err}`)
    }
  })
}

// ---------------- 启动 ----------------
async function init() {
  bindInputs()
  bindOcr()
  els.newTab.onclick = () => newProject()
  els.addHeader.onclick = addHeader
  els.removeHeader.onclick = removeHeader
  els.prev.onclick = prevPage
  els.next.onclick = nextPage
  els.exportPdf.onclick = exportPdf
  bindMenu()

  // 确保衡水体字体加载完成后再首次渲染
  await Promise.all([
    document.fonts.load('24px "HengshuiFont"'),
    document.fonts.ready
  ])

  const firstName = untitledName()
  const first = createTab()
  first.untitled = firstName
  activeTab = first
  fillForm(first.state)
  renderHeaders()
  renderTabs()
  renderPreview()

  const initialFiles = await window.api.getInitialFiles()
  if (initialFiles && initialFiles.length > 0) {
    loadFromPath(initialFiles[0])
  }
}

window.__appHooks = {
  canClose: canCloseAll
}

init()
