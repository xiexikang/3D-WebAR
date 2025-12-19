/**
 * 二维码检测器
 * 提供二维码和条形码识别功能
 */
export class QRCodeDetector {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private isSupported: boolean;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.isSupported = this.checkBrowserSupport();
  }

  /**
   * 检查浏览器支持
   */
  private checkBrowserSupport(): boolean {
    // 检查是否支持必要的 API
    return !!(
      window.CanvasRenderingContext2D &&
      this.context &&
      this.context.getImageData
    );
  }

  /**
   * 从视频流中检测二维码
   */
  async detectFromVideo(video: HTMLVideoElement): Promise<QRCodeResult[]> {
    if (!this.isSupported || video.readyState !== 4) {
      return [];
    }

    try {
      // 设置画布尺寸
      this.canvas.width = Math.min(video.videoWidth, 640);
      this.canvas.height = Math.min(video.videoHeight, 480);

      // 绘制视频帧到画布
      this.context.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);

      // 获取图像数据
      const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);

      // 检测二维码
      return await this.detectFromImageData(imageData);
    } catch (error) {
      console.error('QR code detection from video failed:', error);
      return [];
    }
  }

  /**
   * 从图像数据中检测二维码
   */
  async detectFromImageData(imageData: ImageData): Promise<QRCodeResult[]> {
    if (!this.isSupported) {
      return [];
    }

    try {
      // 简化的二维码检测实现
      // 实际项目中应该使用 jsQR 或类似的库
      return this.simulateQRDetection(imageData);
    } catch (error) {
      console.error('QR code detection failed:', error);
      return [];
    }
  }

  /**
   * 从图像元素中检测二维码
   */
  async detectFromImage(img: HTMLImageElement): Promise<QRCodeResult[]> {
    if (!this.isSupported) {
      return [];
    }

    try {
      // 设置画布尺寸
      this.canvas.width = img.naturalWidth || img.width;
      this.canvas.height = img.naturalHeight || img.height;

      // 绘制图像到画布
      this.context.drawImage(img, 0, 0);

      // 获取图像数据
      const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);

      // 检测二维码
      return await this.detectFromImageData(imageData);
    } catch (error) {
      console.error('QR code detection from image failed:', error);
      return [];
    }
  }

  /**
   * 模拟二维码检测（用于演示）
   */
  private simulateQRDetection(imageData: ImageData): QRCodeResult[] {
    const results: QRCodeResult[] = [];

    // 模拟检测到的二维码数据
    const mockData = [
      {
        data: 'https://github.com/webar-project',
        format: 'qr_code' as const,
        location: {
          topLeft: { x: 100, y: 100 },
          topRight: { x: 300, y: 100 },
          bottomLeft: { x: 100, y: 300 },
          bottomRight: { x: 300, y: 300 }
        }
      },
      {
        data: 'WebAR-Platform-v1.0',
        format: 'qr_code' as const,
        location: {
          topLeft: { x: 400, y: 150 },
          topRight: { x: 550, y: 150 },
          bottomLeft: { x: 400, y: 300 },
          bottomRight: { x: 550, y: 300 }
        }
      }
    ];

    // 随机返回检测结果（模拟不稳定的检测）
    if (Math.random() < 0.3) { // 30% 概率检测到
      const mockResult = mockData[Math.floor(Math.random() * mockData.length)];
      
      results.push({
        data: mockResult.data,
        format: mockResult.format,
        location: mockResult.location,
        confidence: 0.8 + Math.random() * 0.2, // 0.8-1.0
        timestamp: Date.now()
      });
    }

    return results;
  }

  /**
   * 检测条形码
   */
  async detectBarcodes(imageData: ImageData): Promise<BarcodeResult[]> {
    if (!this.isSupported) {
      return [];
    }

    try {
      // 简化的条形码检测模拟
      return this.simulateBarcodeDetection(imageData);
    } catch (error) {
      console.error('Barcode detection failed:', error);
      return [];
    }
  }

  /**
   * 模拟条形码检测
   */
  private simulateBarcodeDetection(imageData: ImageData): BarcodeResult[] {
    const results: BarcodeResult[] = [];

    // 模拟检测到的条形码数据
    const mockData = [
      {
        data: '1234567890123',
        format: 'ean_13' as const,
        location: { x: 200, y: 100, width: 150, height: 50 }
      },
      {
        data: '987654321',
        format: 'ean_8' as const,
        location: { x: 100, y: 200, width: 120, height: 40 }
      }
    ];

    // 随机返回检测结果
    if (Math.random() < 0.2) { // 20% 概率检测到
      const mockResult = mockData[Math.floor(Math.random() * mockData.length)];
      
      results.push({
        data: mockResult.data,
        format: mockResult.format,
        location: mockResult.location,
        confidence: 0.7 + Math.random() * 0.3, // 0.7-1.0
        timestamp: Date.now()
      });
    }

    return results;
  }

  /**
   * 获取检测器状态
   */
  getStatus(): QRDetectorStatus {
    return {
      isSupported: this.isSupported,
      canvasSize: {
        width: this.canvas.width,
        height: this.canvas.height
      },
      lastDetectionTime: Date.now()
    };
  }

  /**
   * 销毁检测器
   */
  dispose(): void {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

/**
 * 二维码检测结果
 */
export interface QRCodeResult {
  data: string;
  format: 'qr_code';
  location: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
  };
  confidence: number;
  timestamp: number;
}

/**
 * 条形码检测结果
 */
export interface BarcodeResult {
  data: string;
  format: 'ean_13' | 'ean_8' | 'upc_a' | 'upc_e' | 'code_128' | 'code_39';
  location: { x: number; y: number; width: number; height: number };
  confidence: number;
  timestamp: number;
}

/**
 * 检测器状态
 */
export interface QRDetectorStatus {
  isSupported: boolean;
  canvasSize: { width: number; height: number };
  lastDetectionTime: number;
}