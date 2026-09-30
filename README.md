# 钟毓英语衡水体字帖生成器（Electron 版）

生成英语衡水体字帖的桌面应用。输入英文内容，选择线格与生成模式，即可实时预览并导出为 PDF 打印使用。

当前版本：**2.0.0**（自 2.0.0 起由 PyQt6 重构为 Electron，见 [UPGRADE.md](UPGRADE.md)）

版权所有 (c) 2026 泰州姜堰钟毓信息技术有限公司 · 官网：https://www.tzzhy.cn/

## 功能特性

- **四种生成模式**：描红、抄写、描红+抄写、字帖
- **两种线格**：四线三格、单横线
- **实时预览**：Canvas 渲染 800×1131 页面，PageUp/PageDown 翻页
- **OCR 截图识别**（2.0.0 新增）：框选屏幕任意区域，自动识别文字填入内容框，支持英文 / 中文简体 / 英文+中文
- **多标签页**：同时编辑多个工程，未保存关闭有提示
- **自定义头部字段**：最多 3 个（如班级、姓名、学号），支持标题与页码
- **工程文件**：`.zyecb` 格式，与原版 PyQt6 v1.1.1 双向兼容，已注册文件关联（双击打开）
- **PDF 导出**：A4 多页，描红/网格高清渲染
- **排版引擎修正**：修复了原版单横线模式按四线三格估算导致的跨页重复单词问题

## 技术栈

- Electron 31 + electron-vite 2 + Vite 5（原生 JavaScript，无前端框架）
- Canvas 2D 排版渲染，tesseract.js 离线 OCR（内置 tessdata_fast 语言数据）
- electron-builder 打包（Windows NSIS 安装包）

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

# 打包 Windows 安装包（输出到 dist/）
npm run dist
```

要求 Node.js 18 及以上。

## 使用说明

1. 在左侧"输入内容"多行文本框输入要生成字帖的英文内容，或点击**截图识别**框选屏幕文字自动填入
2. 设置字体大小、字间距、位置偏移等参数
3. 选择线格类型（四线三格 / 单横线）与生成模式（描红 / 抄写 / 描红+抄写 / 字帖）
4. 可添加自定义头部字段（班级、姓名等）
5. 保存 / 加载 `.zyecb` 工程文件
6. 点击**导出PDF**生成字帖文件

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
| Ctrl+F | 导出 PDF |
| PageUp / PageDown | 预览翻页 |
| Alt+F / Alt+E / Alt+H | 打开文件 / 编辑 / 帮助菜单 |

## 目录结构

```
├── src/
│   ├── main/              # 主进程（窗口、菜单、IPC、OCR、PDF 导出）
│   ├── preload/           # 预加载脚本（contextIsolation 安全桥接）
│   └── renderer/          # 渲染进程（index.html 主界面、print.html 打印、sel.html 截图选区）
│       └── src/
│           ├── engine/    # copybook.js 排版引擎、zyecb-format.js 工程文件读写
│           └── assets/    # 衡水体字体、协议文本
├── resources/             # 图标、版权文本、OCR 语言数据（ocr-data）
└── out/                   # 构建产物
```

## 许可证

[Apache-2.0](resources/copyright.txt)
