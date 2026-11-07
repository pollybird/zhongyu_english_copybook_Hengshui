#!/usr/bin/env node
/**
 * 将 dist/ 下的发行产物上传到 GitCode Release（GitHub Release 的国内镜像）。
 *
 * 背景：GitCode 附件不支持 API 删除/同名覆盖（OBS 回调 400/405），
 * 因此本脚本只做「创建 Release（若缺失）+ 跳过已存在附件 + 上传新附件」，
 * 不会尝试替换。发布前请确认代码与产物已定稿。
 *
 * 用法：
 *   GITCODE_TOKEN=xxx node scripts/publish-gitcode.mjs
 *
 * 环境变量：
 *   GITCODE_TOKEN      必填，GitCode 私人令牌
 *   GITCODE_OWNER      默认 pollybird
 *   GITCODE_REPO       默认 zhongyu_english_copybook_Hengshui
 *   GITCODE_TAG        默认 package.json 的 version（本仓库 tag 不带 v 前缀）
 *   DIST_DIR           默认 dist
 *   GITCODE_NOTES_FILE 可选，创建 Release 时使用的发布说明文件（UTF-8）
 *   GITCODE_TARGET     可选，tag 不存在时创建 Release 用的 target_commitish
 */
import { createReadStream, readFileSync, readdirSync, statSync } from 'node:fs'
import { request as httpsRequest } from 'node:https'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const token = process.env.GITCODE_TOKEN
if (!token) {
  console.error('GITCODE_TOKEN 未设置')
  process.exit(1)
}

const owner = process.env.GITCODE_OWNER ?? 'pollybird'
const repo = process.env.GITCODE_REPO ?? 'zhongyu_english_copybook_Hengshui'
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
const tag = process.env.GITCODE_TAG ?? pkg.version
const distDir = process.env.DIST_DIR ?? join(root, 'dist')
const notesFile = process.env.GITCODE_NOTES_FILE
const targetCommitish = process.env.GITCODE_TARGET

const apiBase = `https://api.gitcode.com/api/v5/repos/${owner}/${repo}`
const authHeaders = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/json'
}

async function apiJson(path, init = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { ...authHeaders, ...(init.headers ?? {}) }
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(
      `GitCode API ${init.method ?? 'GET'} ${path} -> ${res.status}: ${text.slice(0, 300)}`
    )
  }
  return text ? JSON.parse(text) : null
}

/** 需要上传的发行产物（源码包由 GitCode 自动生成，不传） */
function collectReleaseFiles() {
  const yml = new Set([
    'latest.yml',
    'latest-linux.yml',
    'latest-linux-arm64.yml',
    'latest-mac.yml',
    'latest-mac-arm64.yml'
  ])
  const binExts = new Set(['.appimage', '.deb', '.rpm', '.exe', '.zip', '.blockmap'])
  // 先传安装包、最后传清单：上传中断时不会出现「清单已发布但安装包缺失」的坏状态
  return readdirSync(distDir)
    .filter((name) => yml.has(name) || binExts.has(extname(name).toLowerCase()))
    .sort((a, b) => Number(yml.has(a)) - Number(yml.has(b)) || a.localeCompare(b))
}

function defaultNotes() {
  return [
    `钟毓英语衡水体字帖生成器 ${tag}`,
    '',
    `GitHub Release：https://github.com/${owner}/${repo}/releases/tag/${tag}`,
    '',
    '安装包见下方附件；简中环境自动更新默认从 GitCode 下载，英文环境从 GitHub 下载。'
  ].join('\n')
}

/** 获取 Release；不存在时按需创建。返回 Release 对象 */
async function ensureRelease() {
  try {
    const release = await apiJson(`/releases/tags/${encodeURIComponent(tag)}`)
    console.log(`Release ${tag} 已存在（${release.assets?.length ?? 0} 个资源）`)
    return release
  } catch (err) {
    if (!String(err.message).includes('404')) throw err
  }
  const body = {
    tag_name: tag,
    name: tag,
    body: notesFile ? readFileSync(notesFile, 'utf-8') : defaultNotes(),
    prerelease: false,
    ...(targetCommitish ? { target_commitish: targetCommitish } : {})
  }
  const created = await apiJson('/releases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  console.log(`已创建 Release ${tag}`)
  return created
}

/** 已存在的附件名（type=source 的是平台源码归档，不计） */
function existingAttachmentNames(release) {
  return new Set(
    (release.assets ?? [])
      .filter((a) => a.type !== 'source')
      .map((a) => a.name)
      .filter(Boolean)
  )
}

/**
 * 以流式 HTTPS PUT 上传单个文件。
 *
 * 不用 fetch：GitHub Runner 跨境上传大安装包往往超过 undici 默认的 300 秒
 * 响应头超时（HeadersTimeoutError），这里改用无超时的原生请求，并显式带上
 * Content-Length，避免 chunked 传输被对象存储拒绝。
 */
function putFile(url, headers, filePath) {
  return new Promise((resolve, reject) => {
    const size = statSync(filePath).size
    const target = new URL(url)
    const req = httpsRequest(
      {
        method: 'PUT',
        hostname: target.hostname,
        path: target.pathname + target.search,
        headers: { ...headers, 'Content-Length': size },
        // 只限制「连接空闲」时长，不限制总上传时长（大安装包跨境上传可能很慢）
        timeout: 10 * 60 * 1000
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () => resolve({ status: res.statusCode, body }))
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('上传连接空闲超时')))
    const stream = createReadStream(filePath)
    stream.on('error', (err) => {
      req.destroy(err)
      reject(err)
    })
    stream.pipe(req)
  })
}

/** 取 OBS 预签名地址并上传单个文件 */
async function uploadOne(fileName) {
  const filePath = join(distDir, fileName)
  const size = statSync(filePath).size
  const info = await apiJson(
    `/releases/${encodeURIComponent(tag)}/upload_url?file_name=${encodeURIComponent(fileName)}`
  )
  if (!info?.url || !info?.headers) {
    throw new Error(`upload_url 响应缺少 url/headers: ${JSON.stringify(info).slice(0, 300)}`)
  }
  console.log(`  … ${fileName} (${(size / 1024 / 1024).toFixed(1)} MB) 上传中`)
  const res = await putFile(info.url, info.headers, filePath)
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`OBS PUT ${fileName} -> ${res.status}: ${String(res.body).slice(0, 300)}`)
  }
  console.log(`  ✓ ${fileName} (${(size / 1024 / 1024).toFixed(1)} MB) -> ${res.body}`)
}

async function main() {
  console.log(`目标：${owner}/${repo} @ ${tag}`)
  const files = collectReleaseFiles()
  if (!files.length) {
    console.error(`在 ${distDir} 未找到可上传的发行产物`)
    process.exit(1)
  }
  console.log(`待上传 ${files.length} 个文件：${files.join(', ')}`)

  const release = await ensureRelease()
  const existing = existingAttachmentNames(release)

  let uploaded = 0
  for (const fileName of files) {
    if (existing.has(fileName)) {
      console.log(`  - 跳过已存在附件（GitCode 不支持覆盖）：${fileName}`)
      continue
    }
    for (let attempt = 1; ; attempt += 1) {
      try {
        await uploadOne(fileName)
        uploaded += 1
        break
      } catch (err) {
        if (attempt >= 3) throw err
        console.warn(`  ! ${fileName} 上传失败（第 ${attempt} 次）：${err.message}，稍后重试`)
        await new Promise((resolve) => setTimeout(resolve, 5000 * attempt))
      }
    }
  }
  console.log(`完成：新上传 ${uploaded} 个，跳过 ${files.length - uploaded} 个`)
}

main().catch((err) => {
  console.error('发布失败：', err)
  process.exit(1)
})
