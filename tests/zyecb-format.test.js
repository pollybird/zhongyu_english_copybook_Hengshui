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
    show_page_number: false
  }
  const bytes = serializeProject(settings)
  assert.ok(bytes instanceof Uint8Array)
  assert.deepEqual(parseProject(bytes), settings)
})

test('缺失或非法字段回落到默认值', () => {
  const parsed = normalizeSettings({ line_type: '未知线格', font_size: '20' })
  assert.equal(parsed.line_type, DEFAULT_SETTINGS.line_type)
  assert.equal(parsed.font_size, DEFAULT_SETTINGS.font_size)
  assert.equal(parsed.generate_mode, DEFAULT_SETTINGS.generate_mode)
  assert.deepEqual(parsed.custom_headers, DEFAULT_SETTINGS.custom_headers)
})

test('JSON 格式工程文件可解析', () => {
  const json = new TextEncoder().encode(
    JSON.stringify({ text_content: 'abc', title: 'JSON 标题' })
  )
  const parsed = parseProject(json)
  assert.equal(parsed.text_content, 'abc')
  assert.equal(parsed.title, 'JSON 标题')
  assert.equal(parsed.line_type, DEFAULT_SETTINGS.line_type)
})
