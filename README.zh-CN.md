# RMBG - AI 图像背景移除工具

一个桌面应用程序，使用 [Gitee AI Serverless API - RMBG-2.0](https://ai.gitee.com/serverless-api?model=RMBG-2.0) 实现图像背景移除，基于 Tauri 和 React 构建。

## 功能特性

- 仅支持图片和目录
- 批量背景移除
- 实时预览
- 支持深色模式
- 保存到下载文件夹
- macOS 下支持 Apple Silicon 芯片使用本地模型扣图，其他设备支持支持 API 扣图

# 截图

| 批量扣图     | 本地模型扣图 | API 扣图 |
|    :----:  |    :----:  |    :----:  |
| ![批量扣图](./docs/screenshots/batch.png)     | ![本地模型](./docs/screenshots/local-model.png)      | ![API 扣图](./docs/screenshots/api.png)      |

## 技术栈

- Tauri - 跨平台桌面框架
- React - UI 框架
- TypeScript - 编程语言
- TailwindCSS - 样式框架
- Headless UI - UI 组件库
- Heroicons - 图标集
- Gitee AI Serverless API - [RMBG-2.0](https://ai.gitee.com/serverless-api?model=RMBG-2.0) 模型

## 开发环境要求

- Node.js 20 及以上
- Rust
- Git

## 快速开始

1. 克隆本仓库
2. 安装依赖：npm install
3. 启动开发环境：npm run tauri dev
4. 构建应用程序：npm run tauri build

## 许可证

MIT 许可证
