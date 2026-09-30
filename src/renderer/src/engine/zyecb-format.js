/**
 * .zyecb 工程文件格式
 *
 * 原版（PyQt6）使用 Python pickle 保存一个 dict。为了与原版双向兼容：
 *  - 写入：生成 Python pickle 协议 0（纯 ASCII 操作码），原版程序可直接打开
 *  - 读取：同时支持 pickle（协议 0~4 常见操作码子集）与 JSON
 */

export const DEFAULT_SETTINGS = Object.freeze({
  text_content: '',
  font_size: 18,
  letter_spacing: 0,
  position_x: 0,
  position_y: 0,
  line_type: '四线三格',
  generate_mode: '描红',
  custom_headers: ['班级', '姓名', '学号'],
  title: '英文字帖',
  show_page_number: true
})

export function normalizeSettings(raw = {}) {
  const d = DEFAULT_SETTINGS
  const headers = Array.isArray(raw.custom_headers)
    ? raw.custom_headers.map(String).slice(0, 3)
    : [...d.custom_headers]
  return {
    text_content: typeof raw.text_content === 'string' ? raw.text_content : d.text_content,
    font_size: numOr(raw.font_size, d.font_size),
    letter_spacing: numOr(raw.letter_spacing, d.letter_spacing),
    position_x: numOr(raw.position_x, d.position_x),
    position_y: numOr(raw.position_y, d.position_y),
    line_type: raw.line_type === '单横线' ? '单横线' : d.line_type,
    generate_mode: ['描红', '抄写', '描红+抄写', '字帖'].includes(raw.generate_mode)
      ? raw.generate_mode
      : d.generate_mode,
    custom_headers: headers,
    title: typeof raw.title === 'string' ? raw.title : d.title,
    show_page_number:
      typeof raw.show_page_number === 'boolean' ? raw.show_page_number : d.show_page_number
  }
}

function numOr(v, fallback) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/* ----------------------- pickle 协议 0 写入 ----------------------- */

/**
 * Python pickle 协议0 UNICODE(V) 字符串编码
 * 注意：V 字符串以原始换行符分隔，控制字符与反斜杠必须写成 \\uXXXX
 * （Python 用 raw-unicode-escape 解码，该编码不识别 \\n 等简写）
 */
function rawUnicodeEscape(str) {
  const bytes = []
  for (const ch of str) {
    const c = ch.codePointAt(0)
    if (c < 0x20 || c === 0x5c) {
      bytes.push(0x5c, 0x75, ...hexBytes(c, 4))
    } else if (c < 0x7f) {
      bytes.push(c)
    } else if (c < 0x100) {
      bytes.push(c) // Latin-1 原字节
    } else if (c < 0x10000) {
      bytes.push(0x5c, 0x75, ...hexBytes(c, 4))
    } else {
      bytes.push(0x5c, 0x55, ...hexBytes(c, 8))
    }
  }
  return bytes
}

function hexBytes(num, len) {
  return num
    .toString(16)
    .padStart(len, '0')
    .split('')
    .map((c) => c.charCodeAt(0))
}

function asciiBytes(str) {
  return [...str].map((c) => c.charCodeAt(0) & 0xff)
}

/** 序列化为 Python pickle 协议 0（Uint8Array） */
export function serializeProject(settings) {
  const out = []
  const emit = (value) => {
    if (typeof value === 'string') {
      out.push(0x56) // V = UNICODE
      out.push(...rawUnicodeEscape(value))
      out.push(0x0a)
    } else if (typeof value === 'boolean') {
      out.push(...asciiBytes(value ? 'I01\n' : 'I00\n'))
    } else if (Number.isInteger(value)) {
      out.push(...asciiBytes(`I${value}\n`))
    } else if (Array.isArray(value)) {
      out.push(0x28, 0x6c) // ( l ：空 list
      for (const item of value) {
        emit(item)
        out.push(0x61) // a = APPEND
      }
    } else if (value === null || value === undefined) {
      out.push(0x4e) // N = NONE
    } else {
      throw new Error('pickle 序列化不支持的类型: ' + typeof value)
    }
  }

  out.push(0x28, 0x64) // ( d ：空 dict
  for (const [key, value] of Object.entries(settings)) {
    emit(key)
    emit(value)
    out.push(0x73) // s = SETITEM
  }
  out.push(0x2e) // . = STOP
  return new Uint8Array(out)
}

/* ----------------------- pickle 读取（协议 0~4 子集） ----------------------- */

const MARK = Symbol('mark')

class Reader {
  constructor(bytes) {
    this.buf = bytes
    this.i = 0
  }
  u8() {
    return this.buf[this.i++]
  }
  take(n) {
    const s = this.buf.subarray(this.i, this.i + n)
    this.i += n
    return s
  }
  line() {
    const start = this.i
    while (this.i < this.buf.length && this.buf[this.i] !== 0x0a) this.i++
    const s = this.buf.subarray(start, this.i)
    this.i++ // 跳过换行
    return s
  }
  u16() {
    const v = this.buf[this.i] | (this.buf[this.i + 1] << 8)
    this.i += 2
    return v
  }
  i32() {
    const v =
      this.buf[this.i] |
      (this.buf[this.i + 1] << 8) |
      (this.buf[this.i + 2] << 16) |
      (this.buf[this.i + 3] << 24)
    this.i += 4
    return v
  }
}

function utf8(bytes) {
  return new TextDecoder('utf-8').decode(bytes)
}

/** Python raw_unicode_escape 解码 */
function decodeRawUnicodeEscape(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    if (b === 0x5c && i + 1 < bytes.length) {
      const e = bytes[i + 1]
      if (e === 0x75 && i + 5 < bytes.length) {
        s += String.fromCharCode(parseInt(utf8(bytes.subarray(i + 2, i + 6)), 16))
        i += 5
      } else if (e === 0x55 && i + 9 < bytes.length) {
        s += String.fromCodePoint(parseInt(utf8(bytes.subarray(i + 2, i + 10)), 16))
        i += 9
      } else if (e === 0x78 && i + 3 < bytes.length) {
        s += String.fromCharCode(parseInt(utf8(bytes.subarray(i + 2, i + 4)), 16))
        i += 3
      } else {
        const map = { 0x6e: '\n', 0x72: '\r', 0x74: '\t', 0x5c: '\\' }
        s += map[e] !== undefined ? map[e] : String.fromCharCode(e)
        i += 1
      }
    } else if (b >= 0x80) {
      s += String.fromCharCode(b) // Latin-1
    } else {
      s += String.fromCharCode(b)
    }
  }
  return s
}

function parsePickle(bytes) {
  const r = new Reader(bytes)
  const stack = []
  const memo = []

  const popToMark = () => {
    const idx = stack.lastIndexOf(MARK)
    if (idx === -1) throw new Error('pickle 解析错误：缺少 mark')
    const items = stack.splice(idx + 1)
    stack.pop() // 移除 MARK
    return items
  }

  while (r.i < bytes.length) {
    const op = r.u8()
    switch (op) {
      case 0x28: // ( MARK
        stack.push(MARK)
        break
      case 0x2e: // . STOP
        return stack.length ? stack[stack.length - 1] : null
      case 0x64: { // d DICT
        popToMark()
        stack.push({})
        break
      }
      case 0x7d: // } EMPTY_DICT
        stack.push({})
        break
      case 0x73: { // s SETITEM
        const v = stack.pop()
        const k = stack.pop()
        stack[stack.length - 1][k] = v
        break
      }
      case 0x75: { // u SETITEMS
        const items = popToMark()
        const dict = stack[stack.length - 1]
        for (let i = 0; i + 1 < items.length; i += 2) dict[items[i]] = items[i + 1]
        break
      }
      case 0x6c: // l LIST
        stack.push(popToMark())
        break
      case 0x5d: // ] EMPTY_LIST
        stack.push([])
        break
      case 0x61: { // a APPEND
        const v = stack.pop()
        stack[stack.length - 1].push(v)
        break
      }
      case 0x65: { // e APPENDS
        const items = popToMark()
        stack[stack.length - 1].push(...items)
        break
      }
      case 0x56: // V UNICODE (协议0)
        stack.push(decodeRawUnicodeEscape(r.line()))
        break
      case 0x49: // I INT
        stack.push(parseInt(utf8(r.line()), 10) || 0)
        break
      case 0x46: // F FLOAT
        stack.push(parseFloat(utf8(r.line())))
        break
      case 0x4e: // N NONE
        stack.push(null)
        break
      case 0x70: // p PUT
        memo[parseInt(utf8(r.line()), 10)] = stack[stack.length - 1]
        break
      case 0x71: // q BINPUT
        memo[r.u8()] = stack[stack.length - 1]
        break
      case 0x67: { // g GET
        const v = memo[parseInt(utf8(r.line()), 10)]
        stack.push(v)
        break
      }
      case 0x80: // PROTO
        r.u8()
        break
      case 0x95: // FRAME
        r.take(8)
        break
      case 0x94: // MEMOIZE
        memo.push(stack[stack.length - 1])
        break
      case 0x8c: // SHORT_BINUNICODE
        stack.push(utf8(r.take(r.u8())))
        break
      case 0x58: { // X BINUNICODE
        const len = r.i32()
        stack.push(utf8(r.take(len >>> 0)))
        break
      }
      case 0x4b: // K BININT1
        stack.push(r.u8())
        break
      case 0x4d: // M BININT2
        stack.push(r.u16())
        break
      case 0x4a: // J BININT4
        stack.push(r.i32())
        break
      case 0x8a: { // LONG1
        let v = r.u8()
        if (v & 0x80) v -= 0x100
        stack.push(v)
        break
      }
      case 0x88: // NEWTRUE
        stack.push(true)
        break
      case 0x89: // NEWFALSE
        stack.push(false)
        break
      default:
        throw new Error(`不支持的 pickle 操作码: 0x${op.toString(16)}`)
    }
  }
  throw new Error('pickle 解析错误：未遇到 STOP')
}

/** 读取工程文件（Uint8Array），返回规范化后的设置 */
export function parseProject(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let raw
  if (u8[0] === 0x7b) {
    // JSON 格式（兼容未来或其他工具导出的文件）
    raw = JSON.parse(new TextDecoder('utf-8').decode(u8))
  } else {
    raw = parsePickle(u8)
  }
  if (!raw || typeof raw !== 'object') throw new Error('工程文件内容无效')
  return normalizeSettings(raw)
}
