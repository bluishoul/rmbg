# RMBG - AI 图像背景移除工具

macOS 桌面应用，基于 [RMBG-2.0](https://huggingface.co/briaai/RMBG-2.0) CoreML 模型实现本地图像背景移除，使用 Tauri 和 React 构建。

## 功能特性

- **本地 CoreML 推理** - 完全在设备上运行（CPU + GPU），无需云端 API
- **批量处理** - 支持选择单张图片或整个文件夹，并发处理
- **修复与擦除选区** - 在预览中画框修复漏抠区域或擦除多余残留
  - **修复模式**：对选区重新跑 RMBG，将结果合成回 matting
  - **擦除模式**：先在选区中抠出主体，再从 matting 中精确扣除
  - 待处理选框支持移动、缩放、旋转；已完成选框支持撤销
- **长按空格预览** - 按住空格键临时切换原图与抠图结果
- **实时预览** - 点击图片查看全屏预览，棋盘格透明背景
- **深色模式** - 跟随系统外观
- **一键保存** - 批量导出所有结果到下载文件夹
- **Gitee 镜像回退** - HuggingFace 下载失败时（如国内网络）自动从 Gitee Release 镜像拉取模型

## 截图

| 批量抠图 | 本地模型 | API 模式 |
| :----: | :----: | :----: |
| ![批量抠图](./docs/screenshots/batch.png) | ![本地模型](./docs/screenshots/local-model.png) | ![API 模式](./docs/screenshots/api.png) |

## 技术栈

- [Tauri v2](https://v2.tauri.app/) - 跨平台桌面框架
- React + TypeScript - 界面
- TailwindCSS - 样式
- Headless UI + Heroicons - 组件 & 图标
- Swift sidecar + CoreML - 本地 RMBG-2.0 推理
- [RMBG2Swift](https://github.com/VincentGourbin/RMBG2Swift) - CoreML 模型加载器

## 环境要求

- macOS 13+（Ventura 及以上）
- Apple Silicon 或支持 CoreML 的 Intel Mac
- Node.js 20+
- Rust
- Xcode Command Line Tools（用于编译 Swift sidecar）

## 快速开始

```bash
git clone https://gitee.com/bluishoul/rmbg.git
cd rmbg
npm install
npm run tauri dev
```

构建发布版本：

```bash
npm run tauri build
```

`.dmg` 和 `.app` 将生成在 `src-tauri/target/release/bundle/` 目录下。

## 许可证

MIT 许可证
