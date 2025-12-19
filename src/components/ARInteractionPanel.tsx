import React, { useState, useEffect, useRef } from 'react';
import { ARInteractionSystem } from '../core/ARInteractionSystem';
import { ARGestureEvent, ARInteractionMode, ARGestureType, ARVoiceCommand } from '../types/webar';

/**
 * AR 交互面板 Props
 */
interface ARInteractionPanelProps {
  interactionSystem: ARInteractionSystem | null;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * AR 交互控制面板
 * 提供手势识别、语音控制、触摸交互的可视化界面
 */
export const ARInteractionPanel: React.FC<ARInteractionPanelProps> = ({
  interactionSystem,
  className,
  style
}) => {
  const [gestureHistory, setGestureHistory] = useState<ARGestureEvent[]>([]);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [currentMode, setCurrentMode] = useState<ARInteractionMode>(ARInteractionMode.TOUCH);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceConfidence, setVoiceConfidence] = useState(0);
  const [activeTouches, setActiveTouches] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [customCommands, setCustomCommands] = useState<ARVoiceCommand[]>([]);
  const [newCommandKeyword, setNewCommandKeyword] = useState('');
  const [newCommandAction, setNewCommandAction] = useState('');

  const maxGestureHistory = 10;
  const gestureTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!interactionSystem) return;

    // 设置事件监听器
    const handleGesture = (event: ARGestureEvent) => {
      setGestureHistory(prev => {
        const newHistory = [...prev, event];
        return newHistory.slice(-maxGestureHistory);
      });

      // 自动清除手势显示
      if (gestureTimeoutRef.current) {
        clearTimeout(gestureTimeoutRef.current);
      }
      gestureTimeoutRef.current = setTimeout(() => {
        setGestureHistory([]);
      }, 3000);
    };

    const handleVoiceResult = (data: any) => {
      setVoiceTranscript(data.transcript);
      setVoiceConfidence(data.confidence);
      
      if (data.isFinal) {
        setTimeout(() => {
          setVoiceTranscript('');
          setVoiceConfidence(0);
        }, 2000);
      }
    };

    const handleVoiceCommand = (data: any) => {
      console.log('Voice command executed:', data.command);
    };

    const handleTouchStart = () => {
      setActiveTouches(prev => prev + 1);
    };

    const handleTouchEnd = () => {
      setActiveTouches(prev => Math.max(0, prev - 1));
    };

    const handleInteractionModeChanged = (data: any) => {
      setCurrentMode(data.mode);
    };

    interactionSystem.on('gesture', handleGesture);
    interactionSystem.on('voiceResult', handleVoiceResult);
    interactionSystem.on('voiceCommand', handleVoiceCommand);
    interactionSystem.on('touchStart', handleTouchStart);
    interactionSystem.on('touchEnd', handleTouchEnd);
    interactionSystem.on('interactionModeChanged', handleInteractionModeChanged);

    return () => {
      interactionSystem.off('gesture', handleGesture);
      interactionSystem.off('voiceResult', handleVoiceResult);
      interactionSystem.off('voiceCommand', handleVoiceCommand);
      interactionSystem.off('touchStart', handleTouchStart);
      interactionSystem.off('touchEnd', handleTouchEnd);
      interactionSystem.off('interactionModeChanged', handleInteractionModeChanged);
    };
  }, [interactionSystem]);

  /**
   * 切换语音监听状态
   */
  const toggleVoiceRecognition = () => {
    if (!interactionSystem) return;

    if (isVoiceActive) {
      interactionSystem.stopVoiceRecognition();
      setIsVoiceActive(false);
      setIsListening(false);
    } else {
      interactionSystem.startVoiceRecognition();
      setIsVoiceActive(true);
      setIsListening(true);
    }
  };

  /**
   * 切换交互模式
   */
  const toggleInteractionMode = () => {
    if (!interactionSystem) return;

    const modes = [
      ARInteractionMode.TOUCH,
      ARInteractionMode.GESTURE,
      ARInteractionMode.VOICE,
      ARInteractionMode.CONTROLLER
    ];
    
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    
    interactionSystem.setInteractionMode(nextMode);
  };

  /**
   * 添加自定义语音命令
   */
  const addCustomCommand = () => {
    if (!interactionSystem || !newCommandKeyword.trim() || !newCommandAction.trim()) return;

    const command: ARVoiceCommand = {
      keyword: newCommandKeyword.trim(),
      action: newCommandAction.trim(),
      description: `自定义命令: ${newCommandKeyword}`,
      confidenceThreshold: 0.7
    };

    interactionSystem.addVoiceCommand(command.keyword, command);
    setCustomCommands(prev => [...prev, command]);
    setNewCommandKeyword('');
    setNewCommandAction('');
  };

  /**
   * 清除手势历史
   */
  const clearGestureHistory = () => {
    if (!interactionSystem) return;
    interactionSystem.clearGestureHistory();
    setGestureHistory([]);
  };

  /**
   * 获取手势图标
   */
  const getGestureIcon = (type: ARGestureType): string => {
    switch (type) {
      case ARGestureType.TAP:
        return '👆';
      case ARGestureType.DOUBLE_TAP:
        return '👆👆';
      case ARGestureType.LONG_PRESS:
        return '✋';
      case ARGestureType.SWIPE_UP:
        return '👆';
      case ARGestureType.SWIPE_DOWN:
        return '👇';
      case ARGestureType.SWIPE_LEFT:
        return '👈';
      case ARGestureType.SWIPE_RIGHT:
        return '👉';
      case ARGestureType.PINCH:
        return '🤏';
      case ARGestureType.ZOOM:
        return '🔍';
      case ARGestureType.DRAG:
        return '✋';
      default:
        return '👋';
    }
  };

  /**
   * 获取模式图标
   */
  const getModeIcon = (mode: ARInteractionMode): string => {
    switch (mode) {
      case ARInteractionMode.TOUCH:
        return '👆';
      case ARInteractionMode.GESTURE:
        return '👋';
      case ARInteractionMode.VOICE:
        return '🎤';
      case ARInteractionMode.CONTROLLER:
        return '🎮';
      default:
        return '👆';
    }
  };

  /**
   * 获取模式名称
   */
  const getModeName = (mode: ARInteractionMode): string => {
    switch (mode) {
      case ARInteractionMode.TOUCH:
        return '触摸模式';
      case ARInteractionMode.GESTURE:
        return '手势模式';
      case ARInteractionMode.VOICE:
        return '语音模式';
      case ARInteractionMode.CONTROLLER:
        return '控制器模式';
      default:
        return '触摸模式';
    }
  };

  if (!interactionSystem) {
    return (
      <div className={`ar-interaction-panel ${className || ''}`} style={style}>
        <div style={{
          padding: '20px',
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: 'white',
          borderRadius: '8px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
          <div>交互系统未初始化</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`ar-interaction-panel ${className || ''}`} style={style}>
      {/* 主要控制面板 */}
      <div style={{
        backgroundColor: 'rgba(0,0,0,0.9)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        backdropFilter: 'blur(10px)',
        minWidth: '250px',
        border: '1px solid rgba(255,255,255,0.3)'
      }}>
        <h3 style={{
          margin: '0 0 15px 0',
          fontSize: '16px',
          textAlign: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.3)',
          paddingBottom: '10px'
        }}>
          🎮 AR 交互控制
        </h3>

        {/* 交互模式切换 */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>
            当前模式: {getModeName(currentMode)}
          </div>
          <button
            onClick={toggleInteractionMode}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {getModeIcon(currentMode)} 切换模式
          </button>
        </div>

        {/* 语音控制 */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>
            🎤 语音控制
          </div>
          <button
            onClick={toggleVoiceRecognition}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: isVoiceActive ? '#f44336' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {isVoiceActive ? '⏹️ 停止监听' : '🎤 开始监听'}
          </button>
          
          {/* 语音识别结果显示 */}
          {voiceTranscript && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              <div>识别: "{voiceTranscript}"</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
                置信度: {(voiceConfidence * 100).toFixed(1)}%
              </div>
            </div>
          )}
          
          {isListening && !voiceTranscript && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              backgroundColor: 'rgba(76,175,80,0.2)',
              borderRadius: '4px',
              fontSize: '12px',
              textAlign: 'center'
            }}>
              🎤 正在监听...
            </div>
          )}
        </div>

        {/* 触摸状态 */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>
            👆 触摸状态
          </div>
          <div style={{
            padding: '8px',
            backgroundColor: activeTouches > 0 ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            fontSize: '12px',
            textAlign: 'center'
          }}>
            {activeTouches > 0 ? `活跃触摸点: ${activeTouches}` : '无触摸'}
          </div>
        </div>

        {/* 手势历史 */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '5px'
          }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
              👋 手势历史
            </div>
            <button
              onClick={clearGestureHistory}
              style={{
                padding: '2px 6px',
                backgroundColor: 'transparent',
                color: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              清除
            </button>
          </div>
          
          {gestureHistory.length > 0 ? (
            <div style={{
              maxHeight: '80px',
              overflowY: 'auto',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '4px',
              padding: '8px'
            }}>
              {gestureHistory.map((gesture, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: index < gestureHistory.length - 1 ? '4px' : '0',
                  fontSize: '11px'
                }}>
                  <span style={{ marginRight: '8px' }}>{getGestureIcon(gesture.type)}</span>
                  <span style={{ flex: 1 }}>
                    {ARGestureType[gesture.type]}
                  </span>
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>
                    {new Date(gesture.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '8px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '4px',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.6)',
              textAlign: 'center'
            }}>
              暂无手势记录
            </div>
          )}
        </div>

        {/* 自定义语音命令 */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>
            📝 自定义命令
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <input
              type="text"
              placeholder="关键词"
              value={newCommandKeyword}
              onChange={(e) => setNewCommandKeyword(e.target.value)}
              style={{
                width: '100%',
                padding: '4px',
                marginBottom: '4px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '2px',
                color: 'white',
                fontSize: '11px'
              }}
            />
            <input
              type="text"
              placeholder="动作描述"
              value={newCommandAction}
              onChange={(e) => setNewCommandAction(e.target.value)}
              style={{
                width: '100%',
                padding: '4px',
                marginBottom: '4px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '2px',
                color: 'white',
                fontSize: '11px'
              }}
            />
            <button
              onClick={addCustomCommand}
              disabled={!newCommandKeyword.trim() || !newCommandAction.trim()}
              style={{
                width: '100%',
                padding: '4px',
                backgroundColor: newCommandKeyword.trim() && newCommandAction.trim() ? '#4CAF50' : 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '2px',
                cursor: newCommandKeyword.trim() && newCommandAction.trim() ? 'pointer' : 'not-allowed',
                fontSize: '10px'
              }}
            >
              添加命令
            </button>
          </div>
          
          {customCommands.length > 0 && (
            <div style={{
              maxHeight: '60px',
              overflowY: 'auto',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '4px',
              padding: '6px'
            }}>
              {customCommands.map((command, index) => (
                <div key={index} style={{
                  fontSize: '10px',
                  marginBottom: index < customCommands.length - 1 ? '2px' : '0',
                  color: 'rgba(255,255,255,0.8)'
                }}>
                  • {command.keyword} → {command.action}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 状态指示器 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          padding: '8px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: '4px',
          fontSize: '10px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', marginBottom: '2px' }}>👆</div>
            <div style={{ color: activeTouches > 0 ? '#4CAF50' : 'rgba(255,255,255,0.5)' }}>
              {activeTouches > 0 ? '活跃' : '待命中'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', marginBottom: '2px' }}>🎤</div>
            <div style={{ color: isVoiceActive ? '#4CAF50' : 'rgba(255,255,255,0.5)' }}>
              {isVoiceActive ? '监听中' : '已停止'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', marginBottom: '2px' }}>🎮</div>
            <div style={{ color: 'rgba(255,255,255,0.5)' }}>
              待命中
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ARInteractionPanel;