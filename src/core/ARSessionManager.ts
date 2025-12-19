import { EventEmitter } from '../utils/EventEmitter';
import { WebAREngine } from './WebAREngine';
import type { ARMarkerConfig } from './ARMarkerDetector';
import { ARSession, ARSessionConfig, AREvent } from '../types/webar';

/**
 * WebAR 会话管理器
 * 负责 AR 会话的生命周期管理和配置
 */
export class ARSessionManager extends EventEmitter {
  private engine: WebAREngine | null = null;
  private currentSession: ARSession | null = null;
  private sessionHistory: ARSession[] = [];
  private isInitialized = false;
  private canvas: HTMLCanvasElement | null = null;

  constructor() {
    super();
  }

  /**
   * 初始化会话管理器
   */
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Session manager already initialized');
    }

    this.canvas = canvas;
    this.isInitialized = true;

    // 检查 WebXR 支持
    await this.checkWebXRSupport();

    this.emit('initialized');
  }

  /**
   * 检查 WebXR 支持
   */
  private async checkWebXRSupport(): Promise<void> {
    if (!navigator.xr) {
      console.warn('WebXR not supported, will use fallback mode');
      this.emit('warning', { 
        type: 'webxr-not-supported', 
        message: 'WebXR not supported, using simulation mode' 
      });
      return;
    }

    try {
      const isARSupported = await navigator.xr.isSessionSupported('immersive-ar');
      const isVRSupported = await navigator.xr.isSessionSupported('immersive-vr');

      console.log(`AR Support: ${isARSupported}, VR Support: ${isVRSupported}`);
      
      this.emit('webxr-support', { 
        arSupported: isARSupported, 
        vrSupported: isVRSupported 
      });
    } catch (error) {
      console.error('Error checking WebXR support:', error);
      this.emit('warning', { 
        type: 'webxr-check-failed', 
        message: 'Failed to check WebXR support' 
      });
    }
  }

  /**
   * 启动 AR 会话
   */
  async startSession(config: ARSessionConfig = {}): Promise<ARSession> {
    if (!this.isInitialized) {
      throw new Error('Session manager not initialized');
    }

    if (this.currentSession) {
      throw new Error('Session already active');
    }

    // 创建引擎实例
    this.engine = new WebAREngine(this.canvas!, this.isDebugMode());
    
    // 设置引擎事件监听
    this.setupEngineEventListeners();

    try {
      // 启动会话
      const session = await this.engine.startSession(config);
      this.currentSession = session;
      this.sessionHistory.push(session);

      this.emit('sessionStarted', { session });
      return session;
    } catch (error) {
      this.emit('error', { 
        type: 'session-start-failed', 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * 停止当前会话
   */
  async stopSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const session = this.currentSession;
    
    try {
      this.engine?.stopSession();
      this.currentSession = null;
      
      this.emit('sessionStopped', { session });
    } catch (error) {
      this.emit('error', { 
        type: 'session-stop-failed', 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * 暂停会话
   */
  pauseSession(): void {
    if (!this.currentSession) {
      return;
    }

    // 这里可以实现暂停逻辑，比如暂停渲染循环
    this.emit('sessionPaused', { session: this.currentSession });
  }

  /**
   * 恢复会话
   */
  resumeSession(): void {
    if (!this.currentSession) {
      return;
    }

    // 这里可以实现恢复逻辑，比如恢复渲染循环
    this.emit('sessionResumed', { session: this.currentSession });
  }

  /**
   * 重置会话
   */
  async resetSession(): Promise<ARSession> {
    await this.stopSession();
    return await this.startSession();
  }

  /**
   * 获取当前会话信息
   */
  getCurrentSession(): ARSession | null {
    return this.currentSession;
  }

  /**
   * 获取会话历史
   */
  getSessionHistory(): ARSession[] {
    return [...this.sessionHistory];
  }

  /**
   * 获取会话统计
   */
  getSessionStats() {
    const totalSessions = this.sessionHistory.length;
    const activeSession = this.currentSession;
    
    let totalDuration = 0;
    let totalFrames = 0;
    
    this.sessionHistory.forEach(session => {
      if (!session.isActive) {
        const duration = session.startTime - Date.now();
        totalDuration += Math.abs(duration);
      }
      totalFrames += session.frameCount;
    });

    return {
      totalSessions,
      activeSession: activeSession !== null,
      averageDuration: totalSessions > 0 ? totalDuration / totalSessions : 0,
      totalFrames,
      averageFPS: totalFrames / (totalDuration / 1000)
    };
  }

  /**
   * 设置引擎事件监听器
   */
  private setupEngineEventListeners(): void {
    if (!this.engine) return;

    this.engine.on('sessionStart', (event: AREvent) => {
      this.emit('engineEvent', event);
    });

    this.engine.on('sessionEnd', (event: AREvent) => {
      this.emit('engineEvent', event);
    });

    this.engine.on('frameUpdate', (data: any) => {
      this.emit('frameUpdate', data);
    });

    this.engine.on('planeDetected', (data: any) => {
      this.emit('planeDetected', data);
    });

    this.engine.on('modelLoaded', (data: any) => {
      this.emit('modelLoaded', data);
    });

    this.engine.on('error', (error: any) => {
      this.emit('engineError', error);
    });

    // 标记检测事件
    this.engine.on('markerAdded', (data: any) => {
      // 将引擎的 markerAdded 规范化为上层使用的 markerDetected
      this.emit('markerDetected', data);
    });

    this.engine.on('markerRemoved', (data: any) => {
      // 将引擎的 markerRemoved 规范化为上层使用的 markerLost
      this.emit('markerLost', data);
    });

    this.engine.on('markerDetected', (data: any) => {
      this.emit('markerDetected', data);
    });

    this.engine.on('markerLost', (data: any) => {
      this.emit('markerLost', data);
    });

    this.engine.on('markerUpdated', (data: any) => {
      this.emit('markerUpdated', data);
    });

    this.engine.on('markerDetectionStarted', (data: any) => {
      this.emit('markerDetectionStarted', data);
    });

    this.engine.on('markerDetectionStopped', (data: any) => {
      this.emit('markerDetectionStopped', data);
    });
  }

  updateMarkerDetectionConfig(config: Partial<ARMarkerConfig>): void {
    this.engine.updateMarkerDetectionConfig(config);
  }

  /**
   * 获取引擎实例
   */
  getEngine(): WebAREngine | null {
    return this.engine;
  }

  /**
   * 检查是否处于调试模式
   */
  private isDebugMode(): boolean {
    // 可以通过 URL 参数控制
    return window.location.search.includes('debug=true');
  }

  /**
   * 获取调试信息
   */
  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      currentSession: this.currentSession,
      sessionHistory: this.sessionHistory,
      engine: this.engine ? this.engine.getDebugInfo() : null
    };
  }

  /**
   * 销毁会话管理器
   */
  dispose(): void {
    this.stopSession();
    
    if (this.engine) {
      this.engine.dispose();
      this.engine = null;
    }

    this.removeAllListeners();
    this.isInitialized = false;
  }
}