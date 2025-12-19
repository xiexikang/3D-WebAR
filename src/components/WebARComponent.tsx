import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { WebAREngine } from '../core/WebAREngine';
import { ARSessionManager } from '../core/ARSessionManager';
import { ARSession, ARModel, ARDebugInfo, ARMarker } from '../types/webar';
import { ModelLoader } from '../core/ModelLoader';
import { ARInteractionSystem } from '../core/ARInteractionSystem';
import { ARInteractionPanel } from './ARInteractionPanel';
// TransformControls 动态导入以避免类型声明缺失问题

/**
 * WebAR React 组件 Props
 */
interface WebARComponentProps {
  width?: number;
  height?: number;
  debugMode?: boolean;
  theme?: 'indigo' | 'teal' | 'amber' | 'pink';
  onSessionStart?: (session: ARSession) => void;
  onSessionEnd?: (session: ARSession) => void;
  onModelLoaded?: (model: ARModel) => void;
  onError?: (error: any) => void;
  className?: string;
  style?: React.CSSProperties;
  autoStart?: boolean;
}

/**
 * WebAR 主组件
 * 提供 React 接口和状态管理
 */
export const WebARComponent: React.FC<WebARComponentProps> = ({
  width = 800,
  height = 600,
  theme = 'indigo',
  onSessionStart,
  onSessionEnd,
  onModelLoaded,
  onError,
  className,
  style,
  autoStart = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionManagerRef = useRef<ARSessionManager | null>(null);
  const modelLoaderRef = useRef<ModelLoader | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  
  const [models, setModels] = useState<ARModel[]>([]);
  const [markers, setMarkers] = useState<ARMarker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkerDetectionActive, setIsMarkerDetectionActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [interactionSystem, setInteractionSystem] = useState<ARInteractionSystem | null>(null);
  const [showInteractionPanel, setShowInteractionPanel] = useState(false);
  const selectedObjectRef = useRef<THREE.Object3D | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [placeMode, setPlaceMode] = useState(false);
  const [flipAxis, setFlipAxis] = useState<'x' | 'y' | 'z'>('y');
  const [flipMode, setFlipMode] = useState<'world' | 'view' | 'local'>('world');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const DUCK_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb';
  const HELMET_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb';
  const FOX_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Fox/glTF-Binary/Fox.glb';
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(true);
  const [autoResume, setAutoResume] = useState(autoStart);
  const [isStopping, setIsStopping] = useState(false);
  const transformControlsRef = useRef<any>(null);
  const [isTransformDragging, setIsTransformDragging] = useState(false);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [translationSnap, setTranslationSnap] = useState(0.1);
  const [rotationSnap, setRotationSnap] = useState(Math.PI / 18);
  const [scaleSnap, setScaleSnap] = useState(0.05);
  const [helpLang, setHelpLang] = useState<'zh' | 'en'>('zh');
  const [helpLarge, setHelpLarge] = useState(false);
  const [cmdText, setCmdText] = useState('');
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const [gridVisible, setGridVisible] = useState(false);
  const [gridDivisions, setGridDivisions] = useState(20);
  const [gridSize, setGridSize] = useState(20);
  const [gridMode, setGridMode] = useState<'front' | 'ground'>('front');
  const [gridEdit, setGridEdit] = useState(false);
  const [useMindAR, setUseMindAR] = useState(false);
  const [mindTarget, setMindTarget] = useState<string>('');
  const showMindARControls = false;
  const mindFileRef = useRef<HTMLInputElement>(null);
  const attachedMarkersRef = useRef<Set<string>>(new Set());

  const palette = React.useMemo(() => {
    const map: Record<string, { primary: string; secondary: string }> = {
      indigo: { primary: 'linear-gradient(135deg, #6366f1, #06b6d4)', secondary: 'linear-gradient(135deg, #9333ea, #06b6d4)' },
      teal: { primary: 'linear-gradient(135deg, #0ea5e9, #14b8a6)', secondary: 'linear-gradient(135deg, #10b981, #06b6d4)' },
      amber: { primary: 'linear-gradient(135deg, #f59e0b, #ef4444)', secondary: 'linear-gradient(135deg, #f97316, #f43f5e)' },
      pink: { primary: 'linear-gradient(135deg, #ec4899, #6366f1)', secondary: 'linear-gradient(135deg, #db2777, #06b6d4)' }
    };
    return map[theme];
  }, [theme]);

  /**
   * 初始化组件
   */
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        if (!canvasRef.current) return;

        // 创建模型加载器
        modelLoaderRef.current = new ModelLoader();

        // 创建会话管理器
        const sessionManager = new ARSessionManager();
        sessionManagerRef.current = sessionManager;

        // 初始化会话管理器
        await sessionManager.initialize(canvasRef.current);

        // 设置事件监听器
        setupEventListeners(sessionManager);

        // 创建交互系统
        if (sessionManager.getEngine()) {
          const interactionSys = new ARInteractionSystem(
            sessionManager.getEngine()!,
            canvasRef.current
          );
          setInteractionSystem(interactionSys);
        }

        setIsInitialized(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        onError?.(err);
      }
    };

    initializeComponent();

    // 清理函数
    return () => {
      sessionManagerRef.current?.dispose();
      modelLoaderRef.current?.dispose();
      interactionSystem?.dispose();
    };
  }, []);

  useEffect(() => {
    if (sessionManagerRef.current?.getEngine() && canvasRef.current) {
      sessionManagerRef.current.getEngine()!.resize(width, height);
    }
  }, [width, height]);

  useEffect(() => {
    const v = videoPreviewRef.current;
    if (showVideoPreview) {
      if (v && cameraStreamRef.current) {
        (v as any).srcObject = cameraStreamRef.current;
        v.muted = true;
        (v as any).playsInline = true;
        v.play().catch(() => {});
      }
    } else {
      if (v) {
        (v as any).srcObject = null;
      }
    }
  }, [showVideoPreview, isMarkerDetectionActive]);

  

  /**
   * 开始标记检测
   */
  const startMarkerDetection = useCallback(async () => {
    if (!sessionManagerRef.current?.getEngine()) return;

    try {
      setError(null);
      const engine = sessionManagerRef.current.getEngine()!;
      
      
      // 如果没有视频元素，尝试获取摄像头视频
      if (!videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          
          // 创建临时视频元素用于标记检测
          const tempVideo = document.createElement('video');
          tempVideo.srcObject = stream;
          tempVideo.play();
          videoRef.current = tempVideo;
          cameraStreamRef.current = stream;
        } catch (err) {
          console.warn('无法访问摄像头，使用模拟标记检测:', err);
        }
      } else {
        const existing = (videoRef.current as any).srcObject as MediaStream | null;
        if (existing) {
          cameraStreamRef.current = existing;
        }
      }

      await engine.startMarkerDetection(videoRef.current || undefined);
      setIsMarkerDetectionActive(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start marker detection';
      setError(errorMessage);
      onError?.(err);
    }
  }, [onError]);

  

  /**
   * 停止标记检测
   */
  const stopMarkerDetection = useCallback(async () => {
    if (!sessionManagerRef.current?.getEngine()) return;

    try {
      const engine = sessionManagerRef.current.getEngine()!;
      engine.stopMarkerDetection();
      setIsMarkerDetectionActive(false);
      
      // 清理视频流
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current = null;
      }
      cameraStreamRef.current = null;
      if (videoPreviewRef.current) {
        (videoPreviewRef.current as any).srcObject = null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop marker detection';
      setError(errorMessage);
      onError?.(err);
    }
  }, [onError]);

  

  /**
   * 添加测试标记
   */
  const addTestMarker = useCallback(() => {
    if (!sessionManagerRef.current?.getEngine()) return;

    const testMarker: ARMarker = {
      id: `marker-${Date.now()}`,
      name: 'Test Marker',
      type: 'qr_code',
      position: { x: Math.random() * 2 - 1, y: 0, z: Math.random() * -2 - 1 },
      rotation: { x: 0, y: 0, z: 0 },
      size: { width: 0.1, height: 0.1 },
      confidence: 0.95,
      isTracking: true
    };

    sessionManagerRef.current.getEngine()!.addMarker(testMarker);
  }, []);

  /**
   * 设置事件监听器
   */
  const setupEventListeners = useCallback((sessionManager: ARSessionManager) => {
    sessionManager.on('sessionStarted', (data: any) => {
      setIsSessionActive(true);
      onSessionStart?.(data.session);
      if (sessionManager.getEngine() && canvasRef.current) {
        const interactionSys = new ARInteractionSystem(
          sessionManager.getEngine()!,
          canvasRef.current
        );
        setInteractionSystem(interactionSys);
      }
    });

    sessionManager.on('sessionStopped', (data: any) => {
      setIsSessionActive(false);
      onSessionEnd?.(data.session);
      interactionSystem?.dispose();
      setInteractionSystem(null);
      selectedObjectRef.current = null;
      setHasSelection(false);
      const controls = transformControlsRef.current;
      if (controls && sessionManager.getEngine()) {
        try {
          controls.detach();
          sessionManager.getEngine()!.getScene().remove(controls);
        } catch {}
        transformControlsRef.current = null;
      }
    });

    sessionManager.on('modelLoaded', (data: any) => {
      setModels(prev => [...prev, data.model]);
      onModelLoaded?.(data.model);
    });

    sessionManager.on('error', (data: any) => {
      setError(data.error);
      onError?.(data.error);
    });

    

    // 监听标记检测事件
    sessionManager.on('markerDetected', (data: any) => {
      setMarkers(prev => [...prev, data.marker]);
      try {
        const engine = sessionManager.getEngine();
        const id = data.marker.id;
        if (engine && !attachedMarkersRef.current.has(id)) {
          const group = engine.getMarkerObject(id);
          if (group) {
            const geom = new THREE.TorusKnotGeometry(0.05, 0.015, 64, 8);
            const mat = new THREE.MeshPhongMaterial({ color: 0xff66aa });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(0, 0.1, 0);
            group.add(mesh);
            attachedMarkersRef.current.add(id);
          }
        }
      } catch {}
    });

    sessionManager.on('markerLost', (data: any) => {
      setMarkers(prev => prev.filter(marker => marker.id !== data.markerId));
    });

    sessionManager.on('markerUpdated', (data: any) => {
      setMarkers(prev => prev.map(marker => 
        marker.id === data.marker.id ? data.marker : marker
      ));
    });
  }, [onSessionStart, onSessionEnd, onModelLoaded, onError]);

  /**
   * 启动 AR 会话
   */
  const startSession = useCallback(async () => {
    if (!sessionManagerRef.current) return;

    try {
      setError(null);
      setAutoResume(true);
      const config = {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['dom-overlay', 'depth-sensing', 'light-estimation'],
        domOverlay: true,
        depthSensing: true,
        lightingEstimation: true
      };

      await sessionManagerRef.current.startSession(config);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start session';
      setError(errorMessage);
      onError?.(err);
    }
  }, [onError]);

  /**
   * 停止 AR 会话
   */
  const stopSession = useCallback(async () => {
    if (!sessionManagerRef.current) return;

    try {
      setAutoResume(false);
      setIsStopping(true);
      await sessionManagerRef.current.stopSession();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop session';
      setError(errorMessage);
      onError?.(err);
    }
    finally {
      setIsStopping(false);
    }
  }, [onError]);

  useEffect(() => {
    const run = async () => {
      if (isInitialized && autoResume && !isSessionActive) {
        try {
          await startSession();
        } catch {}
      }
    };
    run();
  }, [isInitialized, autoResume, isSessionActive, startSession]);

  useEffect(() => {
    const run = async () => {
      if (isSessionActive && autoResume && !isMarkerDetectionActive) {
        try {
          await startMarkerDetection();
        } catch {}
      }
    };
    run();
  }, [isSessionActive, autoResume, isMarkerDetectionActive, startMarkerDetection]);

  /**
   * 添加测试立方体
   */
  const addTestCube = useCallback(() => {
    if (!sessionManagerRef.current?.getEngine()) return;

    const testModel = {
      id: `cube-${Date.now()}`,
      name: 'Test Cube',
      url: '/models/test-cube.glb',
      type: 'glb' as const,
      scale: { x: 1, y: 1, z: 1 },
      position: { x: 0, y: 0.5, z: -2 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      isVisible: true,
      isLoaded: false
    };

    sessionManagerRef.current.getEngine()!.addModel(testModel);
  }, []);

  /**
   * 添加测试球体
   */
  const addTestSphere = useCallback(() => {
    if (!modelLoaderRef.current) return;

    setIsLoading(true);
    try {
      const object = modelLoaderRef.current.createCustomGeometry({
        type: 'sphere',
        params: { radius: 0.4, widthSegments: 32, heightSegments: 24 }
      });

      object.position.set(
        Math.random() * 4 - 2,
        1,
        Math.random() * -4 - 1
      );

      if (sessionManagerRef.current?.getEngine()) {
        const engine = sessionManagerRef.current.getEngine()!;
        (engine as any).scene.add(object);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 添加随机几何体
   */
  const addRandomGeometry = useCallback(() => {
    if (!modelLoaderRef.current) return;

    setIsLoading(true);
    try {
      const geometries = ['box', 'sphere', 'cylinder', 'cone', 'torus'] as const;
      const randomType = geometries[Math.floor(Math.random() * geometries.length)];
      
      const object = modelLoaderRef.current.createCustomGeometry({
        type: randomType,
        params: {
          width: 0.5 + Math.random(),
          height: 0.5 + Math.random(),
          depth: 0.5 + Math.random(),
          radius: 0.3 + Math.random() * 0.5,
          radiusTop: 0.2 + Math.random() * 0.3,
          radiusBottom: 0.2 + Math.random() * 0.3,
          tube: 0.1 + Math.random() * 0.2
        }
      });

      // 设置随机位置
      object.position.set(
        Math.random() * 4 - 2,
        0.5 + Math.random(),
        Math.random() * -4 - 1
      );

      // 设置随机旋转
      object.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      // 设置随机颜色
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshPhongMaterial) {
        object.material.color.setHSL(Math.random(), 0.7, 0.6);
      }

      // 添加到场景
      if (sessionManagerRef.current?.getEngine()) {
        const engine = sessionManagerRef.current.getEngine()!;
        (engine as any).scene.add(object);
      }

    } catch (error) {
      console.error('Failed to create random geometry:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 添加文本模型
   */
  const addTextModel = useCallback(() => {
    if (!modelLoaderRef.current) return;

    setIsLoading(true);
    try {
      const texts = ['WebAR', 'Three.js', 'React', '3D', 'AR'];
      const randomText = texts[Math.floor(Math.random() * texts.length)];
      
      const object = modelLoaderRef.current.createTextModel(randomText, {
        fontSize: 48,
        color: 0xffffff,
        backgroundColor: 0x333333
      });

      // 设置位置
      object.position.set(
        Math.random() * 4 - 2,
        1 + Math.random(),
        Math.random() * -4 - 1
      );

      // 添加到场景
      if (sessionManagerRef.current?.getEngine()) {
        const engine = sessionManagerRef.current.getEngine()!;
        (engine as any).scene.add(object);
      }

    } catch (error) {
      console.error('Failed to create text model:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const rotateSelectedLeft = useCallback(() => {
    const obj = selectedObjectRef.current;
    if (!obj) return;
    obj.rotation.y -= Math.PI / 18;
  }, []);

  const rotateSelectedRight = useCallback(() => {
    const obj = selectedObjectRef.current;
    if (!obj) return;
    obj.rotation.y += Math.PI / 18;
  }, []);

  const rollSelectedUp = useCallback(() => {
    const obj = selectedObjectRef.current;
    if (!obj) return;
    obj.rotation.x -= Math.PI / 18;
  }, []);

  const rollSelectedDown = useCallback(() => {
    const obj = selectedObjectRef.current;
    if (!obj) return;
    obj.rotation.x += Math.PI / 18;
  }, []);

  const flipSelected = useCallback(() => {
    const obj = selectedObjectRef.current;
    if (!obj) return;
    const engine = sessionManagerRef.current?.getEngine();
    if (flipMode === 'local') {
      if (flipAxis === 'x') obj.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI);
      if (flipAxis === 'y') obj.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI);
      if (flipAxis === 'z') obj.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI);
      return;
    }
    let axis = new THREE.Vector3(0, 1, 0);
    if (flipMode === 'world') {
      if (flipAxis === 'x') axis.set(1, 0, 0);
      if (flipAxis === 'y') axis.set(0, 1, 0);
      if (flipAxis === 'z') axis.set(0, 0, 1);
    } else if (flipMode === 'view' && engine) {
      const cam = engine.getCamera();
      if (flipAxis === 'x') axis.set(1, 0, 0).applyQuaternion(cam.quaternion);
      if (flipAxis === 'y') axis.set(0, 1, 0).applyQuaternion(cam.quaternion);
      if (flipAxis === 'z') axis.set(0, 0, 1).applyQuaternion(cam.quaternion);
    }
    obj.rotateOnWorldAxis(axis.normalize(), Math.PI);
  }, [flipAxis, flipMode]);

  const executeCommand = useCallback(() => {
    const t = cmdText.trim();
    const obj = selectedObjectRef.current;
    if (!obj || !t) return;
    const lower = t.toLowerCase();
    const numMatch = t.match(/([-+]?\d+\.?\d*)/);
    const val = numMatch ? parseFloat(numMatch[1]) : NaN;
    const isDeg = /度|deg/.test(t);
    const isPercent = /%/.test(t);
    if (/旋转|rotate|转/.test(lower)) {
      const axis: 'x'|'y'|'z' = /x|x轴/.test(lower) ? 'x' : /z|z轴/.test(lower) ? 'z' : 'y';
      const sign = /左|left/.test(lower) ? -1 : /右|right/.test(lower) ? 1 : 1;
      const angle = isNaN(val) ? Math.PI/6 : isDeg ? (val * Math.PI/180) : val;
      if (axis === 'x') obj.rotation.x += sign * angle;
      if (axis === 'y') obj.rotation.y += sign * angle;
      if (axis === 'z') obj.rotation.z += sign * angle;
    } else if (/放大|增大|scale|缩放/.test(lower)) {
      let factor = 1.1;
      if (!isNaN(val)) {
        factor = isPercent ? 1 + (val/100) : val;
      }
      if (/缩小|reduce|decrease/.test(lower)) {
        factor = isPercent ? 1 - (val/100) : (isNaN(val) ? 0.9 : val);
      }
      obj.scale.multiplyScalar(factor);
    } else if (/移动|平移|move|translate/.test(lower)) {
      const step = isNaN(val) ? 0.1 : val;
      if (/x/.test(lower)) obj.position.x += step;
      else if (/y/.test(lower)) obj.position.y += step;
      else if (/z/.test(lower)) obj.position.z += step;
      else if (/左|left/.test(lower)) obj.position.x -= step;
      else if (/右|right/.test(lower)) obj.position.x += step;
      else if (/前|forward/.test(lower)) obj.position.z -= step;
      else if (/后|back|backward/.test(lower)) obj.position.z += step;
      else if (/上|up/.test(lower)) obj.position.y += step;
      else if (/下|down/.test(lower)) obj.position.y -= step;
    }
    setCmdText('');
  }, [cmdText]);

  const toggleGrid = useCallback(() => {
    if (!sessionManagerRef.current?.getEngine()) return;
    const scene = sessionManagerRef.current.getEngine()!.getScene();
    const camera = sessionManagerRef.current.getEngine()!.getCamera();
    if (gridVisible) {
      if (gridHelperRef.current) {
        scene.remove(gridHelperRef.current);
        gridHelperRef.current = null;
      }
      try { camera.layers.disable(1); } catch {}
      setGridEdit(false);
      setGridVisible(false);
    } else {
      const gh = new THREE.GridHelper(gridSize, gridDivisions, new THREE.Color(0x22d3ee), new THREE.Color(0x88e0ff));
      gh.rotation.x = gridMode === 'front' ? Math.PI / 2 : 0;
      const mat = gh.material as THREE.LineBasicMaterial;
      mat.transparent = true;
      mat.opacity = 0.9;
      gh.layers.set(1);
      gh.userData = { ...(gh.userData || {}), isGrid: true };
      // 仅在非编辑模式下禁用网格拾取；编辑模式允许点击选中
      if (!gridEdit) {
        (gh as any).raycast = () => {};
      }
      scene.add(gh);
      try { camera.layers.enable(1); } catch {}
      gridHelperRef.current = gh;
      setGridVisible(true);
    }
  }, [gridVisible]);

  useEffect(() => {
    if (!gridVisible || !sessionManagerRef.current?.getEngine()) return;
    const scene = sessionManagerRef.current.getEngine()!.getScene();
    const camera = sessionManagerRef.current.getEngine()!.getCamera();
    if (gridHelperRef.current) {
      try { scene.remove(gridHelperRef.current); } catch {}
      gridHelperRef.current = null;
    }
    const gh = new THREE.GridHelper(gridSize, gridDivisions, new THREE.Color(0x22d3ee), new THREE.Color(0x88e0ff));
    gh.rotation.x = gridMode === 'front' ? Math.PI / 2 : 0;
    const mat = gh.material as THREE.LineBasicMaterial;
    mat.transparent = true;
    mat.opacity = 0.9;
    gh.layers.set(1);
    gh.userData = { ...(gh.userData || {}), isGrid: true };
    if (!gridEdit) {
      (gh as any).raycast = () => {};
    }
    scene.add(gh);
    try { camera.layers.enable(1); } catch {}
    gridHelperRef.current = gh;
  }, [gridDivisions, gridSize, gridVisible, gridMode]);

  useEffect(() => {
    if (!gridHelperRef.current) return;
    const gh: any = gridHelperRef.current;
    // 切换编辑模式时，更新网格的 raycast 行为
    const disableRaycast: any = () => {};
    gh.raycast = gridEdit ? (THREE.LineSegments.prototype as any).raycast : disableRaycast;
  }, [gridEdit]);

  useEffect(() => {
    if (!sessionManagerRef.current?.getEngine()) return;
    const engine = sessionManagerRef.current.getEngine()!;
    const camera = engine.getCamera();
    let controls = transformControlsRef.current;
    if (gridEdit && gridVisible && gridHelperRef.current && canvasRef.current) {
      if (!controls) {
        (async () => {
          const mod = await import('three/examples/jsm/controls/TransformControls.js');
          const TransformControlsCtor = (mod as any).TransformControls || (mod as any).default;
          const created: any = new TransformControlsCtor(camera, canvasRef.current!);
          created.addEventListener('dragging-changed', (e: any) => setIsTransformDragging(!!e.value));
          created.addEventListener('objectChange', () => {
            const obj: any = (created as any).object;
            if (obj) {
              obj.position.x = Math.max(-5, Math.min(5, obj.position.x));
              obj.position.z = Math.max(-20, Math.min(-0.2, obj.position.z));
              obj.position.y = Math.max(0, Math.min(5, obj.position.y));
              const minS = 0.05, maxS = 5;
              const s = Math.max(minS, Math.min(maxS, obj.scale.x));
              obj.scale.set(s, s, s);
            }
          });
          transformControlsRef.current = created;
          if (created instanceof THREE.Object3D) {
            engine.getScene().add(created);
          }
          created.setMode(transformMode);
          created.attach(gridHelperRef.current!);
          selectedObjectRef.current = gridHelperRef.current!;
          setHasSelection(true);
          controls = created as any;
        })();
      } else {
        controls.setMode(transformMode);
        controls.attach(gridHelperRef.current!);
        selectedObjectRef.current = gridHelperRef.current!;
        setHasSelection(true);
      }
    } else {
      if (controls && transformControlsRef.current) {
        try { controls.detach(); } catch {}
      }
    }
    if (interactionSystem) {
      try { (interactionSystem as any).setAllowGridSelection(!!gridEdit); } catch {}
    }
  }, [gridEdit, gridVisible, transformMode]);

  useEffect(() => {
    if (!isSessionActive && sessionManagerRef.current?.getEngine() && gridHelperRef.current) {
      try {
        sessionManagerRef.current.getEngine()!.getScene().remove(gridHelperRef.current);
      } catch {}
      gridHelperRef.current = null;
      setGridVisible(false);
    }
  }, [isSessionActive]);

  const clearSelection = useCallback(() => {
    selectedObjectRef.current = null;
    setHasSelection(false);
  }, []);

  const importGLB = useCallback(async (file: File) => {
    if (!sessionManagerRef.current?.getEngine() || !modelLoaderRef.current) return;
    const engine = sessionManagerRef.current.getEngine()!;
    const url = URL.createObjectURL(file);
    const model = {
      id: `model-${Date.now()}`,
      name: file.name,
      url,
      type: 'glb' as const,
      scale: { x: 1, y: 1, z: 1 },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      isVisible: true,
      isLoaded: true
    };
    try {
      setIsLoading(true);
      const obj = await modelLoaderRef.current.loadModel(model);
      engine.getScene().add(obj);
      selectedObjectRef.current = obj;
      setHasSelection(true);
      if (canvasRef.current) {
        const camera = engine.getCamera();
        let controls = transformControlsRef.current;
        if (!controls) {
          const mod = await import('three/examples/jsm/controls/TransformControls.js');
          const TransformControlsCtor = (mod as any).TransformControls || (mod as any).default;
          const created: any = new TransformControlsCtor(camera, canvasRef.current!);
          created.addEventListener('dragging-changed', (e: any) => setIsTransformDragging(!!e.value));
          transformControlsRef.current = created;
          if (created instanceof THREE.Object3D) {
            engine.getScene().add(created);
          }
          controls = created as any;
        }
        controls.setMode(transformMode);
        controls.attach(obj);
        controls.setTranslationSnap(snapEnabled ? translationSnap : null as any);
        controls.setRotationSnap(snapEnabled ? rotationSnap : null as any);
        controls.setScaleSnap(snapEnabled ? scaleSnap : null as any);
      }
    } catch (error) {
      console.error('Import GLB failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [transformMode, snapEnabled, translationSnap, rotationSnap, scaleSnap]);

  const addPresetDuck = useCallback(async () => {
    if (!sessionManagerRef.current?.getEngine() || !modelLoaderRef.current) return;
    const engine = sessionManagerRef.current.getEngine()!;
    const model = {
      id: `duck-${Date.now()}`,
      name: 'Duck',
      url: DUCK_URL,
      type: 'glb' as const,
      scale: { x: 1, y: 1, z: 1 },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      isVisible: true,
      isLoaded: true
    };
    try {
      setIsLoading(true);
      const obj = await modelLoaderRef.current.loadModel(model);
      engine.getScene().add(obj);
      selectedObjectRef.current = obj;
      setHasSelection(true);
      if (canvasRef.current) {
        const camera = engine.getCamera();
        let controls = transformControlsRef.current;
        if (!controls) {
          const mod = await import('three/examples/jsm/controls/TransformControls.js');
          const TransformControlsCtor = (mod as any).TransformControls || (mod as any).default;
          const created: any = new TransformControlsCtor(camera, canvasRef.current!);
          created.addEventListener('dragging-changed', (e: any) => setIsTransformDragging(!!e.value));
          transformControlsRef.current = created;
          if (created instanceof THREE.Object3D) {
            engine.getScene().add(created);
          }
          controls = created as any;
        }
        controls.setMode(transformMode);
        controls.attach(obj);
        controls.setTranslationSnap(snapEnabled ? translationSnap : null as any);
        controls.setRotationSnap(snapEnabled ? rotationSnap : null as any);
        controls.setScaleSnap(snapEnabled ? scaleSnap : null as any);
      }
    } catch (error) {
      console.error('Add preset duck failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [transformMode, snapEnabled, translationSnap, rotationSnap, scaleSnap]);

  const addPreset = useCallback(async (name: string, url: string) => {
    if (!sessionManagerRef.current?.getEngine() || !modelLoaderRef.current) return;
    const engine = sessionManagerRef.current.getEngine()!;
    const model = {
      id: `${name}-${Date.now()}`,
      name,
      url,
      type: 'glb' as const,
      scale: { x: 1, y: 1, z: 1 },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      isVisible: true,
      isLoaded: true
    };
    try {
      setIsLoading(true);
      const obj = await modelLoaderRef.current.loadModel(model);
      engine.getScene().add(obj);
      selectedObjectRef.current = obj;
      setHasSelection(true);
      if (canvasRef.current) {
        const camera = engine.getCamera();
        let controls = transformControlsRef.current;
        if (!controls) {
          const mod = await import('three/examples/jsm/controls/TransformControls.js');
          const TransformControlsCtor = (mod as any).TransformControls || (mod as any).default;
          const created: any = new TransformControlsCtor(camera, canvasRef.current!);
          created.addEventListener('dragging-changed', (e: any) => setIsTransformDragging(!!e.value));
          transformControlsRef.current = created;
          if (created instanceof THREE.Object3D) {
            engine.getScene().add(created);
          }
          controls = created as any;
        }
        controls.setMode(transformMode);
        controls.attach(obj);
        controls.setTranslationSnap(snapEnabled ? translationSnap : null as any);
        controls.setRotationSnap(snapEnabled ? rotationSnap : null as any);
        controls.setScaleSnap(snapEnabled ? scaleSnap : null as any);
      }
    } catch (error) {
      console.error('Add preset failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [transformMode, snapEnabled, translationSnap, rotationSnap, scaleSnap]);

  const getTransformRoot = useCallback((obj: THREE.Object3D): THREE.Object3D => {
    let current: THREE.Object3D | null = obj;
    // 如果点击到描边(LineSegments)，优先提升到父级 Mesh
    if ((current as any).isLineSegments && current.parent) {
      current = current.parent;
    }
    // 向上查找，优先选择带有 modelId 的祖先，或到达顶层（parent 为场景）
    let candidate = current;
    while (candidate && candidate.parent && !(candidate.parent as any).isScene) {
      if (candidate.userData && (candidate.userData.modelId || candidate.userData.isMarkerVisualization || candidate.userData.isText)) {
        break;
      }
      candidate = candidate.parent;
    }
    return candidate || obj;
  }, []);

  useEffect(() => {
    if (!interactionSystem) return;

    const handleObjectTapped = async (data: any) => {
      const tapped = data.object as THREE.Object3D;
      if (((tapped as any).isGridHelper || tapped.userData?.isGrid) && !gridEdit) {
        return;
      }
      const root = ((tapped as any).isGridHelper || tapped.userData?.isGrid) ? (gridHelperRef.current || tapped) : getTransformRoot(tapped);
      selectedObjectRef.current = root;
      setHasSelection(true);
      if (!placeMode && sessionManagerRef.current?.getEngine() && canvasRef.current) {
        const engine = sessionManagerRef.current.getEngine()!;
        const camera = engine.getCamera();
        let controls = transformControlsRef.current;
        if (!controls) {
          const mod = await import('three/examples/jsm/controls/TransformControls.js');
          const TransformControlsCtor = (mod as any).TransformControls || (mod as any).default;
          const created: any = new TransformControlsCtor(camera, canvasRef.current!);
          created.addEventListener('dragging-changed', (e: any) => {
            setIsTransformDragging(!!e.value);
          });
          created.addEventListener('objectChange', () => {
            const obj: any = (created as any).object;
            if (obj) {
              obj.position.x = Math.max(-5, Math.min(5, obj.position.x));
              obj.position.z = Math.max(-20, Math.min(-0.2, obj.position.z));
              obj.position.y = Math.max(0, Math.min(5, obj.position.y));
              const minS = 0.05, maxS = 5;
              const s = Math.max(minS, Math.min(maxS, obj.scale.x));
              obj.scale.set(s, s, s);
            }
          });
          transformControlsRef.current = created;
          if (created instanceof THREE.Object3D) {
            engine.getScene().add(created);
          }
          controls = created as any;
        }
        controls.setMode(transformMode);
        controls.attach(root);
        controls.setTranslationSnap(snapEnabled ? translationSnap : null as any);
        controls.setRotationSnap(snapEnabled ? rotationSnap : null as any);
        controls.setScaleSnap(snapEnabled ? scaleSnap : null as any);
      }
    };

    const handleDrag = (data: any) => {
      if (isTransformDragging) return;
      const obj = selectedObjectRef.current;
      if (!obj) return;
      const factor = 0.01;
      const nx = obj.position.x + data.deltaX * factor;
      const nz = obj.position.z + (-data.deltaY * factor);
      obj.position.x = Math.max(-5, Math.min(5, nx));
      obj.position.z = Math.max(-20, Math.min(-0.2, nz));
      obj.position.y = Math.max(0, Math.min(5, obj.position.y));
    };

    const handleZoom = (data: any) => {
      const obj = selectedObjectRef.current;
      if (!obj) return;
      const factor = data.delta > 0 ? 1.05 : 0.95;
      const minS = 0.05;
      const maxS = 5;
      const s = Math.max(minS, Math.min(maxS, obj.scale.x * factor));
      obj.scale.set(s, s, s);
    };

    const handleKeyDown = (data: any) => {
      const obj = selectedObjectRef.current;
      if (!obj) return;
      const k = String(data.key || '').toLowerCase();
      if (k === 'q') obj.rotation.y -= Math.PI / 18;
      if (k === 'e') obj.rotation.y += Math.PI / 18;
      if (k === 'w') obj.rotation.x -= Math.PI / 18;
      if (k === 's') obj.rotation.x += Math.PI / 18;
      if (k === 'f') {
        flipSelected();
      }
    };

    const handleRotate = (data: any) => {
      const obj = selectedObjectRef.current;
      if (!obj) return;
      const factor = 0.005; // 每像素旋转弧度
      const dy = data.deltaY || 0;
      const dx = data.deltaX || 0;
      obj.rotation.x += dy * factor;
      obj.rotation.y += dx * factor;
    };

    interactionSystem.on('objectTapped', handleObjectTapped);
    interactionSystem.on('drag', handleDrag);
    interactionSystem.on('zoom', handleZoom);
    interactionSystem.on('keyDown', handleKeyDown);
    interactionSystem.on('rotate', handleRotate);

    return () => {
      interactionSystem.off('objectTapped', handleObjectTapped);
      interactionSystem.off('drag', handleDrag);
      interactionSystem.off('zoom', handleZoom);
      interactionSystem.off('keyDown', handleKeyDown);
      interactionSystem.off('rotate', handleRotate);
    };
  }, [interactionSystem]);

  useEffect(() => {
    const controls = transformControlsRef.current;
    if (controls) {
      controls.setMode(transformMode);
    }
  }, [transformMode]);

  useEffect(() => {
    const controls = transformControlsRef.current;
    if (controls) {
      controls.setTranslationSnap(snapEnabled ? translationSnap : null as any);
      controls.setRotationSnap(snapEnabled ? rotationSnap : null as any);
      controls.setScaleSnap(snapEnabled ? scaleSnap : null as any);
    }
  }, [snapEnabled, translationSnap, rotationSnap, scaleSnap]);
  /**
   * 处理画布点击事件
   */
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!sessionManagerRef.current?.getEngine()) return;

    if (!placeMode) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // 这里可以实现点击放置模型的逻辑
    console.log('Canvas clicked at:', x, y);
    
    // 在点击位置放置一个随机几何体
    if (modelLoaderRef.current) {
      setIsLoading(true);
      try {
        const object = modelLoaderRef.current.createCustomGeometry({
          type: 'sphere',
          params: { radius: 0.2 }
        });

        // 将屏幕坐标转换为 3D 世界坐标（简化版本）
        object.position.set(x * 2, 0.2, y * 2 - 1);

        // 添加到场景
        const engine = sessionManagerRef.current.getEngine()!;
        (engine as any).scene.add(object);

      } catch (error) {
        console.error('Failed to place object:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  return (
    <div 
      className={`webar-container ${className || ''}`}
      style={{
        position: 'relative',
        width,
        height,
        ...style
      }}
    >
      {/* AR 画布 */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleCanvasClick}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: isLoading ? 'wait' : 'crosshair'
        }}
      />

      <div className="webar-controls" style={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '12px',
        borderRadius: '12px',
        backdropFilter: 'saturate(180%) blur(10px)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)'
      }}>
        {!isSessionActive ? (
            <button 
              onClick={startSession}
              disabled={!isInitialized}
              style={{
                padding: '12px 22px',
                background: isInitialized ? 'linear-gradient(90deg, #6366f1, #06b6d4)' : 'linear-gradient(90deg, #374151, #374151)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: isInitialized ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '0.3px',
                boxShadow: isInitialized ? '0 10px 25px rgba(99,102,241,0.35)' : 'none'
              }}
            >
              {isInitialized ? '🚀 启动 AR 会话' : '⏳ 初始化中...'}
            </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={stopSession}
              disabled={isStopping}
              style={{
                padding: '10px 20px',
                background: isStopping ? 'linear-gradient(90deg, #6b7280, #4b5563)' : 'linear-gradient(90deg, #ef4444, #f59e0b)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: isStopping ? 'wait' : 'pointer',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '0.3px'
              }}
            >
              {isStopping ? '⏹️ 正在停止…' : '⏹️ 停止会话'}
            </button>
          </div>
        )}
      </div>

      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 200,
        padding: '12px',
        borderRadius: '12px',
        backdropFilter: 'saturate(180%) blur(10px)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>工具栏</div>
          <button onClick={() => setToolbarOpen(!toolbarOpen)} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', cursor: 'pointer' }}>{toolbarOpen ? '折叠' : '展开'}</button>
        </div>
        {toolbarOpen && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, width: 280 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>对象</div>
              {/* <button onClick={clearSelection} style={{ padding: '6px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', cursor: 'pointer', fontSize: '11px' }}>取消</button> */}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button onClick={() => addPreset('Duck', DUCK_URL)} style={{ padding: '6px 10px', background: 'linear-gradient(90deg, #06b6d4, #10b981)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>Duck</button>
              <button onClick={() => addPreset('Helmet', HELMET_URL)} style={{ padding: '6px 10px', background: 'linear-gradient(90deg, #6366f1, #06b6d4)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>Helmet</button>
              <button onClick={() => addPreset('Fox', FOX_URL)} style={{ padding: '6px 10px', background: 'linear-gradient(90deg, #14b8a6, #10b981)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>Fox</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button onClick={addTestCube} disabled={isLoading} style={{ padding: '8px 10px', background: palette.primary, color: 'white', border: 'none', borderRadius: '10px', cursor: isLoading ? 'wait' : 'pointer', fontSize: '11px' }}>📦 立方体</button>
              <button onClick={addTestSphere} disabled={isLoading} style={{ padding: '8px 10px', background: palette.secondary, color: 'white', border: 'none', borderRadius: '10px', cursor: isLoading ? 'wait' : 'pointer', fontSize: '11px' }}>🔮 球体</button>
              <button onClick={addRandomGeometry} disabled={isLoading} style={{ padding: '8px 10px', background: palette.secondary, color: 'white', border: 'none', borderRadius: '10px', cursor: isLoading ? 'wait' : 'pointer', fontSize: '11px' }}>🎲 随机</button>
              <button onClick={addTextModel} disabled={isLoading} style={{ padding: '8px 10px', background: palette.primary, color: 'white', border: 'none', borderRadius: '10px', cursor: isLoading ? 'wait' : 'pointer', fontSize: '11px' }}>📝 文本</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>操作</div>
              <div />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              <button onClick={() => setTransformMode('translate')} style={{ padding: '6px 10px', background: transformMode === 'translate' ? palette.primary : 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>移动</button>
              <button onClick={() => setTransformMode('rotate')} style={{ padding: '6px 10px', background: transformMode === 'rotate' ? palette.primary : 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>旋转</button>
              <button onClick={() => setTransformMode('scale')} style={{ padding: '6px 10px', background: transformMode === 'scale' ? palette.primary : 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>缩放</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button onClick={() => setSnapEnabled(!snapEnabled)} style={{ padding: '6px 10px', background: snapEnabled ? palette.secondary : 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>{snapEnabled ? '吸附开' : '吸附关'}</button>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, opacity: 0.85 }}>Δ {translationSnap.toFixed(2)} · θ {(rotationSnap * 180/Math.PI).toFixed(0)}° · s {scaleSnap.toFixed(2)}</span>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
              <input value={cmdText} onChange={(e) => setCmdText(e.target.value)} placeholder={helpLang === 'zh' ? '输入指令，如：旋转30度、放大10%' : 'Enter command, e.g., rotate 30deg, scale 10%'} style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', fontSize: '12px' }} />
              <button onClick={executeCommand} style={{ padding: '8px 10px', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '12px' }}>执行</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button onClick={rotateSelectedLeft} style={{ padding: '8px 10px', background: palette.primary, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>↶ 左旋</button>
              <button onClick={rotateSelectedRight} style={{ padding: '8px 10px', background: palette.primary, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>↷ 右旋</button>
              <button onClick={rollSelectedUp} style={{ padding: '8px 10px', background: palette.primary, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>⤴ 上翻</button>
              <button onClick={rollSelectedDown} style={{ padding: '8px 10px', background: palette.primary, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>⤵ 下翻</button>
              <button onClick={flipSelected} style={{ padding: '8px 10px', background: palette.secondary, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>🔁 翻转</button>
              {/* <button onClick={() => setPlaceMode(!placeMode)} style={{ padding: '8px 10px', background: placeMode ? palette.primary : 'linear-gradient(135deg, #6b7280, #4b5563)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>{placeMode ? '📍 放置' : '✏️ 编辑'}</button> */}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>场景</div>
              <div />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
              <button onClick={toggleGrid} style={{ padding: '8px 10px', background: gridVisible ? 'linear-gradient(135deg, #10b981, #06b6d4)' : 'rgba(255,255,255,0.06)', color: gridVisible ? 'white' : '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>{gridVisible ? '🧱 网格开' : '🧱 网格关'}</button>
              <button onClick={() => setGridEdit(!gridEdit)} disabled={!gridVisible} style={{ padding: '8px 10px', background: gridEdit ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: gridVisible ? 'pointer' : 'not-allowed', fontSize: '11px' }}>{gridEdit ? '✏️ 编辑网格' : '✏️ 编辑网格'}</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#e5e7eb' }}>
                <span>密度: {gridDivisions}</span>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={1}
                  value={gridDivisions}
                  onChange={(e) => setGridDivisions(parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button onClick={() => setGridMode('front')} style={{ padding: '6px 10px', background: gridMode === 'front' ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>前视XY</button>
              <button onClick={() => setGridMode('ground')} style={{ padding: '6px 10px', background: gridMode === 'ground' ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>地面XZ</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {!isMarkerDetectionActive ? (
                <button onClick={startMarkerDetection} style={{ padding: '8px 10px', background: 'linear-gradient(135deg, #f43f5e, #f59e0b)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>🔍 开始检测</button>
              ) : (
                <button onClick={stopMarkerDetection} style={{ padding: '8px 10px', background: 'linear-gradient(135deg, #6b7280, #4b5563)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>⏹️ 停止检测</button>
              )}
              <button onClick={addTestMarker} style={{ padding: '8px 10px', background: 'linear-gradient(135deg, #db2777, #06b6d4)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>📍 测试标记</button>
            </div>
            {showMindARControls ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button onClick={() => setUseMindAR(!useMindAR)} style={{ padding: '6px 10px', background: useMindAR ? 'linear-gradient(135deg, #10b981, #06b6d4)' : 'rgba(255,255,255,0.06)', color: useMindAR ? 'white' : '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>{useMindAR ? 'MindAR开' : 'MindAR关'}</button>
                  <button style={{ padding: '6px 10px', background: 'linear-gradient(135deg, #06b6d4, #14b8a6)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>应用目标</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                  <input value={mindTarget} onChange={(e) => setMindTarget(e.target.value)} placeholder={'/targets/apple.mind 或远程 .mind 链接'} style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', fontSize: '12px' }} />
                  <input ref={mindFileRef} type="file" accept=".mind" style={{ padding: '6px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', fontSize: '11px' }} />
                </div>
              </>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button onClick={() => setAutoResume(!autoResume)} style={{ padding: '6px 10px', background: autoResume ? 'linear-gradient(135deg, #10b981, #06b6d4)' : 'rgba(255,255,255,0.06)', color: autoResume ? 'white' : '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>{autoResume ? '自动恢复开' : '自动恢复关'}</button>
              <button onClick={() => setShowVideoPreview(!showVideoPreview)} style={{ padding: '6px 10px', background: showVideoPreview ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer', fontSize: '11px' }}>{showVideoPreview ? '相机预览开' : '相机预览关'}</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#e5e7eb' }}>状态: {isMarkerDetectionActive ? '检测运行中' : '未开启'}</span>
              <span style={{ fontSize: 11, color: '#e5e7eb' }}>标记: {markers.length}</span>
            </div>

            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>{helpLang === 'zh' ? '快捷帮助' : 'Quick Help'}</div>
                <button onClick={() => setHelpOpen(!helpOpen)} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', cursor: 'pointer', fontSize: 11 }}>{helpOpen ? '折叠' : '展开'}</button>
              </div>
              {helpOpen && (
                <div style={{ fontSize: helpLarge ? 13 : 11, color: 'rgba(255,255,255,0.85)' }}>
                  {helpLang === 'zh' ? (
                    <>
                      <div>• 点击画布放置物体</div>
                      <div>• 左键拖动平移 · 右键或 Shift+左键拖动旋转</div>
                      <div>• 滚轮缩放 · 双指捏合缩放 · 双指上下滑翻滚</div>
                      <div>• Q/E/W/S 旋转 · F 翻转（可选轴/模式）</div>
                    </>
                  ) : (
                    <>
                      <div>• Click canvas to place objects</div>
                      <div>• Drag to translate · Right click or Shift+Drag to rotate</div>
                      <div>• Wheel to zoom · Pinch to scale · Two-finger swipe to roll</div>
                      <div>• Q/E/W/S rotate · F flip (axis/mode selectable)</div>
                    </>
                  )}
                </div>
              )}
            </div>

            
          </div>
        )}
      </div>

      {showVideoPreview && (
        <video ref={videoPreviewRef} style={{ position: 'absolute', bottom: 10, left: 10, width: 180, height: 120, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 30px rgba(0,0,0,0.35)', background: 'black', zIndex: 150 }} />
      )}

      {/* 状态信息 */}
      {error && (
        <div className="webar-error" style={{
          position: 'absolute',
          top: 10,
          right: 10,
          backgroundColor: '#ffebee',
          color: '#c62828',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 100,
          maxWidth: '300px'
        }}>
          ❌ 错误: {error}
        </div>
      )}

      

      

      {isSessionActive && (
        <div style={{
          position: 'absolute',
          bottom: 10,
          right: 240,
          color: 'white',
          padding: '8px 12px',
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 100
        }}>
        </div>
      )}

      {/* 加载状态 */}
      {!isInitialized && (
        <div className="webar-loading" style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: '18px',
          zIndex: 100,
          textAlign: 'center'
        }}>
          <div>🔄 正在初始化 WebAR...</div>
          <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.8 }}>
            加载 3D 引擎 | 检测 WebXR 支持 | 准备渲染环境
          </div>
        </div>
      )}

      {/* 加载遮罩 */}
      {isLoading && (
        <div className="webar-loading-overlay" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔄</div>
            <div>正在创建模型...</div>
          </div>
        </div>
      )}

      {/* 交互控制面板 */}
      {showInteractionPanel && interactionSystem && (
        <ARInteractionPanel
          interactionSystem={interactionSystem}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 150
          }}
        />
      )}
    </div>
  );
};

export default WebARComponent;
