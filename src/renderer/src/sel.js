import './sel.css'
import { createT, getLang } from '../../shared/i18n.js'

// 界面语言随系统（zh* 中文，其余英文）
window.api.getLocale().then((locale) => {
  const lang = getLang(locale)
  const t = createT(locale)
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  document.title = t('sel.title')
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n)
  })
})

const frozen = document.getElementById('frozen')
const overlay = document.getElementById('overlay')
const hint = document.getElementById('hint')
const ctx = overlay.getContext('2d')

let rect = null // {x, y, w, h} 当前选区（窗口 CSS 像素）
let dragging = false
let moved = false // 是否已拖拽出有效选区（区分点击与拖拽）
let start = null
let confirmed = false

function resizeOverlay() {
  overlay.width = window.innerWidth
  overlay.height = window.innerHeight
  draw()
}

function draw() {
  const w = overlay.width
  const h = overlay.height
  ctx.clearRect(0, 0, w, h)
  // 半透明遮罩挖空选区
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  if (rect) {
    const { x, y, width, height } = normRect()
    ctx.beginPath()
    ctx.rect(0, 0, w, h)
    ctx.rect(x, y, width, height)
    ctx.fill('evenodd')
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1.5
    ctx.strokeRect(x, y, width, height)
    ctx.fillStyle = '#ffffff'
    ctx.font = '12px sans-serif'
    ctx.fillText(`${Math.round(width)} x ${Math.round(height)}`, x + 4, Math.max(y - 6, 14))
  } else {
    ctx.fillRect(0, 0, w, h)
  }
}

function normRect() {
  const x = Math.min(start.x, rect.x)
  const y = Math.min(start.y, rect.y)
  return { x, y, width: Math.abs(rect.x - start.x), height: Math.abs(rect.y - start.y) }
}

// 判断点是否落在当前选区内（基于已归一化的选区）
function pointInRect(p) {
  if (!rect || !start) return false
  const r = normRect()
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
}

function pos(e) {
  return { x: e.clientX, y: e.clientY }
}

window.addEventListener('resize', resizeOverlay)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    cancel()
  } else if (e.key === 'Enter' && rect) {
    e.preventDefault()
    confirm()
  }
})

overlay.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return
  const p = pos(e)
  // 若点击落在已有选区内：不重置选区（保留双击确认），仅记录起始点
  if (rect && pointInRect(p)) {
    dragging = false
    moved = false
    start = p
    return
  }
  dragging = true
  moved = false
  start = p
  rect = start
  hint.style.display = 'none'
  draw()
})

overlay.addEventListener('mousemove', (e) => {
  if (!dragging) return
  rect = pos(e)
  const r = normRect()
  if (r.width >= 8 || r.height >= 8) moved = true
  draw()
})

overlay.addEventListener('mouseup', () => {
  if (!dragging) return
  dragging = false
  // 未拖拽出有效选区视为普通点击，清空选区但保留双击确认的机会
  if (!moved) {
    rect = null
    hint.style.display = ''
  }
  draw()
})

overlay.addEventListener('dblclick', () => {
  // 双击确认：已有选区时直接用；单击未形成选区时双击无效
  if (rect) confirm()
})

function cancel() {
  if (confirmed) return
  confirmed = true
  window.api.ocrSelectCancel()
}

function confirm() {
  if (confirmed || !rect) return
  confirmed = true
  const r = normRect()
  const sx = frozen.naturalWidth / window.innerWidth
  const sy = frozen.naturalHeight / window.innerHeight
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(r.width * sx))
  canvas.height = Math.max(1, Math.round(r.height * sy))
  canvas
    .getContext('2d')
    .drawImage(
      frozen,
      Math.round(r.x * sx),
      Math.round(r.y * sy),
      Math.round(r.width * sx),
      Math.round(r.height * sy),
      0,
      0,
      canvas.width,
      canvas.height
    )
  window.api.ocrSelectConfirm(canvas.toDataURL('image/png'))
}

window.api.onSelInit(({ dataUrl }) => {
  frozen.onload = () => resizeOverlay()
  frozen.src = dataUrl
})

resizeOverlay()
