## 工作原理（摄像头模式）
- 访问摄像头：`navigator.mediaDevices.getUserMedia` 获取视频流并挂到隐藏 `video`（`src/components/WebARComponent.tsx:167–175`）
- 启动检测：调用引擎的 `startMarkerDetection(video)` 并置位状态（`src/components/WebARComponent.tsx:181–183`）
- 抓帧识别：检测器定时从视频帧中做标记/图像/二维码识别（`src/core/ARMarkerDetector.ts`）
- 叠加渲染：引擎根据识别结果创建或更新 3D 可视化（`src/core/WebAREngine.ts`）
- 手势交互：点击、拖拽、捏合、旋转等由交互系统处理（`src/core/ARInteractionSystem.ts`）

## 与 WebXR 的区别
- WebXR 模式：由浏览器原生 AR 管线提供相机背景与空间坐标，用于平面放置与 6DoF 交互
- 摄像头检测模式：通过视频流做识别并将 3D 叠加到识别到的目标上（标记/图像/二维码）。不依赖 WebXR，适用于不支持 WebXR 的设备

## 使用步骤（你在 localhost）
- 展开右上角“工具栏”（`src/components/WebARComponent.tsx:1132–1137`）
- 在“场景”分组点击“🔍 开始检测”（`src/components/WebARComponent.tsx:1209–1215`）
- 对准实体标记、图片或二维码。如果只是测试，点击“📍 测试标记”快速验证渲染与事件通路
- 在画布：
  - 点击放置/选中对象
  - 拖拽移动、捏合或滚轮缩放、双指旋转
- 停止时点击“⏹️ 停止检测”（检测开启后界面会自动显示它）

## 常见现象与说明
- 首屏看不到“开始检测”：因为已自动开启，按钮切换为“⏹️ 停止检测”（`isMarkerDetectionActive=true`）
- 自动恢复：如果 `autoStart` 为真，会自动启动会话并随后启动检测（`src/components/WebARComponent.tsx:353–360`）。停止会话可关闭自动恢复（`stopSession` 会将 `autoResume=false`）
- localhost 环境：现代浏览器将 localhost 视为安全上下文，可使用摄像头；首次访问需点允许

## 可选增强（如需更稳的识别）
- 集成 MindAR/AR.js（图像/标记跟踪更稳定），在 `ARMarkerDetector` 封装并保持现有事件桥接
- 增加视频取景预览开关、识别框/名称的可视化层，便于对准与调试
- 工具栏增加“自动恢复”开关，显式控制是否自动重启会话/检测

确认后我可以按上述增强路线为你加开关与可视化，并可选集成 MindAR/AR.js，以提升摄像头 AR 的识别与稳定性。