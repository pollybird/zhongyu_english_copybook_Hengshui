import './sel.css'

const frozen = document.getElementById('frozen')
const overlay = document.getElementById('overlay')
const hint = document.getElementById('hint')
const ctx = overlay.getContext('2d')

let rect = null // {x, y, w, h} 当前选区（窗口 CSS 像素）
let dragging = false
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
  dragging = true
  start = pos(e)
  rect = start
  hint.style.display = 'none'
  draw()
})

overlay.addEventListener('mousemove', (e) => {
  if (!dragging) return
  rect = pos(e)
  draw()
})

overlay.addEventListener('mouseup', () => {
  if (!dragging) return
  dragging = false
  const r = normRect()
  if (r.width < 8 || r.height < 8) {
    rect = null
    hint.style.display = ''
  }
  draw()
})

overlay.addEventListener('dblclick', () => {
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
