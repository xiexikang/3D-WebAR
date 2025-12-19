import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ARMarkerDetector, ARMarkerConfig } from '../core/ARMarkerDetector';
import { EventEmitter } from '../utils/EventEmitter';

/**
 * AR 标记追踪组件 Props
 */
interface ARMarkerTrackerProps {
  videoElement?: HTMLVideoElement;
  config?: ARMarkerConfig;
  onImageTracked?: (trackingData: any) => void;
  onQRCodeDetected?: (qrData: any) => void;
  onMarkerDetected?: (markerData: any) => void;
  onError?: (error: any) => void;
  debugMode?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * AR 标记追踪组件
 * 提供图像追踪、二维码识别和标记检测的可视化界面
 */
export const ARMarkerTracker: React.FC<ARMarkerTrackerProps> = ({
  videoElement,
  config = {},
  onImageTracked,
  onQRCodeDetected,
  onMarkerDetected,
  onError,
  debugMode = false,
  className,
  style
}) => {
  const detectorRef = useRef<ARMarkerDetector | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [trackedImages, setTrackedImages] = useState<any[]>([]);
  const [detectedQRCodes, setDetectedQRCodes] = useState<any[]>([]);
  const [detectedMarkers, setDetectedMarkers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalDetections: 0,
    frameCount: 0,
    detectionRate: 0
  });

  /**
   * 初始化标记追踪器
   */
  useEffect(() => {
    const initializeTracker = async () => {
      try {
        // 创建视频元素（如果没有提供）
        let video = videoElement;
        if (!video) {
          video = document.createElement('video');
          video.autoplay = true;
          video.playsInline = true;
          video.muted = true;
          
          // 尝试访问摄像头
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment' }
            });
            video.srcObject = stream;
          } catch (err) {
            console.warn('Failed to access camera, using mock video');
            // 如果没有摄像头权限，使用模拟数据
          }
        }

        // 创建检测器
        const detector = new ARMarkerDetector({
          ...config,
          debugMode
        });
        
        detectorRef.current = detector;

        // 设置事件监听器
        setupEventListeners(detector);

        // 初始化检测器
        await detector.initialize(video);

        setIsInitialized(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        onError?.(err);
      }
    };

    initializeTracker();

    // 清理函数
    return () => {
      if (detectorRef.current) {
        detectorRef.current.dispose();
        detectorRef.current = null;
      }
    };
  }, [videoElement, config, debugMode, onError]);

  /**
   * 设置事件监听器
   */
  const setupEventListeners = useCallback((detector: ARMarkerDetector) => {
    // 图像追踪事件
    detector.on('imageTrackingStarted', (data: any) => {
      setTrackedImages(prev => [...prev, data]);
      onImageTracked?.(data);
      updateStats('image');
    });

    detector.on('imageTrackingUpdated', (data: any) => {
      setTrackedImages(data.trackedImages || []);
      updateStats('image');
    });

    detector.on('imageTrackingLost', (data: any) => {
      setTrackedImages(prev => prev.filter(item => item.name !== data.name));
      updateStats('image');
    });

    // 二维码检测事件
    detector.on('qrCodeDetected', (data: any) => {
      setDetectedQRCodes(prev => {
        const filtered = prev.filter(qr => qr.data !== data.data);
        return [...filtered, { ...data, id: Date.now() }];
      });
      onQRCodeDetected?.(data);
      updateStats('qr');
    });

    // 标记检测事件
    detector.on('markerDetected', (data: any) => {
      setDetectedMarkers(prev => {
        const filtered = prev.filter(marker => marker.id !== data.id);
        return [...filtered, { ...data, id: Date.now() }];
      });
      onMarkerDetected?.(data);
      updateStats('marker');
    });

    // 错误事件
    detector.on('error', (data: any) => {
      setError(data.error);
      onError?.(data.error);
    });
  }, [onImageTracked, onQRCodeDetected, onMarkerDetected, onError]);

  /**
   * 更新统计信息
   */
  const updateStats = useCallback((type: string) => {
    setStats(prev => ({
      totalDetections: prev.totalDetections + 1,
      frameCount: prev.frameCount + 1,
      detectionRate: Math.min(100, (prev.totalDetections + 1) / (prev.frameCount + 1) * 100)
    }));
  }, []);

  /**
   * 开始追踪
   */
  const startTracking = useCallback(() => {
    if (!detectorRef.current) return;

    try {
      detectorRef.current.start();
      setIsTracking(true);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start tracking';
      setError(errorMessage);
      onError?.(err);
    }
  }, [onError]);

  /**
   * 停止追踪
   */
  const stopTracking = useCallback(() => {
    if (!detectorRef.current) return;

    try {
      detectorRef.current.stop();
      setIsTracking(false);
      
      // 清空检测结果
      setTrackedImages([]);
      setDetectedQRCodes([]);
      setDetectedMarkers([]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop tracking';
      setError(errorMessage);
      onError?.(err);
    }
  }, [onError]);

  /**
   * 清空检测结果
   */
  const clearResults = useCallback(() => {
    setTrackedImages([]);
    setDetectedQRCodes([]);
    setDetectedMarkers([]);
    setStats({
      totalDetections: 0,
      frameCount: 0,
      detectionRate: 0
    });
  }, []);

  /**
   * 渲染追踪可视化
   */
  const renderTrackingVisualization = () => {
    if (!debugMode) return null;

    return (
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        maxWidth: '300px',
        zIndex: 100
      }}>
        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
          🔍 AR 标记追踪
        </div>
        
        <div style={{ marginBottom: '5px' }}>
          状态: {isTracking ? '🟢 追踪中' : '🔴 已停止'}
        </div>
        
        <div style={{ marginBottom: '5px' }}>
          图像追踪: {trackedImages.length} 个
        </div>
        
        <div style={{ marginBottom: '5px' }}>
          二维码: {detectedQRCodes.length} 个
        </div>
        
        <div style={{ marginBottom: '5px' }}>
          标记: {detectedMarkers.length} 个
        </div>
        
        <div style={{ marginBottom: '5px' }}>
          检测率: {stats.detectionRate.toFixed(1)}%
        </div>
        
        <div style={{ fontSize: '10px', opacity: 0.8 }}>
          总检测: {stats.totalDetections} 次
        </div>
      </div>
    );
  };

  /**
   * 渲染检测结果详情
   */
  const renderDetectionDetails = () => {
    if (!debugMode) return null;

    const hasResults = trackedImages.length > 0 || detectedQRCodes.length > 0 || detectedMarkers.length > 0;
    
    if (!hasResults) return null;

    return (
      <div style={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '11px',
        maxWidth: '400px',
        maxHeight: '200px',
        overflowY: 'auto',
        zIndex: 100
      }}>
        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
          📋 检测结果详情
        </div>
        
        {trackedImages.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>图像追踪:</div>
            {trackedImages.map((image, index) => (
              <div key={index} style={{ marginLeft: '10px', fontSize: '10px' }}>
                • {image.name} - {image.isTracking ? '✅' : '❌'}
              </div>
            ))}
          </div>
        )}
        
        {detectedQRCodes.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ color: '#2196F3', fontWeight: 'bold' }}>二维码:</div>
            {detectedQRCodes.slice(-3).map((qr, index) => (
              <div key={index} style={{ marginLeft: '10px', fontSize: '10px' }}>
                • {qr.data.substring(0, 30)}{qr.data.length > 30 ? '...' : ''}
              </div>
            ))}
          </div>
        )}
        
        {detectedMarkers.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ color: '#FF9800', fontWeight: 'bold' }}>标记:</div>
            {detectedMarkers.slice(-3).map((marker, index) => (
              <div key={index} style={{ marginLeft: '10px', fontSize: '10px' }}>
                • ID: {marker.id} ({marker.type}) - {marker.confidence.toFixed(2)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className={`ar-marker-tracker ${className || ''}`}
      style={{
        position: 'relative',
        ...style
      }}
    >
      {/* 控制面板 */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {!isInitialized ? (
          <div style={{
            padding: '10px 15px',
            backgroundColor: '#FFC107',
            color: '#333',
            borderRadius: '5px',
            fontSize: '14px'
          }}>
            🔄 初始化中...
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={isTracking ? stopTracking : startTracking}
              style={{
                padding: '8px 16px',
                backgroundColor: isTracking ? '#f44336' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {isTracking ? '⏹️ 停止' : '▶️ 开始'}
            </button>
            
            <button
              onClick={clearResults}
              style={{
                padding: '8px 16px',
                backgroundColor: '#9E9E9E',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🗑️ 清空
            </button>
          </div>
        )}
      </div>

      {/* 错误显示 */}
      {error && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          backgroundColor: '#ffebee',
          color: '#c62828',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '12px',
          maxWidth: '300px',
          zIndex: 100
        }}>
          ❌ {error}
        </div>
      )}

      {/* 调试可视化 */}
      {debugMode && renderTrackingVisualization()}
      {debugMode && renderDetectionDetails()}

      {/* 配置信息 */}
      {debugMode && isInitialized && (
        <div style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '5px',
          fontSize: '10px',
          zIndex: 100
        }}>
          <div>📷 摄像头: {videoElement ? '已连接' : '模拟模式'}</div>
          <div>🎯 图像追踪: {config.imageTracking?.enabled ? '开启' : '关闭'}</div>
          <div>📱 二维码: {config.qrCodeTracking?.enabled ? '开启' : '关闭'}</div>
          <div>🏷️ 标记: {config.markerDetection?.enabled ? '开启' : '关闭'}</div>
        </div>
      )}
    </div>
  );
};

export default ARMarkerTracker;