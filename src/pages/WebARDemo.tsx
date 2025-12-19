import React, { useEffect, useMemo, useState } from 'react';
import WebARComponent from '../components/WebARComponent';
import { ARSession } from '../types/webar';

/**
 * WebAR 演示页面
 */
const WebARDemo: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [viewport, setViewport] = useState({ w: 800, h: 600 });
  const [theme, setTheme] = useState<'indigo' | 'teal' | 'amber' | 'pink'>('indigo');
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const [animateBg, setAnimateBg] = useState(true);
  const [anim, setAnim] = useState(0);

  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (!animateBg) return;
    let raf = 0;
    const tick = () => {
      setAnim(a => (a + 0.5) % 100);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animateBg]);

  const bgStyle = useMemo(() => {
    const palette: Record<string, { g1: string; g2: string; base: string }> = {
      indigo: { g1: 'rgba(79,70,229,0.35)', g2: 'rgba(147,51,234,0.30)', base: mode === 'dark' ? '#0f172a' : '#f3f4f6' },
      teal: { g1: 'rgba(13,148,136,0.35)', g2: 'rgba(6,182,212,0.30)', base: mode === 'dark' ? '#0b1324' : '#f3f4f6' },
      amber: { g1: 'rgba(245,158,11,0.35)', g2: 'rgba(239,68,68,0.30)', base: mode === 'dark' ? '#1a1200' : '#fff7ed' },
      pink: { g1: 'rgba(236,72,153,0.35)', g2: 'rgba(99,102,241,0.30)', base: mode === 'dark' ? '#160d18' : '#fde2f5' }
    };
    const p = palette[theme];
    return {
      background: `radial-gradient(1200px 600px at 20% 20%, ${p.g1}, transparent), radial-gradient(1000px 500px at 80% 30%, ${p.g2}, transparent), linear-gradient(135deg, ${p.base} 0%, #111827 60%, #1f2937 100%)`
    };
  }, [theme, mode]);

  /**
   * 处理会话开始
   */
  const handleSessionStart = (session: ARSession) => {
    console.log('AR 会话已启动:', session);
    setIsSessionActive(true);
  };

  /**
   * 处理会话结束
   */
  const handleSessionEnd = (session: ARSession) => {
    console.log('AR 会话已结束:', session);
    setIsSessionActive(false);
  };

  /**
   * 处理模型加载
   */
  const handleModelLoaded = (model: any) => {
    console.log('模型已加载:', model);
  };

  /**
   * 处理错误
   */
  const handleError = (error: any) => {
    console.error('WebAR 错误:', error);
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      position: 'relative',
      ...bgStyle,
      color: '#e5e7eb',
      fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial'
    }}>
      {animateBg && (
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(6,182,212,0.08) 100%)',
          backgroundSize: '200% 200%',
          backgroundPosition: `${anim}% ${anim}%`,
          transition: 'background-position 0.1s linear'
        }} />
      )}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        padding: '10px 14px',
        borderRadius: '10px',
        backdropFilter: 'saturate(180%) blur(10px)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03))',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)'
      }}>
        <div style={{ fontWeight: 700, letterSpacing: '0.5px' }}>WebAR AI</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>状态: {isSessionActive ? 'Active' : 'Idle'}</div>
      </div>

      <WebARComponent
        width={viewport.w}
        height={viewport.h}
        theme={theme}
        autoStart={true}
        onSessionStart={handleSessionStart}
        onSessionEnd={handleSessionEnd}
        onModelLoaded={handleModelLoaded}
        onError={handleError}
        style={{ width: '100vw', height: '100vh' }}
      />
      
    </div>
  );
};

export default WebARDemo;