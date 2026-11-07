import './styles.css'
import { buildPages, drawPageToCanvas, fontFamilyName } from './engine/copybook.js'
import {
  DEFAULT_SETTINGS,
  FONT_FOUNTAIN_PEN,
  FONT_GEL_PEN,
  serializeProject,
  parseProject
} from './engine/zyecb-format.js'
import { showAlert, showQuestion, showPrompt, showTextPage, setModalI18n } from './modals.js'
import { initUpdateUI, setUpdateI18n } from './update-ui.js'
import { createT, getLang, getDefaultDoc } from '../../shared/i18n.js'
import agreementZh from './assets/agreement.txt?raw'
import agreementEn from './assets/agreement.en.txt?raw'

// 界面语言：启动时从主进程取系统 locale（zh* 中文，其余英文兜底）
let lang = 'zh'
let t = (key) => key

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
  lineColor: $('inp-line-color'),
  traceColor: $('inp-trace-color'),
  fontFamily: $('inp-font-family'),
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

// 新工程默认值：line_type/generate_mode 始终为文件格式中文枚举；
// title/custom_headers 是打印在纸上的文档内容，随界面语言给默认值
function cloneDefaults() {
  const s = structuredClone(DEFAULT_SETTINGS)
  return { ...s, ...getDefaultDoc(lang) }
}

function createTab(state = null) {
  const tab = {
    id: ++tabSeq,
    state: state || cloneDefaults(),
    currentPage: 0,
    filePath: null,
    modified: false,
    selectedHeader: -1,
    // 已排版页缓存：状态变化时置空，翻页/重绘直接复用
    pages: null
  }
  tabs.push(tab)
  return tab
}

function basename(p) {
  return p.split(/[\\/]/).pop()
}

function untitledName() {
  let name = t('ui.untitled')
  let counter = 1
  while (tabs.some((tab) => tabDisplayName(tab) === name)) {
    name = `${t('ui.untitled')}${counter++}`
  }
  return name
}

function tabDisplayName(tab) {
  const name = tab.filePath ? basename(tab.filePath) : untitledNameFor(tab)
  return tab.modified ? name + '*' : name
}

// 未保存标签的固定名称（创建时确定，与原版递增逻辑一致）
function untitledNameFor(tab) {
  return tab.untitled || t('ui.untitled')
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
    close.title = t('ui.closeTab')
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
    const answer = await showQuestion(t('msg.saveQuestionTitle'), t('msg.saveQuestion'))
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
    window.api.setTitle(t('appName'))
    return
  }
  window.api.setTitle(`${t('appName')} - ${tabDisplayName(activeTab)}`)
}

// ---------------- 表单同步 ----------------
function fillForm(s) {
  syncing = true
  els.text.value = s.text_content
  els.fontSize.value = s.font_size
  els.spacing.value = s.letter_spacing
  els.posX.value = s.position_x
  els.posY.value = s.position_y
  els.lineColor.value = s.line_color
  els.traceColor.value = s.trace_color
  els.fontFamily.value = s.font_family
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

/** 预加载指定字体，保证排版度量使用的是字体本身而非回退字体 */
async function loadFont(font) {
  const family = fontFamilyName({ font_family: font })
  await Promise.all([
    document.fonts.load(`24px "${family}"`),
    document.fonts.load(`bold 24px "${family}"`)
  ])
}

function bindInputs() {
  els.text.addEventListener('input', () => {
    activeTab.state.text_content = els.text.value
    markModified()
  })

  const bindNumber = (input, key, min, max) => {
    // 输入过程中允许空值 / 负号等中间态，不回写输入框；失焦时再归一
    input.addEventListener('input', () => {
      if (syncing) return
      const raw = parseInt(input.value, 10)
      if (!Number.isFinite(raw)) return
      activeTab.state[key] = Math.min(max, Math.max(min, raw))
      markModified()
    })
    input.addEventListener('blur', () => {
      if (syncing || !activeTab) return
      const next = clampInt(input, min, max)
      if (next !== activeTab.state[key]) {
        activeTab.state[key] = next
        markModified()
      }
    })
  }
  bindNumber(els.fontSize, 'font_size', 10, 50)
  bindNumber(els.spacing, 'letter_spacing', -10, 20)
  bindNumber(els.posX, 'position_x', -50, 50)
  bindNumber(els.posY, 'position_y', -50, 50)

  // 取色器：拖动时实时预览，松开后即写入工程
  const bindColor = (input, key) => {
    input.addEventListener('input', () => {
      if (syncing || !activeTab) return
      activeTab.state[key] = input.value
      markModified()
    })
  }
  bindColor(els.lineColor, 'line_color')
  bindColor(els.traceColor, 'trace_color')

  els.fontFamily.addEventListener('change', async () => {
    if (syncing || !activeTab) return
    activeTab.state.font_family = els.fontFamily.value
    // 切换字体后先等字体就绪再重排，避免用回退字体度量导致换行错位
    await loadFont(els.fontFamily.value)
    markModified()
  })

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
  activeTab.pages = null // 内容变化，失效排版缓存
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
    await showAlert(t('msg.addFieldFailTitle'), t('msg.addFieldMax'))
    return
  }
  const name = await showPrompt(t('msg.addFieldTitle'), t('msg.addFieldLabel'))
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

// 当前标签页的排版结果（按需构建，markModified 时失效）
function pagesFor(tab) {
  if (!tab.pages) tab.pages = buildPages(tab.state)
  return tab.pages
}

function renderPreview() {
  previewQueued = false
  if (!activeTab) {
    const ctx = els.canvas.getContext('2d')
    els.canvas.width = 800
    els.canvas.height = 1131
    ctx.clearRect(0, 0, 800, 1131)
    els.pageLabel.textContent = t('ui.pageOf', { current: 0, total: 0 })
    els.prev.disabled = true
    els.next.disabled = true
    return
  }
  const pages = pagesFor(activeTab)
  const totalPages = pages.length
  if (activeTab.currentPage > totalPages - 1) {
    activeTab.currentPage = totalPages - 1
  }
  drawPageToCanvas(els.canvas, activeTab.state, activeTab.currentPage, dpr(), pages)
  els.pageLabel.textContent = t('ui.pageOf', {
    current: activeTab.currentPage + 1,
    total: totalPages
  })
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
  if (!activeTab) return
  const totalPages = pagesFor(activeTab).length
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
    if (tabs.length === 1 && !tabs[0].filePath && !tabs[0].modified) {
      target = tabs[0]
    } else {
      target = createTab()
    }
    target.state = state
    target.filePath = filePath
    target.modified = false
    target.currentPage = 0
    target.selectedHeader = -1
    target.pages = null
    activeTab = target
    fillForm(state)
    renderHeaders()
    renderTabs()
    schedulePreview()
  } catch (err) {
    await showAlert(t('msg.loadFailTitle'), t('msg.loadFail', { detail: err.message || err }))
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
    await showAlert(t('msg.saveFailTitle'), t('msg.saveFail', { detail: err.message || err }))
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
    await showAlert(t('msg.exportOkTitle'), t('msg.exportOk'))
  } catch (err) {
    await showAlert(t('msg.exportFailTitle'), t('msg.exportFail', { detail: err.message || err }))
  }
}

// 直接打印 / 打印预览（无需先导出 PDF，与导出共用同一渲染管线）
async function printJob(preview) {
  const tab = activeTab
  if (!tab) return
  try {
    await document.fonts.ready
    if (preview) {
      await window.api.printJob(tab.state, 'preview')
      return
    }
    const { ok, reason } = await window.api.printJob(tab.state, 'direct')
    // 用户在打印对话框取消时静默返回
    if (!ok && !/cancel/i.test(reason)) {
      await showAlert(
        t('msg.printFailTitle'),
        t('msg.printIncomplete', { detail: reason || t('msg.printUnknown') })
      )
    }
  } catch (err) {
    await showAlert(
      preview ? t('msg.previewFailTitle') : t('msg.printFailTitle'),
      `${err.message || err}`
    )
  }
}

// ---------------- 关闭确认 ----------------
async function canCloseAll() {
  const modified = tabs.filter((t) => t.modified)
  for (let i = modified.length - 1; i >= 0; i--) {
    const tab = modified[i]
    const answer = await showQuestion(t('msg.saveQuestionTitle'), t('msg.saveQuestion'))
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
      case 'print':
        printJob(false)
        break
      case 'printPreview':
        printJob(true)
        break
      case 'help':
        showTextPage(t('msg.helpTitle'), t('help'))
        break
      case 'agreement':
        showTextPage(t('msg.agreementTitle'), lang === 'zh' ? agreementZh : agreementEn, true)
        break
      case 'about':
        showTextPage(t('msg.aboutTitle'), t('about'))
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
    els.ocrStatus.textContent = t('msg.ocrSelecting')
    window.api.startOcrCapture()
  }

  window.api.onOcrCaptured(async (dataUrl) => {
    els.ocr.disabled = false
    if (!dataUrl) {
      els.ocrStatus.hidden = true
      return
    }
    els.ocrStatus.textContent = t('msg.ocrRecognizing')
    try {
      const text = await window.api.ocrRecognize(dataUrl, els.ocrLang.value)
      const clean = (text || '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim()
      if (!clean) {
        els.ocrStatus.hidden = true
        await showAlert(t('msg.ocrEmptyTitle'), t('msg.ocrEmpty'))
        return
      }
      // 用 setRangeText 替换全文（替代已废弃的 execCommand），并手动派发 input 事件同步状态与预览
      els.text.focus()
      els.text.select()
      els.text.setRangeText(clean, 0, els.text.value.length, 'end')
      els.text.dispatchEvent(new Event('input', { bubbles: true }))
      els.ocrStatus.textContent = t('msg.ocrDone', { n: clean.length })
      setTimeout(() => {
        els.ocrStatus.hidden = true
      }, 2500)
    } catch (err) {
      els.ocrStatus.hidden = true
      await showAlert(t('msg.ocrFailTitle'), t('msg.ocrFail', { detail: err.message || err }))
    }
  })
}

// ---------------- 静态文案应用 ----------------
function applyStaticI18n() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n)
  })
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle)
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder)
  })
}

// ---------------- 启动 ----------------
async function init() {
  // 先确定界面语言（zh* 中文，其余英文兜底）
  const locale = await window.api.getLocale()
  lang = getLang(locale)
  t = createT(locale)
  setModalI18n(t)
  setUpdateI18n(t)
  initUpdateUI()
  applyStaticI18n()

  bindInputs()
  bindOcr()
  els.newTab.onclick = () => newProject()
  els.addHeader.onclick = addHeader
  els.removeHeader.onclick = removeHeader
  els.prev.onclick = prevPage
  els.next.onclick = nextPage
  els.exportPdf.onclick = exportPdf
  bindMenu()

  // 主进程请求关闭窗口：确认未保存的标签页后回复结果
  window.api.onCloseCheckRequest(async () => {
    let allowed = false
    try {
      allowed = await canCloseAll()
    } catch (err) {
      console.error('关闭确认失败', err)
    }
    window.api.sendCloseCheckResult(allowed)
  })

  // 确保内置字体加载完成后再首次渲染
  await Promise.all([loadFont(FONT_FOUNTAIN_PEN), loadFont(FONT_GEL_PEN), document.fonts.ready])

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

init()
