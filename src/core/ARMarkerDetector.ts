import { EventEmitter } from '../utils/EventEmitter';
import { ARImageTrackingResult } from '../types/webar';

/**
 * AR 标记识别配置
 */
export interface ARMarkerConfig {
  // 图像追踪配置
  imageTracking?: {
    enabled: boolean;
    images: Array<{
      name: string;
      url: string;
      width?: number; // 物理宽度（米）
      height?: number; // 物理高度（米）
    }>;
    confidenceThreshold?: number; // 0-1
  };
  
  // 二维码识别配置
  qrCodeTracking?: {
    enabled: boolean;
    formats?: string[]; // 'qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e'
  };
  
  // 标记检测配置
  markerDetection?: {
    enabled: boolean;
    types?: string[]; // 'apriltag', 'artoolkit'
    size?: number; // 标记大小（像素）
  };
  
  // 通用配置
  detectionInterval?: number; // 检测间隔（毫秒）
  maxTrackedImages?: number; // 最大追踪图像数量
  debugMode?: boolean;
  // MindAR 集成（可选）
  useMindAR?: boolean; // 是否使用 MindAR 进行图像追踪
  mindarTargetSrc?: string; // .mind 目标文件 URL（MindAR 需要）
}

/**
 * AR 标记识别器
 * 支持图像追踪、二维码识别和标记检测
 */
export class ARMarkerDetector extends EventEmitter {
  private config: ARMarkerConfig;
  private isRunning = false;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;
  private trackedImages: Map<string, ARImageTrackingResult> = new Map();
  private detectionIntervalId: number | null = null;
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private lastDetectionTime = 0;
  // MindAR 运行时对象
  private mindarContainer: HTMLDivElement | null = null;
  private mindarThree: any = null;
  private mindarAnchor: any = null;
  private mindarAnimating = false;

  constructor(config?: ARMarkerConfig) {
    super();
    this.config = {
      detectionInterval: 100, // 100ms
      maxTrackedImages: 5,
      debugMode: false,
      useMindAR: false,
      mindarTargetSrc: '/targets/apple.mind',
      ...config
    };
  }

  /**
   * 初始化标记识别器
   */
  async initialize(videoElement: HTMLVideoElement): Promise<void> {
    this.videoElement = videoElement;
    
    // 创建画布用于图像处理
    this.canvasElement = document.createElement('canvas');
    this.canvasElement.width = 640;
    this.canvasElement.height = 480;
    this.canvasElement.style.display = 'none';
    document.body.appendChild(this.canvasElement);
    
    this.canvasContext = this.canvasElement.getContext('2d', { 
      willReadFrequently: true 
    });
    
    if (!this.canvasContext) {
      throw new Error('Failed to get 2D context from canvas');
    }

    // 预加载追踪图像
    if (this.config.imageTracking?.enabled) {
      await this.preloadTrackingImages();
    }

    this.emit('initialized');
  }

  /**
   * 开始标记检测
   */
  start(): void {
    if (this.isRunning || !this.videoElement) {
      return;
    }

    this.isRunning = true;
    this.lastDetectionTime = performance.now();
    
    // 开始检测循环
    this.detectionIntervalId = window.setInterval(() => {
      this.performDetection();
    }, this.config.detectionInterval);

    this.emit('started');
  }

  /**
   * 停止标记检测
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.detectionIntervalId) {
      clearInterval(this.detectionIntervalId);
      this.detectionIntervalId = null;
    }

    // 清空追踪结果
    this.trackedImages.clear();

    this.emit('stopped');
  }

  /**
   * 执行检测
   */
  private performDetection(): void {
    if (!this.videoElement || !this.canvasContext || !this.isRunning) {
      return;
    }

    const currentTime = performance.now();
    const video = this.videoElement;
    
    // 检查视频是否准备好
    if (video.readyState !== 4) {
      return;
    }

    // 绘制当前视频帧到画布
    this.canvasContext.drawImage(video, 0, 0, this.canvasElement!.width, this.canvasElement!.height);
    
    // 执行不同类型的检测
    const detectionPromises: Promise<void>[] = [];

    // 图像追踪
    if (this.config.imageTracking?.enabled) {
      detectionPromises.push(this.performImageTracking());
    }

    // 二维码识别
    if (this.config.qrCodeTracking?.enabled) {
      detectionPromises.push(this.performQRCodeDetection());
    }

    // 标记检测
    if (this.config.markerDetection?.enabled) {
      detectionPromises.push(this.performMarkerDetection());
    }

    // 等待所有检测完成
    Promise.all(detectionPromises).then(() => {
      this.lastDetectionTime = currentTime;
    }).catch((error) => {
      console.error('Detection error:', error);
      this.emit('error', { type: 'detection', error });
    });
  }

  /**
   * 执行图像追踪
   */
  private async performImageTracking(): Promise<void> {
    if (!this.config.imageTracking?.images.length) {
      return;
    }

    const imageTrackingConfig = this.config.imageTracking;
    const newTrackedImages: Map<string, ARImageTrackingResult> = new Map();

    // 简化的图像追踪实现
    // 在实际项目中，这里应该使用专业的计算机视觉库
    for (const imageConfig of imageTrackingConfig.images) {
      try {
        const result = await this.trackSingleImage(imageConfig);
        if (result && result.isTracking) {
          newTrackedImages.set(result.name, result);
        }
      } catch (error) {
        console.warn(`Failed to track image ${imageConfig.name}:`, error);
      }
    }

    // 更新追踪结果
    this.updateTrackedImages(newTrackedImages);
  }

  /**
   * 追踪单个图像
   */
  private async trackSingleImage(imageConfig: {
    name: string;
    url: string;
    width?: number;
    height?: number;
  }): Promise<ARImageTrackingResult | null> {
    // 简化的图像追踪模拟
    // 这里应该使用实际的图像识别算法
    
    const confidence = Math.random() * 0.8 + 0.1; // 模拟置信度
    const threshold = this.config.imageTracking?.confidenceThreshold || 0.5;

    if (confidence < threshold) {
      return null;
    }

    // 模拟追踪结果
    const result: ARImageTrackingResult = {
      name: imageConfig.name,
      index: 0,
      imageName: imageConfig.name,
      transform: this.generateRandomTransform(),
      trackingState: 'tracking',
      measuredWidthInMeters: imageConfig.width || 0.1,
      measuredHeightInMeters: imageConfig.height || 0.1,
      isTracking: true,
      marker: {
        id: imageConfig.name,
        name: imageConfig.name,
        type: 'image',
        position: { x: 0, y: 0, z: 0 },
        size: { width: imageConfig.width || 0.1, height: imageConfig.height || 0.1 },
        confidence: confidence,
        isTracking: true
      }
    };

    return result;
  }

  /**
   * 执行二维码检测
   */
  private async performQRCodeDetection(): Promise<void> {
    if (!this.canvasElement || !this.canvasContext) {
      return;
    }

    try {
      // 获取图像数据
      const imageData = this.canvasContext.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);
      
      // 简化的二维码检测模拟
      // 实际项目中应该使用 jsQR 或类似的库
      const qrCodes = this.simulateQRCodeDetection(imageData);
      
      for (const qrCode of qrCodes) {
        this.emit('qrCodeDetected', {
          data: qrCode.data,
          location: qrCode.location,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('QR code detection error:', error);
    }
  }

  /**
   * 模拟二维码检测
   */
  private simulateQRCodeDetection(imageData: ImageData): Array<{
    data: string;
    location: { x: number; y: number; width: number; height: number };
  }> {
    // 模拟检测到的二维码
    const mockQRCodes = [
      {
        data: 'https://github.com/webar-project',
        location: { x: 100, y: 100, width: 200, height: 200 }
      },
      {
        data: 'WebAR-Platform-v1.0',
        location: { x: 300, y: 200, width: 150, height: 150 }
      }
    ];

    // 随机返回检测结果（模拟不稳定的检测）
    if (Math.random() < 0.3) { // 30% 概率检测到
      return [mockQRCodes[Math.floor(Math.random() * mockQRCodes.length)]];
    }

    return [];
  }

  /**
   * 执行标记检测
   */
  private async performMarkerDetection(): Promise<void> {
    if (!this.canvasElement || !this.canvasContext) {
      return;
    }

    try {
      // 获取图像数据
      const imageData = this.canvasContext.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);
      
      // 简化的标记检测模拟
      const markers = this.simulateMarkerDetection(imageData);
      
      for (const marker of markers) {
        this.emit('markerDetected', {
          id: marker.id,
          type: marker.type,
          transform: marker.transform,
          confidence: marker.confidence,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Marker detection error:', error);
    }
  }

  /**
   * 模拟标记检测
   */
  private simulateMarkerDetection(imageData: ImageData): Array<{
    id: number;
    type: string;
    transform: number[];
    confidence: number;
  }> {
    // 模拟检测到的标记
    const mockMarkers = [
      {
        id: 42,
        type: 'apriltag',
        transform: this.generateRandomTransform(),
        confidence: 0.85
      },
      {
        id: 123,
        type: 'artoolkit',
        transform: this.generateRandomTransform(),
        confidence: 0.72
      }
    ];

    // 随机返回检测结果
    if (Math.random() < 0.2) { // 20% 概率检测到
      return [mockMarkers[Math.floor(Math.random() * mockMarkers.length)]];
    }

    return [];
  }

  /**
   * 预加载追踪图像
   */
  private async preloadTrackingImages(): Promise<void> {
    if (!this.config.imageTracking?.images) {
      return;
    }

    const loadPromises = this.config.imageTracking.images.map(async (imageConfig) => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        return new Promise<HTMLImageElement>((resolve, reject) => {
          img.onload = () => {
            this.imageCache.set(imageConfig.name, img);
            resolve(img);
          };
          
          img.onerror = () => {
            reject(new Error(`Failed to load image: ${imageConfig.url}`));
          };
          
          img.src = imageConfig.url;
        });
      } catch (error) {
        console.warn(`Failed to preload image ${imageConfig.name}:`, error);
      }
    });

    await Promise.allSettled(loadPromises);
  }

  /**
   * 更新追踪的图像
   */
  private updateTrackedImages(newTrackedImages: Map<string, ARImageTrackingResult>): void {
    // 找出新增的追踪
    for (const [name, result] of newTrackedImages) {
      if (!this.trackedImages.has(name)) {
        this.emit('imageTrackingStarted', {
          name: result.name,
          transform: result.transform,
          measuredWidthInMeters: result.measuredWidthInMeters,
          measuredHeightInMeters: result.measuredHeightInMeters
        });
      }
    }

    // 找出丢失的追踪
    for (const [name, oldResult] of this.trackedImages) {
      if (!newTrackedImages.has(name)) {
        this.emit('imageTrackingLost', {
          name: oldResult.name
        });
      }
    }

    // 更新追踪结果
    this.trackedImages = newTrackedImages;

    // 发出追踪更新事件
    if (newTrackedImages.size > 0) {
      this.emit('imageTrackingUpdated', {
        trackedImages: Array.from(newTrackedImages.values())
      });
    }
  }

  /**
   * 生成随机变换矩阵
   */
  private generateRandomTransform(): number[] {
    // 生成 4x4 变换矩阵（简化版本）
    const position = {
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 2
    };

    const rotation = {
      x: Math.random() * Math.PI * 2,
      y: Math.random() * Math.PI * 2,
      z: Math.random() * Math.PI * 2
    };

    // 简化的变换矩阵生成
    return [
      Math.cos(rotation.y) * Math.cos(rotation.z), -Math.cos(rotation.y) * Math.sin(rotation.z), Math.sin(rotation.y), 0,
      Math.sin(rotation.x) * Math.sin(rotation.y) * Math.cos(rotation.z) + Math.cos(rotation.x) * Math.sin(rotation.z),
      -Math.sin(rotation.x) * Math.sin(rotation.y) * Math.sin(rotation.z) + Math.cos(rotation.x) * Math.cos(rotation.z),
      -Math.sin(rotation.x) * Math.cos(rotation.y), 0,
      -Math.cos(rotation.x) * Math.sin(rotation.y) * Math.cos(rotation.z) + Math.sin(rotation.x) * Math.sin(rotation.z),
      Math.cos(rotation.x) * Math.sin(rotation.y) * Math.sin(rotation.z) + Math.sin(rotation.x) * Math.cos(rotation.z),
      Math.cos(rotation.x) * Math.cos(rotation.y), 0,
      position.x, position.y, position.z, 1
    ];
  }

  /**
   * 获取当前追踪的图像
   */
  getTrackedImages(): ARImageTrackingResult[] {
    return Array.from(this.trackedImages.values());
  }

  /**
   * 获取追踪统计
   */
  getTrackingStats(): {
    totalTrackedImages: number;
    trackingHistory: number;
    detectionRate: number;
  } {
    return {
      totalTrackedImages: this.trackedImages.size,
      trackingHistory: this.trackedImages.size, // 简化统计
      detectionRate: this.trackedImages.size > 0 ? 0.8 : 0.0 // 模拟检测率
    };
  }

  /**
   * 获取活跃的标记
   */
  getActiveMarkers(): ARImageTrackingResult[] {
    return this.getTrackedImages();
  }

  /**
   * 开始检测
   */
  async startDetection(videoElement?: HTMLVideoElement): Promise<void> {
    if (videoElement) {
      this.videoElement = videoElement;
    }
    if (this.config.useMindAR) {
      await this.startMindAR();
    } else {
      this.start();
    }
  }

  /**
   * 停止检测
   */
  stopDetection(): void {
    if (this.config.useMindAR) {
      this.stopMindAR();
    } else {
      this.stop();
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ARMarkerConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };

    // 如果启用了图像追踪，重新预加载图像
    if (newConfig.imageTracking?.enabled && newConfig.imageTracking?.images) {
      this.preloadTrackingImages();
    }

    this.emit('configUpdated', { config: this.config });
  }

  /**
   * 销毁识别器
   */
  dispose(): void {
    this.stopDetection();
    
    if (this.canvasElement) {
      document.body.removeChild(this.canvasElement);
      this.canvasElement = null;
    }
    
    this.canvasContext = null;
    this.imageCache.clear();
    this.trackedImages.clear();
    if (this.mindarContainer?.parentElement) {
      this.mindarContainer.parentElement.removeChild(this.mindarContainer);
    }
    this.mindarContainer = null;
    
    this.removeAllListeners();
  }

  /**
   * 使用 MindAR 启动图像追踪
   */
  private async startMindAR(): Promise<void> {
    if (this.mindarThree) {
      await this.mindarThree.start();
      this.startMindARRenderLoop();
      this.emit('started');
      return;
    }

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.pointerEvents = 'none';
    container.style.width = '1px';
    container.style.height = '1px';
    container.style.overflow = 'hidden';
    container.style.top = '-10000px';
    document.body.appendChild(container);
    this.mindarContainer = container;

    try {
      let MindARThreeCtor: any = null;
      try {
        MindARThreeCtor = await this.ensureMindARESM();
      } catch {}
      if (!MindARThreeCtor) {
        await this.ensureMindARUMD();
        MindARThreeCtor = (window as any).MINDAR?.IMAGE?.MindARThree;
      }
      if (!MindARThreeCtor) throw new Error('MindARThree not available');

      this.mindarThree = new MindARThreeCtor({
        container: container,
        imageTargetSrc: this.config.mindarTargetSrc
      });

      const anchor = this.mindarThree.addAnchor(0);
      this.mindarAnchor = anchor;

      anchor.onTargetFound = () => {
        const tr = this.getMindARAnchorMatrix();
        const name = 'mindar-target-0';
        const result: ARImageTrackingResult = {
          name,
          index: 0,
          imageName: name,
          transform: tr,
          trackingState: 'tracking',
          measuredWidthInMeters: 0.1,
          measuredHeightInMeters: 0.055,
          isTracking: true,
          marker: {
            id: name,
            name,
            type: 'image',
            position: { x: 0, y: 0, z: 0 },
            size: { width: 0.1, height: 0.055 },
            confidence: 0.95,
            isTracking: true
          }
        };
        const map = new Map<string, ARImageTrackingResult>();
        map.set(name, result);
        this.updateTrackedImages(map);
        this.emit('markerDetected', { marker: result.marker });
      };

      anchor.onTargetLost = () => {
        const name = 'mindar-target-0';
        this.updateTrackedImages(new Map());
        this.emit('imageTrackingLost', { name });
        this.emit('markerLost', { markerId: name });
      };

      await this.mindarThree.start();
      this.startMindARRenderLoop();
      this.emit('started');
    } catch (err2) {
      console.error('MindAR load failed:', err2);
      this.start();
    }
  }

  private async ensureMindARESM(): Promise<any> {
    const existingImportMap = document.querySelector('script[type="importmap"][data-mindar-esm="true"]');
    if (!existingImportMap) {
      const map = document.createElement('script');
      map.type = 'importmap';
      map.setAttribute('data-mindar-esm', 'true');
      map.textContent = JSON.stringify({
        imports: {
          "three": "/vendor/build/three.module.js"
        }
      });
      document.head.appendChild(map);
    }
    try {
      const importer = Function('p', 'return import(p)');
      const mod = await importer('/vendor/build/mindar-image-three.prod.js');
      const MindARThree = (mod as any).MindARThree || (mod as any).default || (window as any).MINDAR?.IMAGE?.MindARThree;
      if (!MindARThree) throw new Error('MindARThree ESM not exported');
      return MindARThree;
    } catch (e) {
      throw e;
    }
  }

  private ensureMindARUMD(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const w = window as any;
      const loadScript = (src: string, isModule = false) => new Promise<void>((res, rej) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        if (isModule) s.type = 'module';
        s.onload = () => res();
        s.onerror = () => rej(new Error(`Failed to load script ${src}`));
        document.head.appendChild(s);
      });

      const run = async () => {
        if (!w.THREE) {
          try {
            const t = await import(/* @vite-ignore */ 'three');
            w.THREE = t as any;
          } catch {
            const candidates = [
              '/vendor/build/three.min.js',
              '/vendor/three.min.js',
              '/vendor/build/three.js',
              '/vendor/three.js'
            ];
            let okThree = false;
            for (const url of candidates) {
              try {
                await loadScript(url);
                if ((window as any).THREE) { okThree = true; break; }
              } catch {}
            }
            if (!okThree) throw new Error('THREE UMD not loaded from /vendor');
          }
          try {
            const T = w.THREE as any;
            if (T && !T.sRGBEncoding && T.SRGBColorSpace) T.sRGBEncoding = T.SRGBColorSpace;
            if (T && !T.LinearEncoding && T.LinearSRGBColorSpace) T.LinearEncoding = T.LinearSRGBColorSpace;
            if (T && !T.ColorManagement) T.ColorManagement = { enabled: true };
          } catch {}
        }

        if (!w.MINDAR || !w.MINDAR.IMAGE || !w.MINDAR.IMAGE.MindARThree) {
          const candidates: Array<{ url: string; module: boolean }> = [
            { url: '/vendor/build/mindar-image-three.prod.js', module: true },
            { url: '/vendor/build/mindar-image-three.min.js', module: false },
            { url: '/vendor/build/mindar-image-three.js', module: false },
            { url: '/vendor/mindar-image-three.prod.js', module: true },
            { url: '/vendor/mindar-image-three.min.js', module: false },
            { url: '/vendor/mindar-image-three.js', module: false }
          ];
          let ok = false;
          for (const c of candidates) {
            try {
              if (c.module) {
                if (!document.querySelector('script[type="importmap"][data-mindar-local="true"]')) {
                  const map = document.createElement('script');
                  map.type = 'importmap';
                  map.setAttribute('data-mindar-local', 'true');
                  map.textContent = JSON.stringify({ imports: { three: '/vendor/build/three.module.js' } });
                  document.head.appendChild(map);
                }
              }
              await loadScript(c.url, c.module);
              if (w.MINDAR && w.MINDAR.IMAGE && w.MINDAR.IMAGE.MindARThree) { ok = true; break; }
            } catch {}
          }
          if (!ok) throw new Error('MindARThree UMD not loaded from /vendor');
        }
      };

      run().then(() => resolve()).catch(reject);
    });
  }

  private startMindARRenderLoop(): void {
    if (!this.mindarThree || this.mindarAnimating) return;
    this.mindarAnimating = true;
    const { renderer, scene, camera } = this.mindarThree;
    renderer.setAnimationLoop(() => {
      if (this.trackedImages.size > 0) {
        const name = 'mindar-target-0';
        const tr = this.getMindARAnchorMatrix();
        const existed = this.trackedImages.get(name);
        if (existed) {
          existed.transform = tr;
          this.updateTrackedImages(new Map([[name, existed]]));
          this.emit('markerUpdated', { marker: existed.marker });
        }
      }
      renderer.render(scene, camera);
    });
  }

  private stopMindAR(): void {
    if (this.mindarThree) {
      try {
        this.mindarThree.stop();
        this.mindarThree.renderer.setAnimationLoop(null);
      } catch {}
    }
    this.mindarAnimating = false;
    this.trackedImages.clear();
    this.emit('stopped');
  }

  private getMindARAnchorMatrix(): number[] {
    try {
      const group = this.mindarAnchor?.group;
      if (group && group.matrix) {
        const m = group.matrix as any;
        const arr = Array.isArray(m) ? m : (m.elements || []);
        if (arr && arr.length === 16) return arr.slice();
      }
    } catch {}
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  }
}