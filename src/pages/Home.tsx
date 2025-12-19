import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        {/* 头部标题 */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            WebAR 基础平台
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            基于 Three.js 和 React 的 WebAR 开发平台，提供 3D 渲染、AR 会话管理、
            模型加载等核心功能，支持 WebXR API 和降级模拟模式
          </p>
        </div>

        {/* 功能卡片 */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-blue-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white text-2xl">🎯</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">3D 场景渲染</h3>
            <p className="text-gray-600">
              基于 Three.js 的高性能 3D 图形渲染引擎，支持光照、阴影、材质等效果
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-green-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white text-2xl">📱</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">AR 会话管理</h3>
            <p className="text-gray-600">
              完整的 AR 会话生命周期管理，支持 WebXR API 和智能降级方案
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-purple-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white text-2xl">🎨</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">模型加载</h3>
            <p className="text-gray-600">
              支持 GLTF/GLB 等主流 3D 模型格式，提供模型缓存和优化加载机制
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-orange-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white text-2xl">🎮</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">交互系统</h3>
            <p className="text-gray-600">
              丰富的交互方式支持，包括鼠标、触摸、手势等多种输入方式
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-red-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white text-2xl">📊</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">性能监控</h3>
            <p className="text-gray-600">
              实时的性能指标监控，包括 FPS、内存使用、渲染统计等
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-indigo-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white text-2xl">🔧</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">调试工具</h3>
            <p className="text-gray-600">
              完善的调试工具集，包含坐标轴、网格、日志等调试辅助功能
            </p>
          </div>
        </div>

        {/* 演示入口 */}
        <div className="text-center">
          <Link
            to="/webar"
            className="inline-block bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            🚀 开始 WebAR 体验
          </Link>
        </div>

        {/* 技术栈 */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">技术栈</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              React 18
            </span>
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              TypeScript
            </span>
            <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
              Three.js
            </span>
            <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
              WebXR
            </span>
            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              React Three Fiber
            </span>
            <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
              Vite
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}