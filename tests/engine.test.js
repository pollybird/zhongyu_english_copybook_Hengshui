import test from 'node:test'
import assert from 'node:assert/strict'

// 引擎依赖 Canvas 测量文字宽度，这里用等宽假实现替代
globalThis.document = {
  createElement: () => ({
    getContext: () => ({
      font: '',
      measureText: (text) => ({ width: Array.from(text).length * 10 })
    })
  })
}

const { tokenize, buildPages } = await import('../src/renderer/src/engine/copybook.js')
const { DEFAULT_SETTINGS } = await import('../src/renderer/src/engine/zyecb-format.js')

function tokensOf(pages) {
  return pages.flatMap((rows) => rows.flatMap((row) => row.tokens.map((tk) => tk.text)))
}

test('tokenize 逐词切分并保留换行标记', () => {
  assert.deepEqual(tokenize('a b\nc'), ['a', 'b', '\n', 'c', '\n'])
})

test('排版既不多词也不漏词（四线三格）', () => {
  const text = '第一行词语\n第二个 line of words\n\n结尾'
  const pages = buildPages({ ...DEFAULT_SETTINGS, text_content: text })
  assert.ok(pages.length >= 1)
  const expected = tokenize(text).filter((token) => token !== '\n')
  const actual = tokensOf(pages).filter((token) => token !== '\n')
  assert.deepEqual(actual, expected)
})

test('排版既不多词也不漏词（单横线）', () => {
  const text = Array.from({ length: 80 }, (_, i) => `word${i}`).join('\n')
  const pages = buildPages({
    ...DEFAULT_SETTINGS,
    text_content: text,
    line_type: '单横线'
  })
  assert.ok(pages.length >= 1)
  const expected = tokenize(text).filter((token) => token !== '\n')
  const actual = tokensOf(pages).filter((token) => token !== '\n')
  assert.deepEqual(actual, expected)
})

test('空白文案也能得到至少一页', () => {
  const pages = buildPages({ ...DEFAULT_SETTINGS, text_content: '   \n\n  ' })
  assert.equal(pages.length, 1)
})
