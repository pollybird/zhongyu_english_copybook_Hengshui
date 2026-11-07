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

const { tokenize, buildPages, fontFamilyName } =
  await import('../src/renderer/src/engine/copybook.js')
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

test('字体令牌映射到对应的 CSS 字体族，未知值回落钢笔体', () => {
  assert.equal(fontFamilyName({ font_family: '衡水钢笔体' }), 'HengshuiFountainPen')
  assert.equal(fontFamilyName({ font_family: '衡水中性笔体' }), 'HengshuiGelPen')
  assert.equal(fontFamilyName({ font_family: '其他' }), 'HengshuiFountainPen')
  assert.equal(fontFamilyName({}), 'HengshuiFountainPen')
})
