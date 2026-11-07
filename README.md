# 钟毓英语衡水体字帖生成器（Electron 版）

**中文** | [English](README_EN.md)

生成英语衡水体字帖的桌面应用。输入英文内容，选择线格与生成模式，即可实时预览，并可直接打印、打印预览或导出为 PDF。

当前版本：**2.0.7**（自 2.0.0 起由 PyQt6 重构为 Electron，见 [UPGRADE.md](UPGRADE.md)）

版权所有 (c) 2026 泰州姜堰钟毓信息技术有限公司 · 官网：https://www.tzzhy.cn/

## 功能特性

- **四种生成模式**：描红、抄写、描红+抄写、字帖
- **两种线格**：四线三格、单横线
- **两款字体可选**（2.0.6 新增）：衡水钢笔体、衡水中性笔体，侧边栏下拉切换，随工程保存
- **实时预览**：Canvas 渲染 800×1131 页面，PageUp/PageDown 翻页
- **OCR 截图识别**（2.0.0 新增）：框选屏幕任意区域，自动识别文字填入内容框，支持英文 / 中文简体 / 英文+中文
- **多标签页**：同时编辑多个工程，未保存关闭有提示
- **自定义头部字段**：最多 3 个（如班级、姓名、学号），支持标题与页码
- **工程文件**：`.zyecb` 格式，与原版 PyQt6 v1.1.1 双向兼容，已注册文件关联（双击打开）
- **打印与打印预览**（2.0.2 新增）：无需先导出 PDF，**Ctrl+P** 直接弹出系统打印对话框；打印预览窗口可逐页查看排版、缩放与页码跟随
- **中英文自动适配**（2.0.3 新增）：跟随系统语言，中文系统显示中文，其他语言以英文兜底；`.zyecb` 工程文件格式不受影响
- **自动监测更新**（2.0.7 新增）：启动 5 秒后静默检查新版本，帮助菜单可手动检查；简体中文系统从 GitCode 下载，英文及其他语言从 GitHub 下载，主源不可用时自动切换备用源
- **横线与描红配色自定义**（2.0.5 新增）：用系统取色器设置横线颜色与描红文字颜色，随工程一并保存
- **PDF 导出**：A4 多页，描红/网格高清渲染；打印与导出共用同一 A4 渲染管线，效果完全一致
- **排版引擎修正**：修复了原版单横线模式按四线三格估算导致的跨页重复单词问题

## 技术栈

- Electron 41 + electron-vite 3 + Vite 6（原生 JavaScript，无前端框架）
- electron-updater 自动更新（GitHub / GitCode 双源）
- Canvas 2D 排版渲染，tesseract.js 离线 OCR（内置 tessdata_fast 语言数据）
- electron-builder 跨平台打包（Windows NSIS、Linux AppImage/deb/rpm、macOS zip/dmg）

## 字体说明

- 内置两款自制字体（均为 1.1.0）：**衡水钢笔体**、**衡水中性笔体**（各含 `woff2` 与 `woff` 兜底），可在侧边栏「字体」下拉框中切换；随应用以 MIT 许可分发，许可全文见 [`src/renderer/src/assets/fonts/LICENSE.txt`](src/renderer/src/assets/fonts/LICENSE.txt)
- 字体项目主页（可单独下载最新版）：GitHub <https://github.com/pollybird/Hengshui_Fonts> ｜ GitCode <https://gitcode.com/pollybird/Hengshui_Fonts> ｜ Gitee <https://gitee.com/pollybird/hengshui-fonts>
- 覆盖 ASCII 可见字符（U+0020–U+007E）及西文补充符号；页码等中文字符使用系统字体回退
- 2.0.5 起已移除第三方字体「舒窈英文衡水体」（其授权信息不明）；2.0.0–2.0.4 的安装包中仍包含该字体，请以 2.0.5 及之后的版本为准

## 开发

```bash
# 安装依赖（国内网络建议先设置镜像）
npm install --registry=https://registry.npmmirror.com
# Electron 二进制下载较慢时：
# export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

# 开发模式
npm run dev

# 构建
npm run build

# 单元测试 / 代码检查 / 格式检查
npm test
npm run lint
npm run format:check

# 打包当前平台安装包（输出到 dist/）
npm run dist

# 指定平台 / 架构
npx electron-builder --linux AppImage deb rpm   # 可选 --x64 / --arm64
npx electron-builder --win nsis
npx electron-builder --mac zip
```

要求 Node.js 20 及以上（推荐 22 LTS）。

## 自动更新与发布

### 更新来源

- **简体中文系统**：优先从 GitCode 下载（GitCode 国内访问更快），失败时回退 GitHub
- **英文及其他语言**：优先从 GitHub 下载，失败时回退 GitCode
- 启动 5 秒后静默检查一次；也可通过**帮助 → 检查更新**手动触发
- 发现新版本先弹窗确认，可选择「稍后」「不再提示此版本」或「下载并安装」；下载完成后可立即重启

平台限制：

- **Windows（x64）**、**Linux x64** 支持自动更新（Windows arm64 推荐使用 x64 安装包，系统会自动兼容运行）
- **macOS** 安装包未签名，无法通过自动安装的签名校验，检查更新时会提示前往发布页手动下载
- **Linux arm64** 暂无独立的更新清单（electron-updater 不识别 `latest-linux-arm64.yml`），请手动下载

### 发版流程

1. 更新 `package.json` 中的 `version`，提交并推送
2. 打与版本号一致的 tag（如 `2.0.7`，**不要**加 `v` 前缀）并推送：

   ```bash
   git tag 2.0.7
   git push origin 2.0.7
   ```

3. GitHub Actions（[`.github/workflows/release.yml`](.github/workflows/release.yml)）自动在三平台构建：
   - Linux：AppImage / deb / rpm（x64 + arm64）
   - Windows：NSIS 安装包（x64）
   - macOS：zip（x64 + arm64）
4. 构建产物上传到 GitHub Release，再同步推送 tag 并将安装包与 `latest*.yml` 上传到 GitCode Release
5. 也可在 Actions 页面手动触发 `Release` 工作流并填写 tag

需要在仓库 Secrets 中配置 `GITCODE_TOKEN`（GitCode 访问令牌）；未配置时只发布 GitHub Release，跳过 GitCode 同步。

自动更新依赖 `latest.yml` / `latest-linux.yml` 中的文件名与实际上传的安装包完全一致，因此 `electron-builder` 的 `artifactName` 统一使用 ASCII 名称，请勿随意修改。

## 使用说明

1. 在左侧"输入内容"多行文本框输入要生成字帖的英文内容，或点击**截图识别**框选屏幕文字自动填入
2. 设置字体大小、字间距、位置偏移等参数
3. 选择线格类型（四线三格 / 单横线）与生成模式（描红 / 抄写 / 描红+抄写 / 字帖）
4. 可添加自定义头部字段（班级、姓名等）
5. 保存 / 加载 `.zyecb` 工程文件
6. 点击**导出PDF**生成字帖文件，或使用**文件菜单 → 打印 / 打印预览**直接打印

### 打印与打印预览

- **文件 → 打印（Ctrl+P）**：按当前工程渲染全部页面后弹出系统打印对话框，选择打印机即可直接打印
- **文件 → 打印预览**：打开独立预览窗口，逐页查看排版效果，支持缩放（适应页宽 / 40%~200%）、页码跟随滚动，也可在窗口中直接点击**打印**
- 打印与 PDF 导出共用同一 A4 渲染管线（192DPI），效果完全一致

### OCR 截图识别

- 点击输入框下方的**截图识别**按钮，选择识别语言（英文 / 中文简体 / 英文+中文）
- 屏幕被冻结后拖拽框选要识别的文字区域
- **Enter** 或双击确认，**Esc** 取消；识别结果自动填入输入内容框
- OCR 语言数据已内置，无需联网

### 快捷键

| 快捷键 | 功能 |
|---|---|
| Ctrl+N | 新建工程 |
| Ctrl+O | 打开工程 |
| Ctrl+S | 保存工程 |
| Ctrl+Shift+S | 另存为 |
| Ctrl+P | 打印 |
| Ctrl+F | 导出 PDF |
| PageUp / PageDown | 预览翻页 |
| Alt+F / Alt+E / Alt+H | 打开文件 / 编辑 / 帮助菜单 |

## 目录结构

```
├── src/
│   ├── main/              # 主进程（窗口、菜单、IPC、OCR、打印与 PDF 导出）
│   ├── preload/           # 预加载脚本（contextIsolation 安全桥接）
│   └── renderer/          # 渲染进程（index.html 主界面、print.html 打印渲染、preview.html 打印预览、sel.html 截图选区）
│       └── src/
│           ├── engine/    # copybook.js 排版引擎、zyecb-format.js 工程文件读写
│           └── assets/    # 自制衡水钢笔体、衡水中性笔体字体（woff2/woff）及协议文本
├── resources/             # 图标、版权文本、OCR 语言数据（ocr-data）
├── scripts/               # 发布脚本（publish-gitcode.mjs）
├── tests/                 # 单元测试（Node 内置 test runner）
├── .github/workflows/     # GitHub Actions：CI 与 tag 触发的多平台发版
└── out/                   # 构建产物
```

## 许可证

[Apache-2.0](resources/copyright.txt)
