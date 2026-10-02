import { buildPages, renderPage, PAGE_W, PAGE_H } from './engine/copybook.js'

/**
 * 打印渲染窗口：
 * 接收主进程转发的工程数据 -> 按 A4 2 倍分辨率渲染所有页 -> 通知主进程（printToPDF / print）
 */

// 打印采用 192DPI（2x），保证印刷清晰
const PRINT_DPR = 2

window.api.onPrintData(async (settings) => {
  try {
    await Promise.all([
      document.fonts.load('24px "HengshuiFont"'),
      document.fonts.load('bold 24px "HengshuiFont"'),
      document.fonts.ready
    ])

    const pages = buildPages(settings)
    const container = document.getElementById('pages')
    container.innerHTML = ''

    for (let i = 0; i < pages.length; i++) {
      const pageDiv = document.createElement('div')
      pageDiv.className = 'pdf-page'
      const canvas = document.createElement('canvas')
      canvas.width = PAGE_W * PRINT_DPR
      canvas.height = PAGE_H * PRINT_DPR
      const ctx = canvas.getContext('2d')
      ctx.setTransform(PRINT_DPR, 0, 0, PRINT_DPR, 0, 0)
      renderPage(ctx, pages[i], settings, i, pages.length)
      pageDiv.appendChild(canvas)
      container.appendChild(pageDiv)
    }

    // 等待两帧，确保布局与光栅化完成
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    await document.fonts.ready

    window.api.printRendered()
  } catch (err) {
    console.error('PDF 页面渲染失败', err)
  }
})
