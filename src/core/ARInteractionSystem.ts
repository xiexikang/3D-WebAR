import { EventEmitter } from '../utils/EventEmitter';
import * as THREE from 'three';
import { WebAREngine } from './WebAREngine';
import { 
  ARGestureEvent, 
  ARGestureType, 
  ARTouchPoint, 
  ARInteractionMode,
  ARVoiceCommand,
  ARControllerEvent 
} from '../types/webar';

/**
 * AR 交互系统
 * 处理手势识别、语音控制、触摸交互等多种交互方式
 */
export class ARInteractionSystem extends EventEmitter {
  private engine: WebAREngine;
  private canvas: HTMLCanvasElement;
  private interactionMode: ARInteractionMode = ARInteractionMode.TOUCH;
  private isActive = false;
  
  // 触摸相关
  private touchPoints: Map<number, ARTouchPoint> = new Map();
  private lastTouchTime = 0;
  private touchThreshold = 300; // 毫秒
  private gestureThreshold = 50; // 像素
  
  // 手势识别
  private gestureHistory: ARGestureEvent[] = [];
  private gestureHistorySize = 10;
  private isGestureRecognizing = false;
  
  // 语音控制
  private recognition: any = null; // SpeechRecognition
  private voiceCommands: Map<string, ARVoiceCommand> = new Map();
  private isVoiceActive = false;
  
  // 射线投射
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private pinchLastDistance: number | null = null;
  private twoFingerCenterYLast: number | null = null;
  private currentMouseButton: number | null = null;
  private allowGridSelection: boolean = false;
  
  // 控制器支持
  private gamepadIndex: number | null = null;
  private controllerPollingInterval: number | null = null;

  constructor(engine: WebAREngine, canvas: HTMLCanvasElement) {
    super();
    this.engine = engine;
    this.canvas = canvas;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.setupEventListeners();
    this.setupVoiceRecognition();
  }

  /**
   * 设置是否允许选择网格（GridHelper）
   */
  setAllowGridSelection(allow: boolean): void {
    this.allowGridSelection = allow;
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 触摸事件
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });
    
    // 鼠标事件（用于桌面测试）
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // 键盘事件
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    
    // 游戏手柄连接事件
    window.addEventListener('gamepadconnected', this.handleGamepadConnected.bind(this));
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected.bind(this));
  }

  /**
   * 设置语音识别
   */
  private setupVoiceRecognition(): void {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'zh-CN';
      
      this.recognition.onresult = (event: any) => {
        this.handleVoiceResult(event);
      };
      
      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        this.emit('voiceError', { error: event.error });
      };
      
      this.recognition.onend = () => {
        if (this.isVoiceActive) {
          // 自动重启语音识别
          setTimeout(() => {
            if (this.isVoiceActive) {
              this.startVoiceRecognition();
            }
          }, 1000);
        }
      };
    }
  }

  /**
   * 处理触摸开始
   */
  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchPoint: ARTouchPoint = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        isActive: true
      };
      
      this.touchPoints.set(touch.identifier, touchPoint);
    }
    
    if (event.changedTouches.length > 0) {
      const t = event.changedTouches[0];
      this.performRaycast(t.clientX, t.clientY);
    }

    this.processTouchGesture();
  }

  /**
   * 处理触摸移动
   */
  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    
    let lastStepDeltaX = 0;
    let lastStepDeltaY = 0;

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchPoint = this.touchPoints.get(touch.identifier);
      
      if (touchPoint) {
        lastStepDeltaX = touch.clientX - touchPoint.x;
        lastStepDeltaY = touch.clientY - touchPoint.y;
        touchPoint.x = touch.clientX;
        touchPoint.y = touch.clientY;
        touchPoint.isActive = true;
      }
    }
    
    const activeTouches = Array.from(this.touchPoints.values()).filter(t => t.isActive);
    if (activeTouches.length === 1 && (lastStepDeltaX !== 0 || lastStepDeltaY !== 0)) {
      const t = activeTouches[0];
      this.emit('drag', {
        type: ARGestureType.DRAG,
        deltaX: lastStepDeltaX,
        deltaY: lastStepDeltaY,
        position: { x: t.x, y: t.y }
      });
    }

    if (activeTouches.length === 2) {
      const [t1, t2] = activeTouches;
      const distance = Math.sqrt(Math.pow(t2.x - t1.x, 2) + Math.pow(t2.y - t1.y, 2));
      const centerX = (t1.x + t2.x) / 2;
      const centerY = (t1.y + t2.y) / 2;
      if (this.pinchLastDistance == null) {
        this.pinchLastDistance = distance;
      } else {
        const delta = distance - this.pinchLastDistance;
        if (Math.abs(delta) > 1) {
          this.emit('zoom', {
            type: ARGestureType.ZOOM,
            delta: delta > 0 ? 1 : -1,
            position: { x: centerX, y: centerY }
          });
          this.pinchLastDistance = distance;
        }
      }
      if (this.twoFingerCenterYLast == null) {
        this.twoFingerCenterYLast = centerY;
      } else {
        const rotateDeltaY = centerY - this.twoFingerCenterYLast;
        if (Math.abs(rotateDeltaY) > 1) {
          this.emit('rotate', {
            type: ARGestureType.ROTATE,
            deltaY: rotateDeltaY,
            position: { x: centerX, y: centerY }
          });
          this.twoFingerCenterYLast = centerY;
        }
      }
    }

    this.processTouchGesture();
  }

  /**
   * 处理触摸结束
   */
  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchPoint = this.touchPoints.get(touch.identifier);
      
      if (touchPoint) {
        touchPoint.endTime = Date.now();
        touchPoint.isActive = false;
        
        // 识别手势
        this.recognizeGesture(touchPoint);
      }
      
      this.touchPoints.delete(touch.identifier);
    }

    const remainingActive = Array.from(this.touchPoints.values()).filter(t => t.isActive);
    if (remainingActive.length < 2) {
      this.pinchLastDistance = null;
      this.twoFingerCenterYLast = null;
    }
  }

  /**
   * 处理触摸取消
   */
  private handleTouchCancel(event: TouchEvent): void {
    this.handleTouchEnd(event);
  }

  /**
   * 处理鼠标按下（桌面测试）
   */
  private handleMouseDown(event: MouseEvent): void {
    this.currentMouseButton = event.button;
    const touchPoint: ARTouchPoint = {
      id: -1, // 鼠标使用 -1 作为标识
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startTime: Date.now(),
      isActive: true
    };
    
    this.touchPoints.set(-1, touchPoint);
    this.updateMousePosition(event);
    this.performRaycast(event.clientX, event.clientY);
  }

  /**
   * 处理鼠标移动
   */
  private handleMouseMove(event: MouseEvent): void {
    this.updateMousePosition(event);
    
    const touchPoint = this.touchPoints.get(-1);
    if (touchPoint && touchPoint.isActive) {
      const stepDeltaX = event.clientX - touchPoint.x;
      const stepDeltaY = event.clientY - touchPoint.y;
      
      // 更新当前坐标到最新，供下次增量计算
      touchPoint.x = event.clientX;
      touchPoint.y = event.clientY;
      
      // 鼠标右键或按住 Shift + 左键映射为旋转
      const isRotateGesture = (this.currentMouseButton === 2) || (this.currentMouseButton === 0 && event.shiftKey);
      if (isRotateGesture) {
        if (stepDeltaX !== 0 || stepDeltaY !== 0) {
          this.emit('rotate', {
            type: ARGestureType.ROTATE,
            deltaX: stepDeltaX,
            deltaY: stepDeltaY,
            position: { x: event.clientX, y: event.clientY },
            timestamp: Date.now()
          });
        }
      } else {
        // 默认左键拖拽为平移
        if (stepDeltaX !== 0 || stepDeltaY !== 0) {
          this.emit('drag', {
            type: ARGestureType.DRAG,
            deltaX: stepDeltaX,
            deltaY: stepDeltaY,
            position: { x: event.clientX, y: event.clientY }
          });
        }
      }
    }
  }

  /**
   * 处理鼠标释放
   */
  private handleMouseUp(event: MouseEvent): void {
    const touchPoint = this.touchPoints.get(-1);
    
    if (touchPoint) {
      touchPoint.endTime = Date.now();
      touchPoint.isActive = false;
      this.currentMouseButton = null;
      
      // 识别点击手势
      const duration = touchPoint.endTime - touchPoint.startTime;
      const deltaX = event.clientX - touchPoint.startX;
      const deltaY = event.clientY - touchPoint.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (duration < this.touchThreshold && distance < this.gestureThreshold) {
        this.handleClick(event);
      }
      
      this.touchPoints.delete(-1);
    }
  }

  /**
   * 处理鼠标滚轮
   */
  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    
    this.emit('zoom', {
      type: ARGestureType.ZOOM,
      delta: event.deltaY > 0 ? -1 : 1,
      position: { x: event.clientX, y: event.clientY }
    });
  }

  /**
   * 处理点击事件
   */
  private handleClick(event: MouseEvent | TouchEvent): void {
    const clientX = 'clientX' in event ? event.clientX : event.changedTouches[0].clientX;
    const clientY = 'clientY' in event ? event.clientY : event.changedTouches[0].clientY;
    
    // 执行射线投射
    this.performRaycast(clientX, clientY);
    
    this.emit('tap', {
      type: ARGestureType.TAP,
      position: { x: clientX, y: clientY },
      timestamp: Date.now()
    });
  }

  /**
   * 处理键盘按下
   */
  private handleKeyDown(event: KeyboardEvent): void {
    this.emit('keyDown', {
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey
    });
    
    // 快捷键处理
    this.handleKeyboardShortcuts(event);
  }

  /**
   * 处理键盘释放
   */
  private handleKeyUp(event: KeyboardEvent): void {
    this.emit('keyUp', {
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey
    });
  }

  /**
   * 处理键盘快捷键
   */
  private handleKeyboardShortcuts(event: KeyboardEvent): void {
    // ESC 键停止当前操作
    if (event.key === 'Escape') {
      this.emit('cancel', { type: 'keyboard' });
    }
    
    // 空格键切换暂停/恢复
    if (event.key === ' ') {
      event.preventDefault();
      this.emit('togglePause', { type: 'keyboard' });
    }
    
    // R 键重置场景
    if (event.key.toLowerCase() === 'r' && event.ctrlKey) {
      event.preventDefault();
      this.emit('reset', { type: 'keyboard' });
    }
  }

  /**
   * 更新鼠标位置
   */
  private updateMousePosition(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * 处理触摸手势
   */
  private processTouchGesture(): void {
    const activeTouches = Array.from(this.touchPoints.values()).filter(t => t.isActive);
    
    if (activeTouches.length === 1) {
      // 单指手势
      this.processSingleTouchGesture(activeTouches[0]);
    } else if (activeTouches.length === 2) {
      // 双指手势
      this.processTwoTouchGesture(activeTouches[0], activeTouches[1]);
    }
  }

  /**
   * 处理单指手势
   */
  private processSingleTouchGesture(touch: ARTouchPoint): void {
    const deltaX = touch.x - touch.startX;
    const deltaY = touch.y - touch.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance > this.gestureThreshold) {
      // 检测滑动手势
      const angle = Math.atan2(deltaY, deltaX);
      const absAngle = Math.abs(angle);
      
      let gestureType: ARGestureType;
      
      if (absAngle < Math.PI / 4) {
        gestureType = ARGestureType.SWIPE_RIGHT;
      } else if (absAngle > 3 * Math.PI / 4) {
        gestureType = ARGestureType.SWIPE_LEFT;
      } else if (angle > 0) {
        gestureType = ARGestureType.SWIPE_DOWN;
      } else {
        gestureType = ARGestureType.SWIPE_UP;
      }
      
      this.emit('swipe', {
        type: gestureType,
        deltaX,
        deltaY,
        distance,
        position: { x: touch.x, y: touch.y }
      });
    }
  }

  /**
   * 处理双指手势
   */
  private processTwoTouchGesture(touch1: ARTouchPoint, touch2: ARTouchPoint): void {
    // 计算双指距离
    const distance = Math.sqrt(
      Math.pow(touch2.x - touch1.x, 2) + Math.pow(touch2.y - touch1.y, 2)
    );
    
    // 计算中心点
    const centerX = (touch1.x + touch2.x) / 2;
    const centerY = (touch1.y + touch2.y) / 2;
    
    this.emit('pinch', {
      type: ARGestureType.PINCH,
      distance,
      center: { x: centerX, y: centerY },
      timestamp: Date.now()
    });
  }

  /**
   * 识别手势
   */
  private recognizeGesture(touch: ARTouchPoint): void {
    if (this.isGestureRecognizing) return;
    
    this.isGestureRecognizing = true;
    
    const duration = touch.endTime! - touch.startTime;
    const deltaX = touch.x - touch.startX;
    const deltaY = touch.y - touch.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    let gestureEvent: ARGestureEvent;
    
    if (duration < this.touchThreshold && distance < this.gestureThreshold) {
      // 点击手势
      gestureEvent = {
        type: ARGestureType.TAP,
        position: { x: touch.x, y: touch.y },
        timestamp: touch.endTime!
      };
    } else if (distance > this.gestureThreshold) {
      // 滑动手势
      const angle = Math.atan2(deltaY, deltaX);
      let gestureType: ARGestureType;
      
      const absAngle = Math.abs(angle);
      if (absAngle < Math.PI / 4) {
        gestureType = ARGestureType.SWIPE_RIGHT;
      } else if (absAngle > 3 * Math.PI / 4) {
        gestureType = ARGestureType.SWIPE_LEFT;
      } else if (angle > 0) {
        gestureType = ARGestureType.SWIPE_DOWN;
      } else {
        gestureType = ARGestureType.SWIPE_UP;
      }
      
      gestureEvent = {
        type: gestureType,
        position: { x: touch.x, y: touch.y },
        deltaX,
        deltaY,
        distance,
        timestamp: touch.endTime!
      };
    } else {
      // 长按手势
      gestureEvent = {
        type: ARGestureType.LONG_PRESS,
        position: { x: touch.x, y: touch.y },
        duration,
        timestamp: touch.endTime!
      };
    }
    
    this.addGestureToHistory(gestureEvent);
    this.emit('gesture', gestureEvent);
    
    setTimeout(() => {
      this.isGestureRecognizing = false;
    }, 100);
  }

  /**
   * 添加手势到历史记录
   */
  private addGestureToHistory(gesture: ARGestureEvent): void {
    this.gestureHistory.push(gesture);
    
    if (this.gestureHistory.length > this.gestureHistorySize) {
      this.gestureHistory.shift();
    }
    
    // 检测手势序列
    this.detectGestureSequence();
  }

  /**
   * 检测手势序列
   */
  private detectGestureSequence(): void {
    if (this.gestureHistory.length < 2) return;
    
    const recentGestures = this.gestureHistory.slice(-3);
    
    // 检测双击
    if (recentGestures.length >= 2) {
      const lastTwo = recentGestures.slice(-2);
      if (lastTwo[0].type === ARGestureType.TAP && 
          lastTwo[1].type === ARGestureType.TAP &&
          lastTwo[1].timestamp - lastTwo[0].timestamp < 500) {
        this.emit('doubleTap', {
          type: ARGestureType.DOUBLE_TAP,
          position: lastTwo[1].position,
          timestamp: lastTwo[1].timestamp
        });
      }
    }
    
    // 可以添加更多复杂的手势序列检测
  }

  /**
   * 执行射线投射
   */
  private performRaycast(screenX: number, screenY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((screenX - rect.left) / rect.width) * 2 - 1;
    const y = -((screenY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.engine.getCamera());
    // 配置射线层，允许在编辑网格时命中网格所在的第 1 层
    this.raycaster.layers.set(0);
    if (this.allowGridSelection) {
      this.raycaster.layers.enable(1);
    }
    
    // 获取场景中的物体
    const intersects = this.raycaster.intersectObjects(this.engine.getScene().children, true);
    const isGrid = (o: any) => !!(o?.isGridHelper) || !!(o?.userData && o.userData.isGrid);
    let chosen: THREE.Intersection | undefined;
    if (this.allowGridSelection) {
      const nonGrid = intersects.filter(i => !isGrid(i.object));
      const gridOnly = intersects.filter(i => isGrid(i.object));
      chosen = nonGrid[0] || gridOnly[0];
    } else {
      const nonGrid = intersects.filter(i => !isGrid(i.object));
      chosen = nonGrid[0];
    }
    
    if (chosen) {
      const intersect = chosen;
      this.emit('objectTapped', {
        object: intersect.object,
        point: intersect.point,
        distance: intersect.distance,
        face: intersect.face,
        uv: intersect.uv
      });
    } else {
      this.emit('emptySpaceTapped', {
        position: { x: screenX, y: screenY },
        rayDirection: this.raycaster.ray.direction
      });
    }
  }

  /**
   * 游戏手柄连接
   */
  private handleGamepadConnected(event: GamepadEvent): void {
    console.log('Gamepad connected:', event.gamepad);
    this.gamepadIndex = event.gamepad.index;
    this.startControllerPolling();
  }

  /**
   * 游戏手柄断开
   */
  private handleGamepadDisconnected(event: GamepadEvent): void {
    console.log('Gamepad disconnected:', event.gamepad);
    if (this.gamepadIndex === event.gamepad.index) {
      this.gamepadIndex = null;
      this.stopControllerPolling();
    }
  }

  /**
   * 开始控制器轮询
   */
  private startControllerPolling(): void {
    if (this.controllerPollingInterval) return;
    
    this.controllerPollingInterval = window.setInterval(() => {
      this.pollController();
    }, 16); // 60 FPS
  }

  /**
   * 停止控制器轮询
   */
  private stopControllerPolling(): void {
    if (this.controllerPollingInterval) {
      clearInterval(this.controllerPollingInterval);
      this.controllerPollingInterval = null;
    }
  }

  /**
   * 轮询控制器状态
   */
  private pollController(): void {
    if (this.gamepadIndex === null) return;
    
    const gamepad = navigator.getGamepads()[this.gamepadIndex];
    if (!gamepad) return;
    
    // 检测按钮按下
    gamepad.buttons.forEach((button, index) => {
      if (button.pressed) {
        this.emit('controllerButton', {
          buttonIndex: index,
          value: button.value,
          pressed: button.pressed
        });
      }
    });
    
    // 检测摇杆移动
    if (gamepad.axes.length >= 2) {
      const [x, y] = gamepad.axes;
      if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) {
        this.emit('controllerAxis', {
          axis: 'left-stick',
          x,
          y
        });
      }
    }
    
    if (gamepad.axes.length >= 4) {
      const [x, y] = gamepad.axes.slice(2);
      if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) {
        this.emit('controllerAxis', {
          axis: 'right-stick',
          x,
          y
        });
      }
    }
  }

  /**
   * 处理语音结果
   */
  private handleVoiceResult(event: any): void {
    const results = event.results;
    const lastResult = results[results.length - 1];
    
    if (lastResult.isFinal) {
      const transcript = lastResult[0].transcript.toLowerCase().trim();
      
      // 查找匹配的语音命令
      for (const [command, voiceCommand] of this.voiceCommands) {
        if (transcript.includes(command.toLowerCase())) {
          this.emit('voiceCommand', {
            command: voiceCommand,
            transcript,
            confidence: lastResult[0].confidence
          });
          break;
        }
      }
      
      this.emit('voiceResult', {
        transcript,
        confidence: lastResult[0].confidence,
        isFinal: true
      });
    } else {
      // 临时结果
      this.emit('voiceResult', {
        transcript: lastResult[0].transcript,
        confidence: lastResult[0].confidence,
        isFinal: false
      });
    }
  }

  /**
   * 添加语音命令
   */
  addVoiceCommand(keyword: string, command: ARVoiceCommand): void {
    this.voiceCommands.set(keyword, command);
  }

  /**
   * 移除语音命令
   */
  removeVoiceCommand(keyword: string): void {
    this.voiceCommands.delete(keyword);
  }

  /**
   * 开始语音识别
   */
  startVoiceRecognition(): void {
    if (!this.recognition) {
      console.warn('Speech recognition not supported');
      return;
    }
    
    try {
      this.recognition.start();
      this.isVoiceActive = true;
      this.emit('voiceStarted');
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      this.emit('voiceError', { error });
    }
  }

  /**
   * 停止语音识别
   */
  stopVoiceRecognition(): void {
    if (!this.recognition) return;
    
    this.isVoiceActive = false;
    this.recognition.stop();
    this.emit('voiceStopped');
  }

  /**
   * 设置交互模式
   */
  setInteractionMode(mode: ARInteractionMode): void {
    this.interactionMode = mode;
    this.emit('interactionModeChanged', { mode });
  }

  /**
   * 获取当前交互模式
   */
  getInteractionMode(): ARInteractionMode {
    return this.interactionMode;
  }

  /**
   * 激活交互系统
   */
  activate(): void {
    this.isActive = true;
    this.emit('activated');
  }

  /**
   * 停用交互系统
   */
  deactivate(): void {
    this.isActive = false;
    this.stopVoiceRecognition();
    this.stopControllerPolling();
    this.emit('deactivated');
  }

  /**
   * 获取手势历史
   */
  getGestureHistory(): ARGestureEvent[] {
    return [...this.gestureHistory];
  }

  /**
   * 清除手势历史
   */
  clearGestureHistory(): void {
    this.gestureHistory = [];
  }

  /**
   * 获取活跃的触摸点
   */
  getActiveTouchPoints(): ARTouchPoint[] {
    return Array.from(this.touchPoints.values()).filter(t => t.isActive);
  }

  /**
   * 销毁交互系统
   */
  dispose(): void {
    this.deactivate();
    
    // 移除事件监听器
    this.canvas.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    this.canvas.removeEventListener('touchcancel', this.handleTouchCancel.bind(this));
    this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.removeEventListener('wheel', this.handleWheel.bind(this));
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('keyup', this.handleKeyUp.bind(this));
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected.bind(this));
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected.bind(this));
    
    this.removeAllListeners();
  }
}