import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARModel } from '../types/webar';

/**
 * 3D 模型加载器
 * 支持 GLTF/GLB 格式，提供缓存和错误处理
 */
export class ModelLoader {
  private cache: Map<string, THREE.Object3D> = new Map();
  private loadingPromises: Map<string, Promise<THREE.Object3D>> = new Map();
  private textureLoader: THREE.TextureLoader;
  private baseURL: string;
  private gltfLoader: GLTFLoader;

  constructor(baseURL = '') {
    this.baseURL = baseURL;
    this.textureLoader = new THREE.TextureLoader();
    this.gltfLoader = new GLTFLoader();
    this.setupTextureLoader();
  }

  /**
   * 设置纹理加载器
   */
  private setupTextureLoader(): void {
    // 设置跨域支持
    this.textureLoader.crossOrigin = 'anonymous';
    
    // 添加加载错误处理
    this.textureLoader.manager.onError = (url: string) => {
      console.warn(`Failed to load texture: ${url}`);
    };
  }

  /**
   * 加载模型
   */
  async loadModel(model: ARModel): Promise<THREE.Object3D> {
    const cacheKey = this.getCacheKey(model);

    // 检查缓存
    if (this.cache.has(cacheKey)) {
      const cachedObject = this.cache.get(cacheKey)!;
      return this.cloneObject(cachedObject, model);
    }

    // 检查是否正在加载
    if (this.loadingPromises.has(cacheKey)) {
      const loadedObject = await this.loadingPromises.get(cacheKey)!;
      return this.cloneObject(loadedObject, model);
    }

    // 开始加载
    const loadPromise = this.loadModelFromURL(model);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const object = await loadPromise;
      this.cache.set(cacheKey, object);
      return this.cloneObject(object, model);
    } catch (error) {
      console.error(`Failed to load model ${model.name}:`, error);
      throw error;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  /**
   * 从 URL 加载模型
   */
  private async loadModelFromURL(model: ARModel): Promise<THREE.Object3D> {
    const url = this.resolveURL(model.url);

    switch (model.type) {
      case 'gltf':
      case 'glb':
        return await this.loadGLTF(url);
      case 'obj':
        return await this.loadOBJ(url);
      default:
        throw new Error(`Unsupported model type: ${model.type}`);
    }
  }

  /**
   * 加载 GLTF/GLB 模型
   */
  private async loadGLTF(url: string): Promise<THREE.Object3D> {
    return new Promise<THREE.Object3D>((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const scene = gltf.scene || new THREE.Group();
          resolve(scene);
        },
        undefined,
        (err) => {
          resolve(this.createPlaceholderGeometry());
        }
      );
    });
  }

  /**
   * 加载 OBJ 模型
   */
  private async loadOBJ(url: string): Promise<THREE.Object3D> {
    try {
      // 由于 OBJLoader 有复杂的依赖，这里先用基础几何体模拟
      // 在实际项目中，应该导入 OBJLoader
      return this.createPlaceholderGeometry();
    } catch (error) {
      console.warn('OBJ loading failed, using placeholder:', error);
      return this.createPlaceholderGeometry();
    }
  }

  /**
   * 创建占位几何体
   */
  private createPlaceholderGeometry(): THREE.Object3D {
    // 创建一个彩色的立方体作为占位符
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
      transparent: true,
      opacity: 0.9,
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

    return mesh;
  }

  /**
   * 克隆对象并应用模型变换
   */
  private cloneObject(original: THREE.Object3D, model: ARModel): THREE.Object3D {
    const cloned = original.clone();
    
    // 应用位置变换
    cloned.position.set(model.position.x, model.position.y, model.position.z);
    
    // 应用旋转变换
    if (model.rotation.w !== undefined) {
      // 四元数旋转
      cloned.setRotationFromQuaternion(
        new THREE.Quaternion(model.rotation.x, model.rotation.y, model.rotation.z, model.rotation.w)
      );
    } else {
      // 欧拉角旋转
      cloned.rotation.set(model.rotation.x, model.rotation.y, model.rotation.z);
    }
    
    // 应用缩放变换
    cloned.scale.set(model.scale.x, model.scale.y, model.scale.z);
    
    // 设置可见性
    cloned.visible = model.isVisible;
    
    // 添加用户数据
    cloned.userData = {
      modelId: model.id,
      modelName: model.name,
      modelType: model.type,
      isPlaceholder: true // 标记这是占位符
    };

    return cloned;
  }

  /**
   * 创建自定义几何体
   */
  createCustomGeometry(config: {
    type: 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus';
    params: any;
    material?: THREE.Material;
  }): THREE.Object3D {
    let geometry: THREE.BufferGeometry;

    switch (config.type) {
      case 'box':
        geometry = new THREE.BoxGeometry(config.params.width || 1, config.params.height || 1, config.params.depth || 1);
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(config.params.radius || 1, config.params.widthSegments || 32, config.params.heightSegments || 16);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(config.params.radiusTop || 1, config.params.radiusBottom || 1, config.params.height || 1);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(config.params.radius || 1, config.params.height || 1);
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(config.params.radius || 1, config.params.tube || 0.4, config.params.radialSegments || 8, config.params.tubularSegments || 6);
        break;
      default:
        throw new Error(`Unsupported geometry type: ${config.type}`);
    }

    const material = config.material || new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6)
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  /**
   * 创建文本模型
   */
  createTextModel(text: string, config: {
    fontSize?: number;
    color?: string | number;
    backgroundColor?: string | number;
  } = {}): THREE.Object3D {
    // 创建文本纹理
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    
    const fontSize = config.fontSize || 64;
    context.font = `bold ${fontSize}px Arial, sans-serif`;
    
    // 测量文本尺寸
    const metrics = context.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;
    
    // 设置画布尺寸
    canvas.width = Math.max(textWidth + 20, 128);
    canvas.height = Math.max(textHeight + 20, 128);
    
    // 重新设置字体（因为画布尺寸改变了）
    context.font = `bold ${fontSize}px Arial, sans-serif`;
    
    // 绘制背景
    if (config.backgroundColor) {
      context.fillStyle = typeof config.backgroundColor === 'string' ? 
        config.backgroundColor : `#${config.backgroundColor.toString(16).padStart(6, '0')}`;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // 绘制文本
    context.fillStyle = typeof config.color === 'string' ? 
      config.color : `#${(config.color || 0xffffff).toString(16).padStart(6, '0')}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // 创建平面几何体来显示文本
    const geometry = new THREE.PlaneGeometry(canvas.width / 100, canvas.height / 100);
    const material = new THREE.MeshBasicMaterial({ 
      map: texture, 
      transparent: true,
      alphaTest: 0.1
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { isText: true, text };
    
    return mesh;
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(model: ARModel): string {
    return `${model.url}_${model.type}`;
  }

  /**
   * 解析 URL
   */
  private resolveURL(url: string): string {
    if (url.startsWith('http') || url.startsWith('//')) {
      return url;
    }
    return this.baseURL + url;
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 从缓存中移除特定模型
   */
  removeFromCache(url: string, type: string): boolean {
    const cacheKey = `${url}_${type}`;
    return this.cache.delete(cacheKey);
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    totalModels: number;
    cacheSize: number;
    memoryEstimate: number;
  } {
    let memoryEstimate = 0;
    
    this.cache.forEach(object => {
      // 粗略估算内存使用
      memoryEstimate += this.estimateObjectMemory(object);
    });

    return {
      totalModels: this.cache.size,
      cacheSize: this.cache.size,
      memoryEstimate: memoryEstimate / 1024 / 1024 // MB
    };
  }

  /**
   * 估算对象内存使用
   */
  private estimateObjectMemory(object: THREE.Object3D): number {
    let size = 1024; // 基础对象大小
    
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          size += child.geometry.attributes.position?.count * 12 || 0; // 位置属性
          size += child.geometry.attributes.normal?.count * 12 || 0; // 法线属性
          size += child.geometry.attributes.uv?.count * 8 || 0; // UV属性
          size += child.geometry.index?.count * 4 || 0; // 索引
        }
        
        if (child.material) {
          size += 512; // 材质基础大小
          
          if ((child.material as any).map) {
            size += 1024 * 1024; // 纹理估算 1MB
          }
        }
      }
    });
    
    return size;
  }

  /**
   * 销毁加载器
   */
  dispose(): void {
    this.clearCache();
    this.loadingPromises.clear();
    // TextureLoader doesn't have dispose method in Three.js
    // this.textureLoader.dispose();
  }
}