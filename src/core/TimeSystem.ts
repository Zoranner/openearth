/**
 * 时间系统模块
 * 负责统一管理系统时间、时间缩放和时间同步
 */

import { Observable } from '@babylonjs/core';
import { logger } from '../utils/Logger';

/**
 * 时间事件类型枚举
 */
export enum TimeEventType {
  TIME_CHANGED = 'TIME_CHANGED',
  TIME_SCALE_CHANGED = 'TIME_SCALE_CHANGED',
  TIME_PAUSED = 'TIME_PAUSED',
  TIME_RESUMED = 'TIME_RESUMED',
  TIME_RESET = 'TIME_RESET',
  TIME_JUMPED = 'TIME_JUMPED',
}

/**
 * 时间事件接口
 */
export interface TimeEvent {
  type: TimeEventType;
  currentTime: Date;
  previousTime: Date;
  timeScale: number;
  elapsedTime: number;
}

/**
 * 时间系统配置接口
 */
export interface TimeSystemConfig {
  initialTime?: Date;
  timeScale?: number;
  enableRealTime?: boolean;
  enablePause?: boolean;
  enableReset?: boolean;
  enableTimeJump?: boolean;
  timeZone?: number;
  enableTimeZoneConversion?: boolean;
}

/**
 * 时区转换器
 */
class TimeZoneConverter {
  /**
   * 将本地时间转换为UTC时间
   */
  public convertToUTC(localTime: Date, timeZone: number): Date {
    const utcTime = new Date(localTime.getTime() - timeZone * 60 * 60 * 1000);
    return utcTime;
  }

  /**
   * 将UTC时间转换为本地时间
   */
  public convertFromUTC(utcTime: Date, timeZone: number): Date {
    const localTime = new Date(utcTime.getTime() + timeZone * 60 * 60 * 1000);
    return localTime;
  }

  /**
   * 获取当前时区
   */
  public getCurrentTimeZone(): number {
    return -new Date().getTimezoneOffset() / 60;
  }

  /**
   * 获取时区偏移量（小时）
   */
  public getTimeZoneOffset(timeZone: number): number {
    return timeZone;
  }
}

/**
 * 时间验证器
 */
class TimeValidator {
  /**
   * 验证时间格式和范围
   */
  public validateTime(time: Date): boolean {
    return time instanceof Date && !isNaN(time.getTime());
  }

  /**
   * 验证时间缩放因子
   */
  public validateTimeScale(scale: number): boolean {
    return typeof scale === 'number' && scale >= 0 && scale <= 10000;
  }

  /**
   * 验证时区
   */
  public validateTimeZone(timeZone: number): boolean {
    return typeof timeZone === 'number' && timeZone >= -12 && timeZone <= 14;
  }

  /**
   * 标准化时间
   */
  public normalizeTime(time: Date): Date {
    return new Date(time.getTime());
  }
}

/**
 * 时间系统类
 * 负责统一管理系统时间、时间缩放和时间同步
 */
export class TimeSystem {
  private _currentTime: Date;
  private _timeScale: number;
  private _isPaused: boolean;
  private _startTime: Date;
  private _elapsedTime: number;
  private _isInitialized: boolean;
  private _config: TimeSystemConfig;
  private _timeObservable: Observable<TimeEvent>;
  private _timeZoneConverter: TimeZoneConverter;
  private _timeValidator: TimeValidator;
  private _lastUpdateTime = 0;
  private _eventThrottleInterval = 16; // 约60fps的事件更新频率

  constructor(config: TimeSystemConfig = {}) {
    this._config = {
      initialTime: new Date(),
      timeScale: 1.0,
      enableRealTime: true,
      enablePause: true,
      enableReset: true,
      enableTimeJump: true,
      timeZone: 0,
      enableTimeZoneConversion: false,
      ...config,
    };

    this._currentTime = this._config.initialTime ?? new Date();
    this._timeScale = this._config.timeScale ?? 1.0;
    this._isPaused = false;
    this._startTime = new Date(this._currentTime);
    this._elapsedTime = 0;
    this._isInitialized = false;
    this._timeObservable = new Observable<TimeEvent>();
    this._timeZoneConverter = new TimeZoneConverter();
    this._timeValidator = new TimeValidator();

    logger.debug('TimeSystem created', 'TimeSystem', { config: this._config });
  }

  /**
   * 初始化时间系统
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      logger.warn('TimeSystem already initialized', 'TimeSystem');
      return;
    }

    try {
      // 验证配置参数
      if (!this._timeValidator.validateTime(this._currentTime)) {
        throw new Error('Invalid initial time');
      }

      if (!this._timeValidator.validateTimeScale(this._timeScale)) {
        throw new Error('Invalid time scale');
      }

      const timeZone = this._config.timeZone ?? 0;
      if (!this._timeValidator.validateTimeZone(timeZone)) {
        throw new Error('Invalid time zone');
      }

      // 应用时区转换
      if (this._config.enableTimeZoneConversion) {
        this._currentTime = this._timeZoneConverter.convertToUTC(this._currentTime, timeZone);
      }

      this._startTime = new Date(this._currentTime);
      this._isInitialized = true;

      logger.info('TimeSystem initialized successfully', 'TimeSystem', {
        initialTime: this._currentTime.toISOString(),
        timeScale: this._timeScale,
        timeZone,
      });
    } catch (error) {
      logger.error('Failed to initialize TimeSystem', 'TimeSystem', error);
      throw error;
    }
  }

  /**
   * 销毁时间系统
   */
  public dispose(): void {
    if (!this._isInitialized) {
      return;
    }

    this._timeObservable.clear();
    this._isInitialized = false;

    logger.info('TimeSystem disposed', 'TimeSystem');
  }

  /**
   * 更新时间状态
   */
  public update(deltaTime: number): void {
    if (!this._isInitialized || this._isPaused) {
      return;
    }

    const now = performance.now();

    // 事件节流：限制时间变化事件的频率
    if (now - this._lastUpdateTime < this._eventThrottleInterval) {
      // 仍然更新时间，但不广播事件
      const timeDelta = deltaTime * 1000 * this._timeScale; // 转换为毫秒
      this._currentTime = new Date(this._currentTime.getTime() + timeDelta);
      this._elapsedTime += timeDelta;
      return;
    }

    const previousTime = new Date(this._currentTime);
    const timeDelta = deltaTime * 1000 * this._timeScale; // 转换为毫秒

    this._currentTime = new Date(this._currentTime.getTime() + timeDelta);
    this._elapsedTime += timeDelta;
    this._lastUpdateTime = now;

    // 广播时间变化事件
    this._broadcastTimeEvent(TimeEventType.TIME_CHANGED, previousTime);
  }

  /**
   * 设置当前时间
   */
  public setTime(time: Date): void {
    if (!this._timeValidator.validateTime(time)) {
      throw new Error('Invalid time');
    }

    const previousTime = new Date(this._currentTime);
    this._currentTime = this._timeValidator.normalizeTime(time);

    logger.info('Time set', 'TimeSystem', {
      previousTime: previousTime.toISOString(),
      newTime: this._currentTime.toISOString(),
    });

    // 广播时间跳转事件
    this._broadcastTimeEvent(TimeEventType.TIME_JUMPED, previousTime);
  }

  /**
   * 获取当前时间
   */
  public getTime(): Date {
    return new Date(this._currentTime);
  }

  /**
   * 设置时间缩放因子
   */
  public setTimeScale(scale: number): void {
    if (!this._timeValidator.validateTimeScale(scale)) {
      throw new Error('Invalid time scale');
    }

    const previousScale = this._timeScale;
    this._timeScale = scale;

    logger.info('Time scale changed', 'TimeSystem', {
      previousScale,
      newScale: this._timeScale,
    });

    // 广播时间缩放变化事件
    this._broadcastTimeEvent(TimeEventType.TIME_SCALE_CHANGED, this._currentTime);
  }

  /**
   * 获取时间缩放因子
   */
  public getTimeScale(): number {
    return this._timeScale;
  }

  /**
   * 暂停时间
   */
  public pause(): void {
    if (!this._config.enablePause || this._isPaused) {
      return;
    }

    this._isPaused = true;
    logger.info('Time paused', 'TimeSystem');
    this._broadcastTimeEvent(TimeEventType.TIME_PAUSED, this._currentTime);
  }

  /**
   * 恢复时间
   */
  public resume(): void {
    if (!this._config.enablePause || !this._isPaused) {
      return;
    }

    this._isPaused = false;
    logger.info('Time resumed', 'TimeSystem');
    this._broadcastTimeEvent(TimeEventType.TIME_RESUMED, this._currentTime);
  }

  /**
   * 检查是否暂停
   */
  public isPaused(): boolean {
    return this._isPaused;
  }

  /**
   * 重置时间
   */
  public reset(): void {
    if (!this._config.enableReset) {
      return;
    }

    const previousTime = new Date(this._currentTime);
    this._currentTime = new Date(this._startTime);
    this._elapsedTime = 0;

    logger.info('Time reset', 'TimeSystem', {
      resetToTime: this._currentTime.toISOString(),
    });

    // 广播时间重置事件
    this._broadcastTimeEvent(TimeEventType.TIME_RESET, previousTime);
  }

  /**
   * 获取经过的时间（毫秒）
   */
  public getElapsedTime(): number {
    return this._elapsedTime;
  }

  /**
   * 跳转到指定时间
   */
  public jumpToTime(time: Date): void {
    if (!this._config.enableTimeJump) {
      return;
    }

    this.setTime(time);
  }

  /**
   * 获取时间观察者
   */
  public getTimeObservable(): Observable<TimeEvent> {
    return this._timeObservable;
  }

  /**
   * 广播时间事件
   */
  private _broadcastTimeEvent(type: TimeEventType, previousTime: Date): void {
    const event: TimeEvent = {
      type,
      currentTime: new Date(this._currentTime),
      previousTime,
      timeScale: this._timeScale,
      elapsedTime: this._elapsedTime,
    };

    try {
      this._timeObservable.notifyObservers(event);
    } catch (error) {
      logger.error('Error broadcasting time event', 'TimeSystem', {
        eventType: type,
        error,
      });
    }
  }

  /**
   * 获取配置
   */
  public getConfig(): TimeSystemConfig {
    return { ...this._config };
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<TimeSystemConfig>): void {
    const oldConfig = { ...this._config };
    this._config = { ...this._config, ...newConfig };

    // 如果时间缩放发生变化，更新它
    if (newConfig.timeScale !== undefined && newConfig.timeScale !== this._timeScale) {
      this.setTimeScale(newConfig.timeScale);
    }

    logger.info('TimeSystem config updated', 'TimeSystem', {
      oldConfig,
      newConfig: this._config,
    });
  }

  /**
   * 获取系统状态信息
   */
  public getStatus(): {
    isInitialized: boolean;
    isPaused: boolean;
    currentTime: Date;
    timeScale: number;
    elapsedTime: number;
    observerCount: number;
  } {
    return {
      isInitialized: this._isInitialized,
      isPaused: this._isPaused,
      currentTime: new Date(this._currentTime),
      timeScale: this._timeScale,
      elapsedTime: this._elapsedTime,
      observerCount: this._timeObservable.observers.length,
    };
  }
}
