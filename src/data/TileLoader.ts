/**
 * 瓦片加载模块
 * 负责地理瓦片数据的异步加载和缓存管理
 */

import type { Vector3 } from '@babylonjs/core';
import { TaskPriority, TileKeyUtils, type TileKey } from '../types';
import type { DataSource } from './DataSource';
import { TileCache, type Tile } from './TileCache';
import { networkManager } from '../utils/NetworkManager';
import { logger } from '../utils/Logger';

export interface TileLoaderConfig {
  maxCacheSize?: number;
  maxConcurrentLoads?: number;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  dataSources?: DataSourceConfig[];
  maxMemory?: number;
}

export interface DataSourceConfig {
  name: string;
  type: string;
  url: string;
  attribution?: string;
  maxZoom: number;
  minZoom: number;
  format: string;
}

export interface LoadingTask {
  tileKey: TileKey;
  priority: TaskPriority;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  promise?: Promise<Tile>;
  abortController?: AbortController;
}

/**
 * 加载队列管理器
 */
class LoadingQueue {
  private _tasks: LoadingTask[] = [];
  private _activeTasks: Set<string> = new Set();
  private _maxConcurrent: number;

  constructor(maxConcurrent: number) {
    this._maxConcurrent = maxConcurrent;
  }

  /**
   * 将任务加入队列
   */
  enqueue(task: LoadingTask): void {
    const key = TileKeyUtils.toString(task.tileKey);

    // 如果任务已存在，更新优先级
    const existingIndex = this._tasks.findIndex(t => TileKeyUtils.toString(t.tileKey) === key);

    if (existingIndex >= 0) {
      const existingTask = this._tasks[existingIndex];
      if (task.priority === TaskPriority.HIGH && existingTask.priority !== TaskPriority.HIGH) {
        existingTask.priority = TaskPriority.HIGH;
        // 重新排序
        this._tasks.splice(existingIndex, 1);
        this._insertByPriority(existingTask);
      }
      return;
    }

    this._insertByPriority(task);
    logger.debug('Task enqueued', 'LoadingQueue', {
      key,
      priority: task.priority,
      queueSize: this._tasks.length,
    });
  }

  /**
   * 从队列中取出任务
   */
  dequeue(): LoadingTask | null {
    if (this._tasks.length === 0 || this._activeTasks.size >= this._maxConcurrent) {
      return null;
    }

    const task = this._tasks.shift();
    if (!task) {
      return null;
    }

    const key = TileKeyUtils.toString(task.tileKey);
    this._activeTasks.add(key);

    logger.debug('Task dequeued', 'LoadingQueue', {
      key,
      priority: task.priority,
      activeCount: this._activeTasks.size,
    });

    return task;
  }

  /**
   * 移除任务
   */
  remove(key: string): void {
    // 从队列中移除
    const queueIndex = this._tasks.findIndex(t => TileKeyUtils.toString(t.tileKey) === key);
    if (queueIndex >= 0) {
      this._tasks.splice(queueIndex, 1);
    }

    // 从活跃任务中移除
    this._activeTasks.delete(key);
  }

  /**
   * 清空队列
   */
  clear(): void {
    this._tasks = [];
    this._activeTasks.clear();
    logger.info('Loading queue cleared', 'LoadingQueue');
  }

  /**
   * 获取队列大小
   */
  getQueueSize(): number {
    return this._tasks.length;
  }

  /**
   * 获取活跃任务数量
   */
  getActiveCount(): number {
    return this._activeTasks.size;
  }

  /**
   * 按优先级插入任务
   */
  private _insertByPriority(task: LoadingTask): void {
    let insertIndex = this._tasks.length;

    for (let i = 0; i < this._tasks.length; i++) {
      if (this._getPriorityValue(task.priority) > this._getPriorityValue(this._tasks[i].priority)) {
        insertIndex = i;
        break;
      }
    }

    this._tasks.splice(insertIndex, 0, task);
  }

  /**
   * 获取优先级数值
   */
  private _getPriorityValue(priority: TaskPriority): number {
    switch (priority) {
      case TaskPriority.HIGH:
        return 3;
      case TaskPriority.NORMAL:
        return 2;
      case TaskPriority.LOW:
        return 1;
      default:
        return 0;
    }
  }
}

/**
 * 瓦片加载器
 */
export class TileLoader {
  private _cache: TileCache;
  private _queue: LoadingQueue;
  private _dataSources: Map<string, DataSource>;
  private _isInitialized: boolean;
  private _config: Required<TileLoaderConfig>;

  constructor(config: TileLoaderConfig = {}) {
    this._config = {
      maxCacheSize: config.maxCacheSize ?? 1000,
      maxConcurrentLoads: config.maxConcurrentLoads ?? 6,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      timeout: config.timeout ?? 30000,
      dataSources: config.dataSources ?? [],
      maxMemory: config.maxMemory ?? 256 * 1024 * 1024, // 256MB
    };

    this._cache = new TileCache(this._config.maxCacheSize, this._config.maxMemory);
    this._queue = new LoadingQueue(this._config.maxConcurrentLoads);
    this._dataSources = new Map();
    this._isInitialized = false;

    // 设置网络管理器参数
    networkManager.setMaxConcurrentRequests(this._config.maxConcurrentLoads);
    networkManager.setDefaultTimeout(this._config.timeout);
    networkManager.setDefaultRetries(this._config.retryAttempts);
    networkManager.setDefaultRetryDelay(this._config.retryDelay);

    logger.debug('TileLoader created', 'TileLoader', { config: this._config });
  }

  /**
   * 初始化瓦片加载器
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) {
      logger.warn('TileLoader already initialized', 'TileLoader');
      return;
    }

    try {
      // 初始化数据源
      // 这里可以根据配置初始化默认数据源

      this._isInitialized = true;
      logger.info('TileLoader initialized successfully', 'TileLoader');
    } catch (error) {
      logger.error('Failed to initialize TileLoader', 'TileLoader', error);
      throw error;
    }
  }

  /**
   * 销毁瓦片加载器
   */
  dispose(): void {
    if (!this._isInitialized) {
      return;
    }

    // 取消所有正在进行的请求
    networkManager.cancelAllRequests();

    // 清空队列和缓存
    this._queue.clear();
    this._cache.clear();

    this._isInitialized = false;
    logger.info('TileLoader disposed', 'TileLoader');
  }

  /**
   * 加载瓦片
   */
  async loadTile(tileKey: TileKey, priority: TaskPriority = TaskPriority.NORMAL): Promise<Tile> {
    const key = TileKeyUtils.toString(tileKey);

    // 检查缓存
    const cachedTile = this._cache.get(key);
    if (cachedTile) {
      return cachedTile;
    }

    // 创建加载任务
    const task: LoadingTask = {
      tileKey,
      priority,
      retryCount: 0,
      maxRetries: this._config.retryAttempts,
      createdAt: Date.now(),
    };

    // 创建Promise和AbortController
    const abortController = new AbortController();
    task.abortController = abortController;

    task.promise = this._executeLoadTask(task);

    // 加入队列
    this._queue.enqueue(task);

    // 处理队列
    this._processQueue();

    return task.promise;
  }

  /**
   * 预加载瓦片
   */
  preloadTiles(tileKeys: TileKey[]): void {
    tileKeys.forEach(tileKey => {
      const key = TileKeyUtils.toString(tileKey);
      if (!this._cache.has(key)) {
        this.loadTile(tileKey, TaskPriority.LOW).catch(error => {
          logger.debug('Preload failed', 'TileLoader', { key, error: error.message });
        });
      }
    });
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this._cache.clear();
    logger.info('Tile cache cleared', 'TileLoader');
  }

  /**
   * 更新相机位置
   */
  updateCameraPosition(position: Vector3): void {
    // 根据相机位置计算可见瓦片并预加载
    const visibleTiles = this._calculateVisibleTiles(position);
    this.preloadTiles(visibleTiles);
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return {
      ...this._cache.getStats(),
      ...this._cache.getMemoryStats(),
      queueSize: this._queue.getQueueSize(),
      activeLoads: this._queue.getActiveCount(),
    };
  }

  /**
   * 添加数据源
   */
  addDataSource(name: string, dataSource: DataSource): void {
    this._dataSources.set(name, dataSource);
    logger.info('Data source added', 'TileLoader', { name, type: dataSource.getType() });
  }

  /**
   * 移除数据源
   */
  removeDataSource(name: string): boolean {
    const removed = this._dataSources.delete(name);
    if (removed) {
      logger.info('Data source removed', 'TileLoader', { name });
    }
    return removed;
  }

  /**
   * 获取数据源
   */
  getDataSource(name: string): DataSource | undefined {
    return this._dataSources.get(name);
  }

  /**
   * 执行加载任务
   */
  private async _executeLoadTask(task: LoadingTask): Promise<Tile> {
    const key = TileKeyUtils.toString(task.tileKey);

    try {
      // 获取数据源
      const dataSource = this._dataSources.get(task.tileKey.source);
      if (!dataSource) {
        throw new Error(`Data source not found: ${task.tileKey.source}`);
      }

      // 获取URL
      const url = dataSource.getUrl(task.tileKey);

      // 发送请求
      const requestOptions: {
        timeout: number;
        retries: number;
        retryDelay: number;
        headers?: Record<string, string>;
        abortSignal?: AbortSignal;
      } = {
        timeout: this._config.timeout,
        retries: this._config.retryAttempts,
        retryDelay: this._config.retryDelay,
        headers: dataSource.getHeaders(),
      };

      if (task.abortController?.signal) {
        requestOptions.abortSignal = task.abortController.signal;
      }

      const response = await networkManager.get<ArrayBuffer>(url, requestOptions);

      // 验证响应数据类型
      if (!(response.data instanceof ArrayBuffer)) {
        throw new Error('Invalid response data type: expected ArrayBuffer');
      }

      // 创建瓦片对象
      const tile: Tile = {
        key: task.tileKey,
        data: response.data,
        isLoaded: true,
        loadTime: Date.now(),
        lastAccessed: Date.now(),
        size: response.data.byteLength,
      };

      // 添加到缓存
      this._cache.set(key, tile);

      logger.debug('Tile loaded successfully', 'TileLoader', {
        key,
        size: tile.size,
        loadTime: Date.now() - task.createdAt,
      });

      return tile;
    } catch (error) {
      logger.error('Failed to load tile', 'TileLoader', { key, error });
      throw error;
    } finally {
      // 从队列中移除任务
      this._queue.remove(key);
    }
  }

  /**
   * 处理加载队列
   */
  private _processQueue(): void {
    while (this._queue.getActiveCount() < this._config.maxConcurrentLoads) {
      const task = this._queue.dequeue();
      if (!task) break;

      // 异步执行任务
      if (task.promise) {
        task.promise.catch(() => {
          // 错误已在executeLoadTask中处理
        });
      }
    }
  }

  /**
   * 计算可见瓦片
   */
  private _calculateVisibleTiles(cameraPosition: Vector3): TileKey[] {
    // 这里是一个简化的实现
    // 实际应该根据相机的视锥体和地球表面计算可见的瓦片
    const visibleTiles: TileKey[] = [];

    // 根据相机距离确定LOD级别
    const distance = cameraPosition.length();
    const zoom = Math.max(0, Math.min(18, Math.floor(20 - Math.log2(distance / 1000))));

    // 计算相机对应的瓦片坐标
    const centerTile = this._worldToTile(cameraPosition, zoom);

    // 计算周围的瓦片
    const radius = 2; // 加载半径
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const x = centerTile.x + dx;
        const y = centerTile.y + dy;

        if (x >= 0 && y >= 0 && x < Math.pow(2, zoom) && y < Math.pow(2, zoom)) {
          visibleTiles.push({
            x,
            y,
            z: zoom,
            source: 'arcgis',
            layer: 'base',
          });
        }
      }
    }

    return visibleTiles;
  }

  /**
   * 世界坐标转瓦片坐标
   */
  private _worldToTile(position: Vector3, zoom: number): { x: number; y: number } {
    // 简化的坐标转换
    const tileCount = Math.pow(2, zoom);
    const x = Math.floor(((position.x + 1) * tileCount) / 2);
    const y = Math.floor(((1 - position.z) * tileCount) / 2);

    return { x, y };
  }

  /**
   * 获取系统状态
   */
  getStatus(): {
    isInitialized: boolean;
    cacheSize: number;
    queueSize: number;
    activeLoads: number;
    dataSourceCount: number;
  } {
    return {
      isInitialized: this._isInitialized,
      cacheSize: this._cache.size(),
      queueSize: this._queue.getQueueSize(),
      activeLoads: this._queue.getActiveCount(),
      dataSourceCount: this._dataSources.size,
    };
  }
}
