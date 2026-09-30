/**
 * 字帖排版与渲染引擎（由 PyQt6 版 main.py / renderers.py / utils.py 移植）
 *
 * 页面坐标系与原版完全一致：800 x 1131（96DPI 下的 A4 比例）
 * - 绘制矩形 rect = (20, 20, 760, 1091)
 * - 头部高 100，内容区 y ∈ [120, 1111)
 * - 行首 x = 30 + positionX，可写宽度 = 730
 *
 * Qt 的 QFont 字号单位是磅(pt)，96DPI 下 px = pt * 96 / 72。
 */

export const PAGE_W = 800
export const PAGE_H = 1131

const RECT_X = 20
const RECT_Y = 20
const RECT_W = 760
const RECT_BOTTOM = RECT_Y + 1091 // 1111

const HEADER_H = 100
const CONTENT_TOP = RECT_Y + HEADER_H // 120
const BOTTOM_LIMIT = RECT_BOTTOM - 100 // 1011

const GRID_COLOR = '#c0c0c0' // Qt lightGray
const TRACE_COLOR = '#ff6464' // QColor(255, 100, 100) 描红淡红色
const BLACK = '#000000'
const PAGE_NUM_COLOR = '#a0a0a0' // Qt gray

const FONT_FAMILY = '"HengshuiFont"'

const FOUR_LINE = '四线三格'
const SINGLE_LINE = '单横线'
const COPY_MODES = ['抄写', '描红+抄写']
const TRACE_MODES = ['描红', '描红+抄写']

/** 磅转像素（96DPI） */
function pt(ptSize) {
  return Math.round((ptSize * 96) / 72)
}

/** 将文本切分为单词 token，保留行首空格；'\n' 为强制换行标记（与原版一致） */
export function tokenize(text) {
  const words = []
  const lines = (text || '').split('\n')
  for (const line of lines) {
    const parts = line.split(' ')
    let leading = 0
    for (const word of parts) {
      if (!word) leading++
      else break
    }
    if (leading > 0) words.push(' '.repeat(leading))
    for (const word of parts.slice(leading)) {
      if (word) words.push(word)
    }
    words.push('\n')
  }
  return words
}

function createMeasurer(fontSizePt) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = `${pt(fontSizePt)}px ${FONT_FAMILY}`
  const cache = new Map()
  return {
    fontPx: pt(fontSizePt),
    width(char) {
      let w = cache.get(char)
      if (w === undefined) {
        w = ctx.measureText(char).width
        cache.set(char, w)
      }
      return w
    }
  }
}

function geometry(settings) {
  if (settings.line_type === FOUR_LINE) {
    return { lineHeight: 40, groupGap: 40 }
  }
  return { lineHeight: 30, groupGap: 0 }
}

/**
 * 排版单页：消费 words[start..]，返回行描述与下一个 token 下标。
 * 每行 { y, tokens: [{ text, x }], blank }
 */
function layoutPage(words, start, settings, measurer) {
  const { lineHeight, groupGap } = geometry(settings)
  const isCopyMode = COPY_MODES.includes(settings.generate_mode)

  const textLeft = RECT_X + 10 + settings.position_x
  const lineWidth = RECT_W - 30
  const right = textLeft + lineWidth
  const spaceW = measurer.width(' ') + settings.letter_spacing

  const wordWidth = (word) => {
    let w = 0
    for (const ch of word) w += measurer.width(ch) + settings.letter_spacing
    return w
  }

  let index = start
  let lineY = CONTENT_TOP + 20
  const rows = []

  while (lineY < BOTTOM_LIMIT) {
    const row = { y: lineY, tokens: [] }
    if (index < words.length) {
      let x = textLeft
      while (index < words.length) {
        const word = words[index]
        if (word === '\n') {
          index++
          break
        }
        const ww = wordWidth(word)
        if (x + ww > right && x > textLeft) break
        row.tokens.push({ text: word, x })
        x += ww + spaceW
        index++
      }
    }
    rows.push(row)
    lineY += lineHeight

    if (isCopyMode) {
      // 抄写类模式：间隔 groupGap 后绘制一条空白练习行
      lineY += groupGap
      rows.push({ y: lineY, tokens: [], blank: true })
      lineY += lineHeight + groupGap
    } else {
      lineY += groupGap
    }
  }

  return { rows, next: index }
}

/**
 * 对全部内容进行分页排版。
 * 修正了原版 utils.py 中单横线模式仍按四线三格参数估算页数导致的跨页单词重复问题；
 * 默认四线三格的分页结果与原版逐行一致。
 */
export function buildPages(settings) {
  const words = tokenize(settings.text_content)
  const measurer = createMeasurer(settings.font_size)
  const pages = []
  let index = 0
  do {
    const result = layoutPage(words, index, settings, measurer)
    pages.push(result.rows)
    index = result.next
  } while (index < words.length)
  return pages
}

function drawGrid(ctx, y, lineType) {
  ctx.strokeStyle = GRID_COLOR
  ctx.lineWidth = 1
  ctx.beginPath()
  if (lineType === FOUR_LINE) {
    for (const offset of [0, 13, 26, 39]) {
      ctx.moveTo(RECT_X, Math.round(y + offset) + 0.5)
      ctx.lineTo(RECT_X + RECT_W, Math.round(y + offset) + 0.5)
    }
  } else {
    ctx.moveTo(RECT_X, Math.round(y) + 0.5)
    ctx.lineTo(RECT_X + RECT_W, Math.round(y) + 0.5)
  }
  ctx.stroke()
}

function drawHeader(ctx, settings) {
  ctx.fillStyle = BLACK
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${pt(18)}px ${FONT_FAMILY}`
  ctx.fillText(settings.title || '', RECT_X + RECT_W / 2, RECT_Y + 25)

  const headers = settings.custom_headers || []
  if (headers.length > 0) {
    ctx.font = `${pt(12)}px ${FONT_FAMILY}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    const fieldWidth = 200
    const totalWidth = fieldWidth * headers.length
    const startX = RECT_X + Math.floor((RECT_W - totalWidth) / 2)
    const fieldY = RECT_Y + 80
    headers.forEach((header, i) => {
      ctx.fillText(`${header}: ${'_'.repeat(15)}`, startX + i * fieldWidth, fieldY)
    })
  }
}

/**
 * 在指定 ctx 上渲染一页。
 * @param {CanvasRenderingContext2D} ctx 已按 dpr 缩放的上下文
 * @param {Array} rows buildPages 返回的单页 rows
 * @param {object} settings 工程设置
 * @param {number} pageIndex 从 0 开始
 * @param {number} totalPages 总页数
 */
export function renderPage(ctx, rows, settings, pageIndex, totalPages) {
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PAGE_W, PAGE_H)

  drawHeader(ctx, settings)

  // 文字裁剪到内容区域（与原版 x 越界截断行为一致）
  ctx.beginPath()
  ctx.rect(RECT_X, CONTENT_TOP, RECT_W, RECT_BOTTOM - CONTENT_TOP - 30)
  ctx.clip()

  const textColor = TRACE_MODES.includes(settings.generate_mode) ? TRACE_COLOR : BLACK
  const isFourLine = settings.line_type === FOUR_LINE
  const yOffset = isFourLine ? settings.position_y - 4 : settings.position_y - 20

  ctx.fillStyle = textColor
  ctx.font = `${pt(settings.font_size)}px ${FONT_FAMILY}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // 复用排版时的度量，保证与换行计算完全一致
  const measurer = createMeasurer(settings.font_size)

  for (const row of rows) {
    drawGrid(ctx, row.y, settings.line_type)
    if (row.tokens.length === 0) continue

    const textY = isFourLine ? row.y + 30 + yOffset : row.y + 20 + yOffset
    for (const token of row.tokens) {
      let x = token.x
      for (const ch of token.text) {
        if (x > RECT_X + 10 + settings.position_x + (RECT_W - 30)) break
        ctx.fillText(ch, x, textY)
        x += measurer.width(ch) + settings.letter_spacing
      }
    }
  }
  ctx.restore()

  // 页码
  if (settings.show_page_number) {
    ctx.fillStyle = PAGE_NUM_COLOR
    ctx.font = `${pt(12)}px ${FONT_FAMILY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      `第 ${pageIndex + 1} 页 / 共 ${totalPages} 页`,
      RECT_X + RECT_W / 2,
      RECT_BOTTOM - 20
    )
  }
}

/** 便捷方法：排版 + 渲染某一页到 canvas */
export function drawPageToCanvas(canvas, settings, pageIndex, dpr = 1) {
  const pages = buildPages(settings)
  const total = pages.length
  const safeIndex = Math.min(Math.max(0, pageIndex), total - 1)
  canvas.width = PAGE_W * dpr
  canvas.height = PAGE_H * dpr
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  renderPage(ctx, pages[safeIndex], settings, safeIndex, total)
  return { totalPages: total, pageIndex: safeIndex }
}
