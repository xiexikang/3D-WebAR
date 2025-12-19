/**
 * 浏览器兼容的事件发射器
 * 替代 Node.js 的 EventEmitter
 */
export class EventEmitter {
  private events: Map<string, Array<(...args: any[]) => void>> = new Map();

  /**
   * 添加事件监听器
   */
  on(event: string, listener: (...args: any[]) => void): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
    return this;
  }

  /**
   * 添加一次性事件监听器
   */
  once(event: string, listener: (...args: any[]) => void): this {
    const onceListener = (...args: any[]) => {
      this.off(event, onceListener);
      listener(...args);
    };
    return this.on(event, onceListener);
  }

  /**
   * 移除事件监听器
   */
  off(event: string, listener: (...args: any[]) => void): this {
    if (!this.events.has(event)) {
      return this;
    }

    const listeners = this.events.get(event)!;
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }

    if (listeners.length === 0) {
      this.events.delete(event);
    }

    return this;
  }

  /**
   * 移除指定事件的所有监听器
   */
  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  /**
   * 触发事件
   */
  emit(event: string, ...args: any[]): boolean {
    if (!this.events.has(event)) {
      return false;
    }

    const listeners = this.events.get(event)!;
    // 创建副本以避免在迭代过程中修改数组
    const listenersCopy = [...listeners];
    
    listenersCopy.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error);
      }
    });

    return true;
  }

  /**
   * 获取指定事件的监听器数量
   */
  listenerCount(event: string): number {
    return this.events.get(event)?.length || 0;
  }

  /**
   * 获取所有事件名称
   */
  eventNames(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * 获取指定事件的所有监听器
   */
  listeners(event: string): Array<(...args: any[]) => void> {
    return this.events.get(event) || [];
  }

  /**
   * 设置最大监听器数量（兼容 Node.js API，但这里不限制）
   */
  setMaxListeners(n: number): this {
    // 浏览器环境下不限制监听器数量
    return this;
  }

  /**
   * 获取最大监听器数量
   */
  getMaxListeners(): number {
    return Infinity;
  }

  /**
   * 添加事件监听器（别名）
   */
  addListener(event: string, listener: (...args: any[]) => void): this {
    return this.on(event, listener);
  }

  /**
   * 移除事件监听器（别名）
   */
  removeListener(event: string, listener: (...args: any[]) => void): this {
    return this.off(event, listener);
  }

  /**
   * 在指定事件之前添加监听器
   */
  prependListener(event: string, listener: (...args: any[]) => void): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.unshift(listener);
    return this;
  }

  /**
   * 在指定事件之前添加一次性监听器
   */
  prependOnceListener(event: string, listener: (...args: any[]) => void): this {
    const onceListener = (...args: any[]) => {
      this.off(event, onceListener);
      listener(...args);
    };
    return this.prependListener(event, onceListener);
  }
}