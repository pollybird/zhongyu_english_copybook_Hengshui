/** 自动更新提示 UI：发现新版本 / 下载进度 / 重启安装 */
import { showAlert } from './modals.js'

let t = (key) => key
let overlay = null
let currentVersion = ''

export function setUpdateI18n(translator) {
  t = translator
}

function close() {
  if (overlay) overlay.remove()
  overlay = null
}

function open(title, message, actions, progress) {
  close()
  overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.dataset.mode = progress ? 'downloading' : ''

  const box = document.createElement('div')
  box.className = 'modal-box'

  const titleEl = document.createElement('div')
  titleEl.className = 'modal-title'
  titleEl.textContent = title

  const body = document.createElement('div')
  body.className = 'modal-body modal-text update-body'
  body.textContent = message

  box.append(titleEl, body)

  if (progress) {
    const bar = document.createElement('progress')
    bar.className = 'update-progress'
    bar.max = 100
    bar.value = progress.percent
    bar.dataset.role = 'progress'
    body.appendChild(bar)
  }

  const actionsEl = document.createElement('div')
  actionsEl.className = 'modal-actions'
  actions.forEach(({ label, kind, onClick, disabled }) => {
    const btn = document.createElement('button')
    btn.className = `btn ${kind === 'primary' ? 'btn-primary' : 'btn-default'}`
    btn.textContent = label
    btn.disabled = Boolean(disabled)
    btn.addEventListener('click', onClick)
    actionsEl.appendChild(btn)
  })
  box.appendChild(actionsEl)
  overlay.appendChild(box)
  document.body.appendChild(overlay)
}

function showAvailable() {
  open(
    t('update.availableTitle'),
    t('update.available', { version: currentVersion }),
    [
      { label: t('update.later'), onClick: close },
      {
        label: t('update.skip'),
        onClick: () => {
          window.api.skipUpdateVersion(currentVersion)
          close()
        }
      },
      {
        label: t('update.downloadNow'),
        kind: 'primary',
        onClick: () => {
          showDownloading(0)
          void window.api.downloadUpdate()
        }
      }
    ],
    null
  )
}

function showDownloading(percent) {
  open(
    t('update.availableTitle'),
    t('update.downloadProgress', { percent: Math.floor(percent) }),
    [],
    { percent }
  )
}

function showDownloaded() {
  open(
    t('update.downloadedTitle'),
    t('update.downloaded', { version: currentVersion }),
    [
      { label: t('update.later'), onClick: close },
      {
        label: t('update.restartNow'),
        kind: 'primary',
        onClick: () => window.api.installUpdate()
      }
    ],
    null
  )
}

function handle(event) {
  switch (event.type) {
    case 'available':
      currentVersion = event.version
      showAvailable()
      break
    case 'download-progress':
      if (overlay && overlay.dataset.mode === 'downloading') {
        const bar = overlay.querySelector('[data-role="progress"]')
        const body = overlay.querySelector('.update-body')
        if (bar) bar.value = event.percent
        if (body && body.firstChild) {
          body.firstChild.textContent = t('update.downloadProgress', {
            percent: Math.floor(event.percent)
          })
        }
      } else {
        showDownloading(event.percent)
      }
      break
    case 'downloaded':
      currentVersion = event.version || currentVersion
      showDownloaded()
      break
    case 'not-available':
      if (event.manual) showAlert(t('update.availableTitle'), t('update.latest'))
      break
    case 'error':
      close()
      if (event.manual) showAlert(t('update.availableTitle'), t('update.checkFailed'))
      break
    case 'unsupported':
      showAlert(t('update.availableTitle'), t('update.unsupported'))
      break
    default:
      break
  }
}

export function initUpdateUI() {
  window.api.onUpdateEvent(handle)
}
