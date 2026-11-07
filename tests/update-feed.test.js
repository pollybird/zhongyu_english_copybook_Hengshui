import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_ENDPOINTS,
  getFeedFileName,
  prefersGitCodeFirst,
  probeUrl,
  resolveFeedUrl
} from '../src/main/update-feed.js'

function response({ status = 200, contentType = 'application/octet-stream', json } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => (typeof json === 'function' ? json() : json)
  }
}

test('更新清单文件名按平台区分', () => {
  assert.equal(getFeedFileName('win32'), 'latest.yml')
  assert.equal(getFeedFileName('linux'), 'latest-linux.yml')
  assert.equal(getFeedFileName('darwin'), 'latest-mac.yml')
})

test('仅简体中文优先 GitCode', () => {
  assert.equal(prefersGitCodeFirst('zh-CN'), true)
  assert.equal(prefersGitCodeFirst('zh-Hans-CN'), true)
  assert.equal(prefersGitCodeFirst('zh-TW'), false)
  assert.equal(prefersGitCodeFirst('en-US'), false)
  assert.equal(prefersGitCodeFirst(''), false)
})

test('探测时会排除 HTML 错误页', async () => {
  assert.equal(
    await probeUrl('https://example.com/latest.yml', async () =>
      response({ contentType: 'text/html; charset=utf-8' })
    ),
    false
  )
  assert.equal(await probeUrl('https://example.com/latest.yml', async () => response({})), true)
})

test('英文环境优先 GitHub，失败后回退 GitCode', async () => {
  const requested = []
  const fetchImpl = async (url) => {
    requested.push(url)
    if (url.startsWith(DEFAULT_ENDPOINTS.githubBase)) return response({ status: 404 })
    if (url === DEFAULT_ENDPOINTS.gitcodeApiLatest) {
      return response({ json: async () => ({ tag_name: '2.0.7' }) })
    }
    return response({})
  }
  const base = await resolveFeedUrl({ feedFile: 'latest.yml', fetchImpl })
  assert.equal(base, `${DEFAULT_ENDPOINTS.gitcodeDownloadBase}2.0.7/`)
  assert.ok(requested[0].startsWith(DEFAULT_ENDPOINTS.githubBase))
})

test('简中环境优先 GitCode', async () => {
  const fetchImpl = async (url) => {
    if (url === DEFAULT_ENDPOINTS.gitcodeApiLatest) {
      return response({ json: async () => ({ tag_name: '2.0.7' }) })
    }
    return response({})
  }
  const base = await resolveFeedUrl({ feedFile: 'latest.yml', fetchImpl, gitCodeFirst: true })
  assert.equal(base, `${DEFAULT_ENDPOINTS.gitcodeDownloadBase}2.0.7/`)
})

test('主源不可用且排除后不再重试，两个源都失败返回 null', async () => {
  const fetchImpl = async () => response({ status: 500 })
  const base = await resolveFeedUrl({
    feedFile: 'latest.yml',
    fetchImpl,
    excludeBase: DEFAULT_ENDPOINTS.githubBase
  })
  assert.equal(base, null)
})
