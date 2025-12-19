import * as THREE from 'three';
import { EventEmitter } from '../utils/EventEmitter';
import { ModelLoader } from './ModelLoader';
import { ARMarkerDetector, ARMarkerConfig } from './ARMarkerDetector';
import {
  ARSession,
  ARSessionConfig,
  ARFrame,
  ARPlane,
  ARAnchor,
  ARHitTestResult,
  ARModel,
  ARPerformanceMetrics,
  ARDebugInfo,
  Vector3,
  ARMarker,
  ARMarkerType,
  ARImageTrackingResult
} from '../types/webar';

/**
 * WebAR 核心引擎
 * 管理 AR 会话、场景渲染和性能监控
 */
export class WebAREngine extends EventEmitter {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private session: ARSession | null = null;
  private models: Map<string, ARModel> = new Map();
  private modelObjects: Map<string, THREE.Object3D> = new Map();
  private anchors: Map<string, ARAnchor> = new Map();
  private planes: Map<string, ARPlane> = new Map();
  private isRunning = false;
  private frameCount = 0;
  private lastFrameTime = 0;
  private performanceMetrics: ARPerformanceMetrics;
  private debugMode = false;
  private xrSession: XRSession | null = null;
  private xrRefSpace: XRReferenceSpace | null = null;
  private modelLoader: ModelLoader;
  private markerDetector: ARMarkerDetector;
  private markers: Map<string, ARMarker> = new Map();
  private markerObjects: Map<string, THREE.Object3D> = new Map();
  private videoElement: HTMLVideoElement | null = null;

  constructor(canvas: HTMLCanvasElement, debugMode = false) {
    super();
    this.debugMode = debugMode;
    this.modelLoader = new ModelLoader();
    this.markerDetector = new ARMarkerDetector({ useMindAR: false });
    this.initializeScene(canvas);
    this.initializePerformanceMetrics();
    this.setupMarkerDetection();
  }

  /**
   * 初始化 Three.js 场景
   */
  private initializeScene(canvas: HTMLCanvasElement): void {
    // 创建场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // 创建相机
    this.camera = new THREE.PerspectiveCamera(
      75,
      canvas.width / canvas.height,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 5);

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 添加基础光照
    this.addBasicLighting();

    // 添加调试辅助器
    if (this.debugMode) {
      this.addDebugHelpers();
    }
  }

  /**
   * 添加基础光照
   */
  private addBasicLighting(): void {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // 方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
  }

  /**
   * 添加调试辅助器
   */
  private addDebugHelpers(): void {
    // 坐标轴辅助器
    const axesHelper = new THREE.AxesHelper(5);
    this.scene.add(axesHelper);

    // 网格辅助器
    const gridHelper = new THREE.GridHelper(20, 20);
    this.scene.add(gridHelper);
  }

  /**
   * 初始化性能指标
   */
  private initializePerformanceMetrics(): void {
    this.performanceMetrics = {
      fps: 0,
      frameTime: 0,
      memoryUsage: 0,
      drawCalls: 0,
      triangles: 0
    };
  }

  /**
   * 启动 AR 会话
   */
  async startSession(config: ARSessionConfig = {}): Promise<ARSession> {
    try {
      if (!navigator.xr) {
        throw new Error('WebXR not supported in this browser');
      }

      // 检查是否支持 AR
      const isARSupported = await navigator.xr.isSessionSupported('immersive-ar');
      if (!isARSupported) {
        // 降级到非沉浸式 AR 会话
        return this.startFallbackSession(config);
      }

      // 创建 XR 会话
      const xrSession = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: config.requiredFeatures || ['local-floor'],
        optionalFeatures: config.optionalFeatures || []
      });

      this.xrSession = xrSession;
      
      // 设置会话
      this.session = {
        id: this.generateSessionId(),
        config,
        isActive: true,
        startTime: Date.now(),
        frameCount: 0
      };

      // 设置 WebXR 渲染器
      await this.renderer.xr.setSession(xrSession);
      
      // 获取参考空间
      this.xrRefSpace = await xrSession.requestReferenceSpace('local-floor');

      // 监听会话事件
      this.setupSessionEventListeners(xrSession);

      // 开始渲染循环
      this.startRenderLoop();

      this.emit('sessionStart', { session: this.session });
      
      return this.session;
    } catch (error) {
      console.warn('WebXR AR session failed, falling back to simulation:', error);
      return this.startFallbackSession(config);
    }
  }

  /**
   * 启动降级会话（模拟 AR）
   */
  private async startFallbackSession(config: ARSessionConfig): Promise<ARSession> {
    this.session = {
      id: this.generateSessionId(),
      config,
      isActive: true,
      startTime: Date.now(),
      frameCount: 0
    };

    // 创建模拟的平面
    this.createSimulatedPlanes();
    
    // 开始渲染循环
    this.startRenderLoop();

    this.emit('sessionStart', { session: this.session });
    
    return this.session;
  }

  /**
   * 创建模拟的 AR 平面
   */
  private createSimulatedPlanes(): void {
    // 创建水平平面
    const horizontalPlane: ARPlane = {
      id: 'simulated-horizontal-1',
      orientation: 'horizontal',
      center: { x: 0, y: 0, z: 0 },
      extent: { x: 2, y: 0, z: 2 },
      vertices: [
        { x: -1, y: 0, z: -1 },
        { x: 1, y: 0, z: -1 },
        { x: 1, y: 0, z: 1 },
        { x: -1, y: 0, z: 1 }
      ],
      transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    };

    this.planes.set(horizontalPlane.id, horizontalPlane);
    
    // 在调试模式下显示平面
    if (this.debugMode) {
      this.visualizePlane(horizontalPlane);
    }

    this.emit('planeDetected', { plane: horizontalPlane });
  }

  /**
   * 可视化平面
   */
  private visualizePlane(plane: ARPlane): void {
    const geometry = new THREE.PlaneGeometry(plane.extent.x, plane.extent.z);
    const material = new THREE.MeshBasicMaterial({
      color: plane.orientation === 'horizontal' ? 0x00ff00 : 0xff0000,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(plane.center.x, plane.center.y, plane.center.z);
    mesh.userData = { planeId: plane.id, isDebugPlane: true };
    
    this.scene.add(mesh);
  }

  /**
   * 设置会话事件监听器
   */
  private setupSessionEventListeners(xrSession: XRSession): void {
    xrSession.addEventListener('end', () => {
      this.stopSession();
    });

    xrSession.addEventListener('visibilitychange', () => {
      this.emit('visibilityChange', { visibilityState: xrSession.visibilityState });
    });
  }

  /**
   * 开始渲染循环
   */
  private startRenderLoop(): void {
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.render();
  }

  /**
   * 渲染循环
   */
  private render = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    
    // 更新性能指标
    this.updatePerformanceMetrics(deltaTime);

    // 更新帧数据
    this.updateFrameData();

    // 渲染场景
    this.renderer.render(this.scene, this.camera);

    // 更新会话帧计数
    if (this.session) {
      this.session.frameCount++;
    }

    this.lastFrameTime = currentTime;
    this.frameCount++;

    // 继续下一帧
    requestAnimationFrame(this.render);
  };

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(deltaTime: number): void {
    this.performanceMetrics.fps = Math.round(1000 / deltaTime);
    this.performanceMetrics.frameTime = deltaTime;
    
    // 检查浏览器是否支持内存监控
    const memoryInfo = (performance as any).memory;
    if (memoryInfo && memoryInfo.usedJSHeapSize) {
      this.performanceMetrics.memoryUsage = memoryInfo.usedJSHeapSize / 1024 / 1024;
    }

    // 获取渲染统计
    const renderInfo = this.renderer.info;
    this.performanceMetrics.drawCalls = renderInfo.render.calls;
    this.performanceMetrics.triangles = renderInfo.render.triangles;
  }

  /**
   * 更新帧数据
   */
  private updateFrameData(): void {
    if (!this.session || !this.session.isActive) return;

    // 模拟 AR 帧数据更新
    const frame: ARFrame = {
      timestamp: Date.now(),
      camera: {
        transform: this.getCameraTransform(),
        projectionMatrix: this.getProjectionMatrix(),
        viewMatrix: this.getViewMatrix()
      },
      planes: Array.from(this.planes.values()),
      anchors: Array.from(this.anchors.values()),
      hitTestResults: this.performHitTest(),
      imageTrackingResults: this.updateImageTracking()
    };

    this.emit('frameUpdate', { frame });
  }

  /**
   * 获取相机变换矩阵
   */
  private getCameraTransform(): number[] {
    const position = this.camera.position;
    const quaternion = new THREE.Quaternion();
    this.camera.getWorldQuaternion(quaternion);
    
    const matrix = new THREE.Matrix4();
    matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
    
    return matrix.elements;
  }

  /**
   * 获取投影矩阵
   */
  private getProjectionMatrix(): number[] {
    return this.camera.projectionMatrix.elements;
  }

  /**
   * 获取视图矩阵
   */
  private getViewMatrix(): number[] {
    const viewMatrix = new THREE.Matrix4();
    viewMatrix.copy(this.camera.matrixWorld).invert();
    return viewMatrix.elements;
  }

  /**
   * 执行点击测试
   */
  private performHitTest(): ARHitTestResult[] {
    // 模拟点击测试结果
    return [
      {
        type: 'plane',
        distance: 2.0,
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 2, 1],
        plane: Array.from(this.planes.values())[0]
      }
    ];
  }

  /**
   * 更新图像追踪
   */
  private updateImageTracking(): ARImageTrackingResult[] {
    // 从标记检测器获取追踪结果
    const markers = this.markerDetector.getActiveMarkers();
    
    return markers.map((marker, index) => ({
      name: marker.name || marker.imageName,
      index: index,
      imageName: marker.imageName,
      transform: marker.transform,
      trackingState: marker.trackingState,
      measuredWidthInMeters: marker.measuredWidthInMeters,
      measuredHeightInMeters: marker.measuredHeightInMeters,
      isTracking: marker.isTracking,
      marker: marker.marker
    }));
  }

  /**
   * 停止会话
   */
  stopSession(): void {
    if (!this.session) return;

    this.isRunning = false;
    this.session.isActive = false;

    if (this.xrSession) {
      this.xrSession.end();
      this.xrSession = null;
    }

    this.xrRefSpace = null;
    
    this.emit('sessionEnd', { session: this.session });
    
    this.session = null;
  }

  /**
   * 添加模型
   */
  addModel(model: ARModel): void {
    this.models.set(model.id, model);
    
    // 加载 3D 模型
    this.load3DModel(model).then((object3D) => {
      this.scene.add(object3D);
      this.modelObjects.set(model.id, object3D);
      model.isLoaded = true;
      this.emit('modelLoaded', { model });
    }).catch((error) => {
      console.error('Failed to load model:', error);
      this.emit('error', { type: 'modelLoad', error });
    });
  }

  /**
   * 加载 3D 模型
   */
  private async load3DModel(model: ARModel): Promise<THREE.Object3D> {
    try {
      const object = await this.modelLoader.loadModel(model);
      
      // 应用模型变换
      object.position.set(model.position.x, model.position.y, model.position.z);
      
      if (model.rotation.w !== undefined) {
        // 四元数旋转
        object.setRotationFromQuaternion(
          new THREE.Quaternion(model.rotation.x, model.rotation.y, model.rotation.z, model.rotation.w)
        );
      } else {
        // 欧拉角旋转
        object.rotation.set(model.rotation.x, model.rotation.y, model.rotation.z);
      }
      
      object.scale.set(model.scale.x, model.scale.y, model.scale.z);
      object.visible = model.isVisible;
      
      // 存储模型 ID 到用户数据
      object.userData = { modelId: model.id };
      
      return object;
    } catch (error) {
      console.error('Failed to load 3D model:', error);
      
      // 如果模型加载失败，创建占位符
      return this.createPlaceholderModel(model);
    }
  }

  /**
   * 创建占位符模型
   */
  private createPlaceholderModel(model: ARModel): THREE.Object3D {
    // 创建彩色立方体作为占位符
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const material = new THREE.MeshPhongMaterial({ 
      color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
      transparent: true,
      opacity: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // 添加边框
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    lineMaterial.depthTest = false;
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    wireframe.renderOrder = 1;
    mesh.add(wireframe);
    
    // 应用变换
    mesh.position.set(model.position.x, model.position.y, model.position.z);
    
    if (model.rotation.w !== undefined) {
      mesh.setRotationFromQuaternion(
        new THREE.Quaternion(model.rotation.x, model.rotation.y, model.rotation.z, model.rotation.w)
      );
    } else {
      mesh.rotation.set(model.rotation.x, model.rotation.y, model.rotation.z);
    }
    
    mesh.scale.set(model.scale.x, model.scale.y, model.scale.z);
    mesh.visible = model.isVisible;
    
    // 存储模型信息
    mesh.userData = { 
      modelId: model.id,
      isPlaceholder: true,
      originalModel: model
    };
    
    return mesh;
  }

  /**
   * 移除模型
   */
  removeModel(modelId: string): void {
    const model = this.models.get(modelId);
    if (!model) return;

    // 从场景中移除
    const object3D = this.modelObjects.get(modelId);
    if (object3D) {
      this.scene.remove(object3D);
      this.modelObjects.delete(modelId);
    }

    this.models.delete(modelId);
  }

  /**
   * 获取调试信息
   */
  getDebugInfo(): ARDebugInfo {
    return {
      sessionInfo: this.session!,
      performance: this.performanceMetrics,
      activePlanes: this.planes.size,
      activeAnchors: this.anchors.size,
      trackedImages: 0,
      errors: []
    };
  }

  /**
   * 生成会话 ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 调整大小
   */
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * 设置标记检测
   */
  private setupMarkerDetection(): void {
    // 监听标记检测事件
    this.markerDetector.on('markerDetected', (event) => {
      const { marker } = event;
      this.handleMarkerDetected(marker);
    });

    this.markerDetector.on('markerLost', (event) => {
      const { markerId } = event;
      this.handleMarkerLost(markerId);
    });

    this.markerDetector.on('markerUpdated', (event) => {
      const { marker } = event;
      this.handleMarkerUpdated(marker);
    });
  }

  updateMarkerDetectionConfig(config: Partial<ARMarkerConfig>): void {
    this.markerDetector.updateConfig(config);
  }

  /**
   * 处理标记检测
   */
  private handleMarkerDetected(marker: ARMarker): void {
    this.markers.set(marker.id, marker);
    
    // 创建标记可视化
    const markerObject = this.createMarkerVisualization(marker);
    this.markerObjects.set(marker.id, markerObject);
    this.scene.add(markerObject);

    this.emit('markerDetected', { marker });
  }

  /**
   * 处理标记丢失
   */
  private handleMarkerLost(markerId: string): void {
    const marker = this.markers.get(markerId);
    if (!marker) return;

    // 移除标记可视化
    const markerObject = this.markerObjects.get(markerId);
    if (markerObject) {
      this.scene.remove(markerObject);
      this.markerObjects.delete(markerId);
    }

    this.markers.delete(markerId);
    this.emit('markerLost', { markerId });
  }

  /**
   * 处理标记更新
   */
  private handleMarkerUpdated(marker: ARMarker): void {
    this.markers.set(marker.id, marker);
    
    // 更新标记可视化
    const markerObject = this.markerObjects.get(marker.id);
    if (markerObject) {
      this.updateMarkerVisualization(markerObject, marker);
    }

    this.emit('markerUpdated', { marker });
  }

  /**
   * 创建标记可视化
   */
  private createMarkerVisualization(marker: ARMarker): THREE.Object3D {
    const group = new THREE.Group();
    
    // 根据标记类型创建不同的可视化
    switch (marker.type) {
      case ARMarkerType.QR_CODE:
        // QR码标记 - 蓝色立方体
        const qrGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const qrMaterial = new THREE.MeshPhongMaterial({ color: 0x0066ff });
        const qrMesh = new THREE.Mesh(qrGeometry, qrMaterial);
        group.add(qrMesh);
        break;
        
      case ARMarkerType.AR_MARKER:
        // AR标记 - 绿色立方体
        const arGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const arMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        const arMesh = new THREE.Mesh(arGeometry, arMaterial);
        group.add(arMesh);
        break;
        
      case ARMarkerType.IMAGE:
        // 图像标记 - 黄色立方体
        const imageGeometry = new THREE.BoxGeometry(0.06, 0.06, 0.06);
        const imageMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 });
        const imageMesh = new THREE.Mesh(imageGeometry, imageMaterial);
        group.add(imageMesh);
        break;
        
      default:
        // 默认标记 - 红色立方体
        const defaultGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
        const defaultMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        const defaultMesh = new THREE.Mesh(defaultGeometry, defaultMaterial);
        group.add(defaultMesh);
    }

    // 设置位置和旋转
    group.position.set(marker.position.x, marker.position.y, marker.position.z);
    if (marker.rotation) {
      group.rotation.set(marker.rotation.x, marker.rotation.y, marker.rotation.z);
    }

    // 添加发光效果
    const glowGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    group.add(glowMesh);

    group.userData = { 
      markerId: marker.id,
      isMarkerVisualization: true,
      markerType: marker.type
    };

    return group;
  }

  /**
   * 更新标记可视化
   */
  private updateMarkerVisualization(markerObject: THREE.Object3D, marker: ARMarker): void {
    markerObject.position.set(marker.position.x, marker.position.y, marker.position.z);
    if (marker.rotation) {
      markerObject.rotation.set(marker.rotation.x, marker.rotation.y, marker.rotation.z);
    }
  }

  /**
   * 添加标记
   */
  addMarker(marker: ARMarker): void {
    this.markers.set(marker.id, marker);
    
    // 创建标记可视化
    const markerObject = this.createMarkerVisualization(marker);
    this.markerObjects.set(marker.id, markerObject);
    this.scene.add(markerObject);

    this.emit('markerAdded', { marker });
  }

  /**
   * 移除标记
   */
  removeMarker(markerId: string): void {
    const marker = this.markers.get(markerId);
    if (!marker) return;

    // 移除标记可视化
    const markerObject = this.markerObjects.get(markerId);
    if (markerObject) {
      this.scene.remove(markerObject);
      this.markerObjects.delete(markerId);
    }

    this.markers.delete(markerId);
    this.emit('markerRemoved', { markerId });
  }

  /**
   * 开始标记检测
   */
  async startMarkerDetection(videoElement?: HTMLVideoElement): Promise<void> {
    if (videoElement) {
      this.videoElement = videoElement;
    }
    
    await this.markerDetector.startDetection(this.videoElement);
    this.emit('markerDetectionStarted', {});
  }

  /**
   * 停止标记检测
   */
  stopMarkerDetection(): void {
    this.markerDetector.stopDetection();
    this.emit('markerDetectionStopped', {});
  }

  /**
   * 获取所有标记
   */
  getMarkers(): ARMarker[] {
    return Array.from(this.markers.values());
  }

  /**
   * 获取标记对象
   */
  getMarkerObject(markerId: string): THREE.Object3D | undefined {
    return this.markerObjects.get(markerId);
  }

  /**
   * 创建变换矩阵
   */
  private createTransformMatrix(position: Vector3, rotation?: Vector3): number[] {
    const matrix = new THREE.Matrix4();
    
    if (rotation) {
      const quaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rotation.x, rotation.y, rotation.z)
      );
      matrix.compose(
        new THREE.Vector3(position.x, position.y, position.z),
        quaternion,
        new THREE.Vector3(1, 1, 1)
      );
    } else {
      matrix.setPosition(position.x, position.y, position.z);
    }
    
    return matrix.elements;
  }

  /**
   * 获取相机
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * 获取场景
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * 销毁引擎
   */
  dispose(): void {
    this.stopSession();
    this.stopMarkerDetection();
    this.removeAllListeners();
    
    // 清理模型加载器
    this.modelLoader.dispose();
    
    // 清理标记检测器
    this.markerDetector.dispose();
    
    // 清理 Three.js 资源
    this.scene.clear();
    this.renderer.dispose();
    
    this.models.clear();
    this.modelObjects.clear();
    this.anchors.clear();
    this.planes.clear();
    this.markers.clear();
    this.markerObjects.clear();
  }
}