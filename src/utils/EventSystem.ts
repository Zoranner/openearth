/**
 * 事件系统
 * 提供模块间事件发布和订阅功能
 */

import { logger } from './Logger';

// 定义事件数据的通用类型
export type EventData = unknown;

export type EventCallback<T = EventData> = (data: T) => void;

export interface EventSubscription {
  unsubscribe(): void;
}

export class EventBus {
  private static instance: EventBus;
  private events: Map<string, EventCallback[]> = new Map();

  private constructor() {}

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * 订阅事件
   */
  subscribe<T>(eventName: string, callback: EventCallback<T>): EventSubscription {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }

    const callbacks = this.events.get(eventName);
    if (callbacks) {
      // 类型断言，因为我们在同一个 Map 中存储不同类型的回调
      callbacks.push(callback as EventCallback);
    }

    return {
      unsubscribe: () => {
        const callbacks = this.events.get(eventName);
        if (callbacks) {
          const index = callbacks.indexOf(callback as EventCallback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }

          // 如果没有回调函数了，删除事件
          if (callbacks.length === 0) {
            this.events.delete(eventName);
          }
        }
      },
    };
  }

  /**
   * 发布事件
   */
  publish<T>(eventName: string, data?: T): void {
    const callbacks = this.events.get(eventName);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`Error in event callback for ${eventName}`, 'EventSystem', error);
        }
      });
    }
  }

  /**
   * 取消所有订阅
   */
  unsubscribeAll(eventName: string): void {
    this.events.delete(eventName);
  }

  /**
   * 清空所有事件
   */
  clear(): void {
    this.events.clear();
  }

  /**
   * 获取事件名称列表
   */
  getEventNames(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * 获取事件的订阅者数量
   */
  getSubscriberCount(eventName: string): number {
    const callbacks = this.events.get(eventName);
    return callbacks ? callbacks.length : 0;
  }
}

// 定义状态相关的类型
export interface StateValue {
  [key: string]: EventData;
}

export interface StateChangeEvent<T = EventData> {
  key: string;
  value: T;
  previousValue: T;
}

export interface StateDeleteEvent<T = EventData> {
  key: string;
  previousValue: T;
}

/**
 * 状态管理器
 */
export class StateManager {
  private static instance: StateManager;
  private state: Map<string, EventData> = new Map();
  private eventBus: EventBus;

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  /**
   * 设置状态
   */
  setState<T>(key: string, value: T): void {
    const previousValue = this.state.get(key);
    this.state.set(key, value);

    // 发布状态变化事件
    this.eventBus.publish(`state:${key}`, {
      key,
      value,
      previousValue,
    });

    // 发布通用状态变化事件
    this.eventBus.publish('state:changed', {
      key,
      value,
      previousValue,
    });
  }

  /**
   * 获取状态
   */
  getState<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  /**
   * 获取状态，如果不存在则返回默认值
   */
  getStateWithDefault<T>(key: string, defaultValue: T): T {
    return this.state.has(key) ? (this.state.get(key) as T) : defaultValue;
  }

  /**
   * 检查状态是否存在
   */
  hasState(key: string): boolean {
    return this.state.has(key);
  }

  /**
   * 删除状态
   */
  deleteState(key: string): boolean {
    const previousValue = this.state.get(key);

    if (this.state.delete(key)) {
      this.eventBus.publish(`state:${key}`, {
        key,
        value: undefined,
        previousValue,
      });

      this.eventBus.publish('state:deleted', {
        key,
        previousValue,
      });

      return true;
    }

    return false;
  }

  /**
   * 订阅状态变化
   */
  subscribeToState<T>(key: string, callback: EventCallback<StateChangeEvent<T>>): EventSubscription {
    return this.eventBus.subscribe(`state:${key}`, callback);
  }

  /**
   * 订阅所有状态变化
   */
  subscribeToAllStates(callback: EventCallback<StateChangeEvent<EventData>>): EventSubscription {
    return this.eventBus.subscribe('state:changed', callback);
  }

  /**
   * 清空所有状态
   */
  clear(): void {
    const keys = Array.from(this.state.keys());
    this.state.clear();

    keys.forEach(key => {
      this.eventBus.publish(`state:${key}`, {
        key,
        value: undefined,
        previousValue: undefined,
      });
    });

    this.eventBus.publish('state:cleared', {});
  }

  /**
   * 获取所有状态键
   */
  getStateKeys(): string[] {
    return Array.from(this.state.keys());
  }

  /**
   * 获取所有状态
   */
  getAllStates(): Record<string, EventData> {
    const result: Record<string, EventData> = {};
    this.state.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}

// 创建全局实例
export const eventBus = EventBus.getInstance();
export const stateManager = StateManager.getInstance();
