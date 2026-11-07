/**
 * 更新源探测（纯网络逻辑，不依赖 electron，可注入 fetch 单测）
 *
 * 策略：默认 GitHub Releases 为主、GitCode Release 附件为回退；
 * 简体中文系统（zh-CN / zh-Hans*）反过来 GitCode 优先、GitHub 回退。
 * 两个平台都需上传安装包与 latest*.yml（yml 内文件名为相对路径）。
 */

export const DEFAULT_ENDPOINTS = {
  githubBase:
    'https://github.com/pollybird/zhongyu_english_copybook_Hengshui/releases/latest/download/',
  gitcodeApiLatest:
    'https://api.gitcode.com/api/v5/repos/pollybird/zhongyu_english_copybook_Hengshui/releases/latest',
  gitcodeDownloadBase:
    'https://gitcode.com/pollybird/zhongyu_english_copybook_Hengshui/releases/download/'
}

export const DEFAULT_TIMEOUT_MS = 3500

/** 当前平台对应的更新清单文件名 */
export function getFeedFileName(platform = process.platform) {
  if (platform === 'darwin') return 'latest-mac.yml'
  if (platform === 'linux') return 'latest-linux.yml'
  return 'latest.yml'
}

/**
 * 简体中文区域（zh-CN / zh-Hans*）优先走 GitCode；
 * 繁体区域（zh-TW / zh-HK / zh-Hant*）不匹配，仍优先 GitHub。
 */
export function prefersGitCodeFirst(locale) {
  const normalized = String(locale || '').toLowerCase()
  return normalized.startsWith('zh-cn') || normalized.startsWith('zh-hans')
}

/** 探测 URL 可达且返回的不是 HTML 错误页 */
export async function probeUrl(url, fetchImpl, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Range: 'bytes=0-0' }
    })
    const ok = res.ok || res.status === 206 || res.status === 416
    if (!ok) return false
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    return !contentType.includes('text/html')
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * GitCode 不支持 /releases/latest/download/ 别名：
 * 先查 API 取最新 Release 的 tag，再拼该版本附件目录作为 generic feed base。
 */
export async function resolveGitCodeFeedUrl(options) {
  const { feedFile, timeoutMs = DEFAULT_TIMEOUT_MS, excludeBase, log = () => {} } = options
  const fetchImpl = options.fetchImpl || ((url, init) => fetch(url, init))
  const endpoints = { ...DEFAULT_ENDPOINTS, ...(options.endpoints || {}) }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let tag
  try {
    const res = await fetchImpl(endpoints.gitcodeApiLatest, { signal: controller.signal })
    if (res.ok) {
      const info = await res.json()
      tag = info.tag_name
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
  if (!tag) return null

  const base = `${endpoints.gitcodeDownloadBase}${tag}/`
  if (excludeBase && base === excludeBase) return null
  const ok = await probeUrl(base + feedFile, fetchImpl, timeoutMs)
  if (!ok) log(`[updater] GitCode feed not reachable: ${base}${feedFile}`)
  return ok ? base : null
}

/**
 * 选择可用更新源；返回 electron-updater generic provider 需要的 base URL，
 * 两个源都不可达时返回 null。
 */
export async function resolveFeedUrl(options) {
  const { feedFile, timeoutMs = DEFAULT_TIMEOUT_MS, excludeBase, log = () => {} } = options
  const fetchImpl = options.fetchImpl || ((url, init) => fetch(url, init))
  const endpoints = { ...DEFAULT_ENDPOINTS, ...(options.endpoints || {}) }
  const gitCodeFirst = options.gitCodeFirst === true

  const resolveGitHub = async () => {
    if (excludeBase === endpoints.githubBase) return null
    const ok = await probeUrl(endpoints.githubBase + feedFile, fetchImpl, timeoutMs)
    if (!ok) log(`[updater] GitHub feed not reachable: ${endpoints.githubBase}${feedFile}`)
    return ok ? endpoints.githubBase : null
  }
  const resolveGitCode = () => resolveGitCodeFeedUrl({ ...options, fetchImpl, endpoints, log })

  const primary = gitCodeFirst ? resolveGitCode : resolveGitHub
  const fallback = gitCodeFirst ? resolveGitHub : resolveGitCode

  const primaryBase = await primary()
  if (primaryBase) {
    log(`[updater] using primary feed: ${primaryBase}`)
    return primaryBase
  }
  const fallbackBase = await fallback()
  if (fallbackBase) {
    log(`[updater] using fallback feed: ${fallbackBase}`)
    return fallbackBase
  }
  log('[updater] neither GitHub nor GitCode feed reachable')
  return null
}
