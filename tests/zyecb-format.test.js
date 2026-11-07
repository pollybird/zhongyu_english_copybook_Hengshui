import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  serializeProject,
  parseProject
} from '../src/renderer/src/engine/zyecb-format.js'

test('serializeProject → parseProject 往返保持设置', () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    text_content: 'Hello world\n第二行 \\ 反斜杠',
    font_size: 20,
    letter_spacing: 2,
    position_x: -5,
    position_y: 3,
    line_type: '单横线',
    generate_mode: '抄写',
    custom_headers: ['班级', '姓名'],
    title: '测试字帖',
    show_page_number: false,
    line_color: '#3366cc',
    trace_color: '#FFCC00'
  }
  const bytes = serializeProject(settings)
  assert.ok(bytes instanceof Uint8Array)
  // 颜色在读入时统一转小写
  assert.deepEqual(parseProject(bytes), { ...settings, trace_color: '#ffcc00' })
})

test('颜色字段：缺省回落默认，非法值回落默认，大小写归一', () => {
  const parsed = normalizeSettings({ line_color: 'red', trace_color: '#ABC', title: 'x' })
  assert.equal(parsed.line_color, DEFAULT_SETTINGS.line_color)
  // 3 位简写必须展开为 6 位：<input type="color"> 不认 #abc，会被浏览器改成 #000000
  assert.equal(parsed.trace_color, '#aabbcc')
  assert.equal(normalizeSettings({ line_color: '#8F8' }).line_color, '#88ff88')
  assert.equal(normalizeSettings({ line_color: '#112233' }).line_color, '#112233')
  const legacy = normalizeSettings({ text_content: 'abc' })
  assert.equal(legacy.line_color, '#c0c0c0')
  assert.equal(legacy.trace_color, '#ff6464')
})

test('缺失或非法字段回落到默认值', () => {
  const parsed = normalizeSettings({ line_type: '未知线格', font_size: '20' })
  assert.equal(parsed.line_type, DEFAULT_SETTINGS.line_type)
  assert.equal(parsed.font_size, DEFAULT_SETTINGS.font_size)
  assert.equal(parsed.generate_mode, DEFAULT_SETTINGS.generate_mode)
  assert.deepEqual(parsed.custom_headers, DEFAULT_SETTINGS.custom_headers)
})

test('字体字段：旧工程缺省钢笔体，中性笔体可往返保存', () => {
  assert.equal(normalizeSettings({ text_content: 'a' }).font_family, '衡水钢笔体')
  assert.equal(normalizeSettings({ font_family: '未知字体' }).font_family, '衡水钢笔体')
  const bytes = serializeProject({ ...DEFAULT_SETTINGS, font_family: '衡水中性笔体' })
  assert.equal(parseProject(bytes).font_family, '衡水中性笔体')
})

test('JSON 格式工程文件可解析', () => {
  const json = new TextEncoder().encode(JSON.stringify({ text_content: 'abc', title: 'JSON 标题' }))
  const parsed = parseProject(json)
  assert.equal(parsed.text_content, 'abc')
  assert.equal(parsed.title, 'JSON 标题')
  assert.equal(parsed.line_type, DEFAULT_SETTINGS.line_type)
})
