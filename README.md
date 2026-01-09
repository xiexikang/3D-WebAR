# WebAR 基础平台（React + TypeScript + Vite）

基于 React、Three.js 与 WebXR 的 WebAR 开发模板与演示。集成 3D 场景渲染、AR 会话管理、模型加载、交互系统（触摸/手势/语音/控制器）、标记识别，以及性能监控与调试工具。

- 演示入口：`/webar`
- 主页：`/`
- 路由定义：`src/App.tsx:1`

## 技术栈
- React 18、TypeScript、Vite 6
- Three.js、React Three Fiber、@react-three/drei
- React Router（`react-router-dom`）
- Tailwind CSS
- ESLint + TypeScript ESLint

## 快速开始
- 前置条件：已安装 `Node.js` 与 `pnpm`
- 安装依赖：
  - `pnpm install`
- 开发启动：
  - `pnpm dev`
  - 默认端口：`2077`（见 `vite.config.ts:1`）
  - 访问 `http://localhost:2077/`
- 生产构建与预览：
  - 构建：`pnpm build`（输出到 `dist/`）
  - 预览：`pnpm preview`
- 质量检查：
  - 代码检查：`pnpm lint`
  - 类型检查：`pnpm check`

## 目录结构（节选）
- `index.html`：应用入口（`/src/main.tsx` 挂载）
- `src/App.tsx`：路由配置（`/`、`/webar`、占位页）
- `src/pages/Home.tsx`：首页介绍与导航
- `src/pages/WebARDemo.tsx`：WebAR 演示页面（自动启动会话）
- `src/components/WebARComponent.tsx`：WebAR React 主组件（会话、交互、模型等）
- `src/components/ARInteractionPanel.tsx`：交互控制面板
- `src/components/ARMarkerTracker.tsx`：标记/图像/二维码追踪可视化
- `src/core/WebAREngine.ts`：核心引擎（渲染、会话、性能、标记检测）
- `src/core/ARSessionManager.ts`：会话生命周期与事件桥接
- `src/core/ARInteractionSystem.ts`：触摸/手势/语音/控制器交互
- `src/core/ARMarkerDetector.ts`：标记、图像、二维码检测
- `src/types/webar.ts`：核心类型定义

## 主要模块说明
- `WebAREngine`（`src/core/WebAREngine.ts`）
  - 启动 AR 会话与降级：`src/core/WebAREngine.ts:138`
  - 渲染循环与性能统计：`src/core/WebAREngine.ts:276`
  - 调试信息：`src/core/WebAREngine.ts:564`
  - 标记检测事件绑定：`src/core/WebAREngine.ts:585`
- `ARSessionManager`（`src/core/ARSessionManager.ts`）
  - 引擎事件桥接与转发：`src/core/ARSessionManager.ts:201`
- `ARInteractionSystem`（`src/core/ARInteractionSystem.ts`）
  - 构造与事件注册：`src/core/ARInteractionSystem.ts:51`
  - 网格选择开关：`src/core/ARInteractionSystem.ts:63`
- `ARMarkerDetector`（`src/core/ARMarkerDetector.ts`）
  - 获取追踪结果：`src/core/ARMarkerDetector.ts:466`
  - 更新配置：`src/core/ARMarkerDetector.ts:505`
- `WebARComponent`（`src/components/WebARComponent.tsx`）
  - 会话事件监听与 UI：`src/components/WebARComponent.tsx:238`
- `WebARDemo`（`src/pages/WebARDemo.tsx`）
  - 会话事件处理：`src/pages/WebARDemo.tsx:47`、错误处理：`src/pages/WebARDemo.tsx:63`

## 使用指南
- 浏览器要求与权限
  - 需要支持 WebXR 的设备与浏览器，并在安全上下文（HTTPS）下访问。
  - 无法启动 WebXR 时将自动降级为模拟模式（引擎内置降级逻辑）。
  - 需允许摄像头访问以进行标记/图像检测。
- 进入演示
  - 启动开发服务后访问 `/webar`，页面会自动启动或提供按钮启动 AR 会话。
- 模型加载与交互
  - 演示内置 GLTF/GLB 示例模型 URL，并可从本地加载。
  - 交互（示例）：点击放置、拖拽平移、右键或 `Shift+拖拽` 旋转、滚轮缩放、双指捏合缩放、双指上下滑翻滚、`Q/E/W/S` 旋转、`F` 翻转（轴/模式可选）。
- 标记/图像/二维码检测
  - 在 `ARMarkerTracker` 中可视化当前检测结果与统计，支持基础调试信息显示。

## 开发说明
- 架构
  - React 作为 UI 层，`WebAREngine` 管理 Three.js 场景与会话，`ARSessionManager` 负责生命周期与事件分发，`ARInteractionSystem` 处理多模态交互。
- 样式
  - 使用 Tailwind CSS（见 `src/index.css`）。
- Vite 配置
  - 端口与 HMR：`vite.config.ts`，端口 `2077`。
  - 路径别名：`tsconfig.json` 下 `@/*` 指向 `src/*`。

## 路由
- `/`：首页说明与导航（`src/pages/Home.tsx`）。
- `/webar`：WebAR 演示页面（`src/pages/WebARDemo.tsx`）。
- `/other`：占位页面。

## 常见问题（FAQ）
- 浏览器提示不支持 WebXR
  - 请在支持 WebXR 的设备与浏览器上打开，并使用 HTTPS；演示会自动降级为模拟模式以便在桌面浏览器体验。
- 摄像头无法访问
  - 请检查浏览器权限设置，并确保来源为安全上下文。

## 许可证 License

This project is licensed under the MIT License.

## 致谢
- Three.js、React Three Fiber、Vite 与相关开源生态。
