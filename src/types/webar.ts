// WebAR 核心类型定义

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface ARSessionConfig {
  requiredFeatures?: string[];
  optionalFeatures?: string[];
  domOverlay?: boolean;
  depthSensing?: boolean;
  lightingEstimation?: boolean;
}

export interface ARSession {
  id: string;
  config: ARSessionConfig;
  isActive: boolean;
  startTime: number;
  frameCount: number;
}

export interface ARPlane {
  id: string;
  orientation: 'horizontal' | 'vertical';
  center: Vector3;
  extent: Vector3;
  vertices: Vector3[];
  transform: number[];
}

export interface ARAnchor {
  id: string;
  type: 'plane' | 'image' | 'face' | 'hand';
  transform: number[];
  isTracked: boolean;
}

export interface ARHitTestResult {
  type: 'plane' | 'featurePoint';
  distance: number;
  transform: number[];
  plane?: ARPlane;
}

export interface ARImageTrackingResult {
  name: string;
  index: number;
  imageName: string;
  transform: number[];
  trackingState: 'tracking' | 'lost' | 'limited';
  measuredWidthInMeters: number;
  measuredHeightInMeters: number;
  isTracking: boolean;
  marker: ARMarker;
}

export interface ARLightProbe {
  intensity: number;
  color: Vector3;
  direction: Vector3;
  sphericalHarmonics?: Float32Array;
}

export interface ARFrame {
  timestamp: number;
  camera: {
    transform: number[];
    projectionMatrix: number[];
    viewMatrix: number[];
  };
  planes: ARPlane[];
  anchors: ARAnchor[];
  hitTestResults: ARHitTestResult[];
  imageTrackingResults: ARImageTrackingResult[];
  lightProbe?: ARLightProbe;
}

export interface ARModel {
  id: string;
  name: string;
  url: string;
  type: 'gltf' | 'glb' | 'obj';
  scale: Vector3;
  position: Vector3;
  rotation: Vector4;
  isVisible: boolean;
  isLoaded: boolean;
}

export interface AREvent {
  type: 'sessionStart' | 'sessionEnd' | 'planeDetected' | 'anchorAdded' | 'anchorUpdated' | 'anchorRemoved' | 'imageTracked' | 'error';
  timestamp: number;
  data?: any;
}

export interface ARPerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  drawCalls: number;
  triangles: number;
}

export interface ARDebugInfo {
  sessionInfo: ARSession;
  performance: ARPerformanceMetrics;
  activePlanes: number;
  activeAnchors: number;
  trackedImages: number;
  errors: string[];
}

// AR 交互相关类型
export enum ARGestureType {
  TAP = 'tap',
  DOUBLE_TAP = 'doubleTap',
  LONG_PRESS = 'longPress',
  SWIPE_UP = 'swipeUp',
  SWIPE_DOWN = 'swipeDown',
  SWIPE_LEFT = 'swipeLeft',
  SWIPE_RIGHT = 'swipeRight',
  PINCH = 'pinch',
  ZOOM = 'zoom',
  DRAG = 'drag',
  ROTATE = 'rotate'
}

export enum ARInteractionMode {
  TOUCH = 'touch',
  GESTURE = 'gesture',
  VOICE = 'voice',
  CONTROLLER = 'controller',
  MULTI = 'multi'
}

export interface ARTouchPoint {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
  endTime?: number;
  isActive: boolean;
}

export interface ARGestureEvent {
  type: ARGestureType;
  position?: { x: number; y: number };
  deltaX?: number;
  deltaY?: number;
  distance?: number;
  duration?: number;
  timestamp: number;
  confidence?: number;
}

export interface ARVoiceCommand {
  keyword: string;
  action: string;
  description?: string;
  confidenceThreshold?: number;
}

export interface ARControllerEvent {
  type: 'button' | 'axis' | 'connect' | 'disconnect';
  buttonIndex?: number;
  axis?: string;
  value?: number;
  pressed?: boolean;
  x?: number;
  y?: number;
}

export interface ARMarker {
  id: string;
  name?: string;
  type: 'qr_code' | 'ar_marker' | 'image' | 'custom';
  position: Vector3;
  rotation?: Vector3;
  size: { width: number; height: number };
  confidence: number;
  isTracking: boolean;
  data?: any;
}

export enum ARMarkerType {
  QR_CODE = 'qr_code',
  AR_MARKER = 'ar_marker',
  IMAGE = 'image',
  CUSTOM = 'custom'
}