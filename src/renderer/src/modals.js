/** 轻量模态对话框（Electron 渲染进程不支持 window.prompt，统一自绘） */

function ensureRoot() {
  let root = document.getElementById('modal-root')
  if (root) return root
  root = document.createElement('div')
  root.id = 'modal-root'
  document.body.appendChild(root)
  return root
}

function openModal(className) {
  // 同一时刻只保留一个模态框，避免快速触发时层叠
  ensureRoot().querySelectorAll('.modal-overlay').forEach((el) => el.remove())
  const overlay = document.createElement('div')
  overlay.className = `modal-overlay ${className}`
  ensureRoot().appendChild(overlay)
  return overlay
}

function closeModal(overlay) {
  overlay.classList.add('closing')
  setTimeout(() => overlay.remove(), 150)
}

function box(title, contentNode) {
  const overlay = openModal('')
  overlay.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true">
      <div class="modal-title"></div>
      <div class="modal-body"></div>
      <div class="modal-actions"></div>
    </div>`
  overlay.querySelector('.modal-title').textContent = title
  overlay.querySelector('.modal-body').appendChild(contentNode)
  return overlay
}

export function showAlert(title, message) {
  return new Promise((resolve) => {
    const content = document.createElement('div')
    content.className = 'modal-text'
    content.textContent = message
    const overlay = box(title, content)
    const actions = overlay.querySelector('.modal-actions')
    const ok = document.createElement('button')
    ok.className = 'btn btn-primary'
    ok.textContent = '确定'
    actions.appendChild(ok)
    ok.focus()
    const done = () => {
      closeModal(overlay)
      resolve()
    }
    ok.onclick = done
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') done()
    })
  })
}

/** 三选一：保存 / 不保存 / 取消 */
export function showQuestion(title, message) {
  return new Promise((resolve) => {
    const content = document.createElement('div')
    content.className = 'modal-text'
    content.textContent = message
    const overlay = box(title, content)
    const actions = overlay.querySelector('.modal-actions')

    const make = (text, cls, value) => {
      const btn = document.createElement('button')
      btn.className = `btn ${cls}`
      btn.textContent = text
      btn.onclick = () => {
        closeModal(overlay)
        resolve(value)
      }
      actions.appendChild(btn)
      return btn
    }
    const cancel = make('取消', 'btn-default', 'cancel')
    make('不保存', 'btn-default', 'discard')
    const save = make('保存', 'btn-primary', 'save')
    save.focus()
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cancel.click()
    })
  })
}

export function showPrompt(title, label, defaultValue = '') {
  return new Promise((resolve) => {
    const content = document.createElement('div')
    const lab = document.createElement('label')
    lab.className = 'modal-label'
    lab.textContent = label
    const input = document.createElement('input')
    input.className = 'input'
    input.value = defaultValue
    content.appendChild(lab)
    content.appendChild(input)

    const overlay = box(title, content)
    const actions = overlay.querySelector('.modal-actions')
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      closeModal(overlay)
      resolve(value)
    }
    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'btn btn-default'
    cancelBtn.textContent = '取消'
    cancelBtn.onclick = () => finish(null)
    const okBtn = document.createElement('button')
    okBtn.className = 'btn btn-primary'
    okBtn.textContent = '确定'
    okBtn.onclick = () => finish(input.value.trim())
    actions.append(cancelBtn, okBtn)

    input.focus()
    input.select()
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') okBtn.click()
      if (e.key === 'Escape') cancelBtn.click()
    })
  })
}

/** 大段文本展示（用户协议 / 帮助 / 关于） */
export function showTextPage(title, text, mono = false) {
  const content = document.createElement('div')
  content.className = 'modal-scroll-text' + (mono ? ' mono' : '')
  content.textContent = text
  const overlay = box(title, content)
  overlay.classList.add('modal-lg')
  const actions = overlay.querySelector('.modal-actions')
  const ok = document.createElement('button')
  ok.className = 'btn btn-primary'
  ok.textContent = '确定'
  ok.onclick = () => closeModal(overlay)
  actions.appendChild(ok)
  ok.focus()
}
