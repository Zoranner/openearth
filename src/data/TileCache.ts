/**
 * 瓦片缓存模块
 * 基于LRU策略的智能缓存管理
 */

import type { TileKey, CacheStats } from '../types';
import { logger } from '../utils/Logger';

export interface Tile {
  key: TileKey;
  data: ArrayBuffer;
  isLoaded: boolean;
  loadTime: number;
  lastAccessed: number;
  size: number;
}

/**
 * 双向链表节点
 */
class LinkedListNode<T> {
  value: T;
  prev: LinkedListNode<T> | null = null;
  next: LinkedListNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

/**
 * 双向链表
 */
class LinkedList<T> {
  private head: LinkedListNode<T> | null = null;
  private tail: LinkedListNode<T> | null = null;
  private size = 0;

  /**
   * 在头部添加节点
   */
  addFirst(value: T): LinkedListNode<T> {
    const node = new LinkedListNode(value);

    if (!this.head) {
      this.head = this.tail = node;
    } else {
      node.next = this.head;
      this.head.prev = node;
      this.head = node;
    }

    this.size++;
    return node;
  }

  /**
   * 移除节点
   */
  remove(node: LinkedListNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    this.size--;
  }

  /**
   * 移动节点到头部
   */
  moveToFirst(node: LinkedListNode<T>): void {
    if (node === this.head) {
      return;
    }

    this.remove(node);

    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    this.tail ??= node;
  }

  /**
   * 移除最后一个节点
   */
  removeLast(): T | null {
    if (!this.tail) {
      return null;
    }

    const value = this.tail.value;
    this.remove(this.tail);
    return value;
  }

  /**
   * 获取大小
   */
  getSize(): number {
    return this.size;
  }

  /**
   * 是否为空
   */
  isEmpty(): boolean {
    return this.size === 0;
  }
}

/**
 * 瓦片缓存类
 */
export class TileCache {
  private _cache: Map<string, { tile: Tile; node: LinkedListNode<string> }>;
  private _accessOrder: LinkedList<string>;
  private _maxSize: number;
  private _currentSize: number;
  private _maxMemory: number; // 最大内存使用量（字节）
  private _currentMemory: number;
  private _hitCount: number;
  private _missCount: number;
  private _evictionCount: number;

  constructor(maxSize: number, maxMemory: number = 256 * 1024 * 1024) {
    // 默认256MB
    this._cache = new Map();
    this._accessOrder = new LinkedList();
    this._maxSize = maxSize;
    this._currentSize = 0;
    this._maxMemory = maxMemory;
    this._currentMemory = 0;
    this._hitCount = 0;
    this._missCount = 0;
    this._evictionCount = 0;

    logger.debug('TileCache created', 'TileCache', {
      maxSize,
      maxMemory: `${maxMemory / (1024 * 1024)}MB`,
    });
  }

  /**
   * 获取瓦片
   */
  get(key: string): Tile | null {
    const entry = this._cache.get(key);

    if (entry) {
      // 命中：更新访问时间和顺序
      entry.tile.lastAccessed = Date.now();
      this._accessOrder.moveToFirst(entry.node);
      this._hitCount++;

      logger.debug('Cache hit', 'TileCache', { key });
      return entry.tile;
    } else {
      // 未命中
      this._missCount++;
      logger.debug('Cache miss', 'TileCache', { key });
      return null;
    }
  }

  /**
   * 设置瓦片
   */
  set(key: string, tile: Tile): void {
    const existingEntry = this._cache.get(key);

    if (existingEntry) {
      // 更新现有瓦片
      const oldMemory = existingEntry.tile.size;
      existingEntry.tile = tile;
      this._currentMemory = this._currentMemory - oldMemory + tile.size;
      this._accessOrder.moveToFirst(existingEntry.node);

      logger.debug('Cache updated', 'TileCache', { key, size: tile.size });
    } else {
      // 添加新瓦片
      const node = this._accessOrder.addFirst(key);
      this._cache.set(key, { tile, node });
      this._currentSize++;
      this._currentMemory += tile.size;

      logger.debug('Cache added', 'TileCache', {
        key,
        size: tile.size,
        currentSize: this._currentSize,
        currentMemory: `${Math.round(this._currentMemory / (1024 * 1024))}MB`,
      });
    }

    // 检查是否需要淘汰
    this.evictIfNecessary();
  }

  /**
   * 移除瓦片
   */
  remove(key: string): boolean {
    const entry = this._cache.get(key);

    if (entry) {
      this._cache.delete(key);
      this._accessOrder.remove(entry.node);
      this._currentSize--;
      this._currentMemory -= entry.tile.size;

      logger.debug('Cache removed', 'TileCache', { key });
      return true;
    }

    return false;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this._cache.clear();
    this._accessOrder = new LinkedList();
    this._currentSize = 0;
    this._currentMemory = 0;

    logger.info('Cache cleared', 'TileCache');
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    const totalRequests = this._hitCount + this._missCount;

    return {
      size: this._currentSize,
      maxSize: this._maxSize,
      hitRate: totalRequests > 0 ? this._hitCount / totalRequests : 0,
      missRate: totalRequests > 0 ? this._missCount / totalRequests : 0,
      evictionCount: this._evictionCount,
    };
  }

  /**
   * 获取内存使用信息
   */
  getMemoryStats(): {
    currentMemory: number;
    maxMemory: number;
    memoryUsage: number;
  } {
    return {
      currentMemory: this._currentMemory,
      maxMemory: this._maxMemory,
      memoryUsage: this._maxMemory > 0 ? this._currentMemory / this._maxMemory : 0,
    };
  }

  /**
   * 如有必要执行LRU淘汰
   */
  private evictIfNecessary(): void {
    // 检查数量限制
    while (this._currentSize > this._maxSize) {
      this.evictLRU();
    }

    // 检查内存限制
    while (this._currentMemory > this._maxMemory && this._currentSize > 0) {
      this.evictLRU();
    }
  }

  /**
   * 执行LRU淘汰
   */
  evictLRU(): void {
    const key = this._accessOrder.removeLast();

    if (key) {
      const entry = this._cache.get(key);

      if (entry) {
        this._cache.delete(key);
        this._currentSize--;
        this._currentMemory -= entry.tile.size;
        this._evictionCount++;

        logger.debug('Cache evicted (LRU)', 'TileCache', {
          key,
          size: entry.tile.size,
          remainingSize: this._currentSize,
          remainingMemory: `${Math.round(this._currentMemory / (1024 * 1024))}MB`,
        });
      }
    }
  }

  /**
   * 批量淘汰指定百分比的缓存
   */
  evictPercentage(percentage: number): void {
    const targetEvictions = Math.ceil(this._currentSize * percentage);

    for (let i = 0; i < targetEvictions; i++) {
      this.evictLRU();
      if (this._currentSize === 0) break;
    }

    logger.info('Batch eviction completed', 'TileCache', {
      percentage,
      targetEvictions,
      actualEvictions: Math.min(targetEvictions, this._currentSize),
      remainingSize: this._currentSize,
    });
  }

  /**
   * 根据年龄淘汰瓦片
   */
  evictByAge(maxAge: number): void {
    const now = Date.now();
    const keysToEvict: string[] = [];

    this._cache.forEach((entry, key) => {
      if (now - entry.tile.lastAccessed > maxAge) {
        keysToEvict.push(key);
      }
    });

    keysToEvict.forEach(key => this.remove(key));

    if (keysToEvict.length > 0) {
      logger.info('Age-based eviction completed', 'TileCache', {
        maxAge,
        evictedCount: keysToEvict.length,
        remainingSize: this._currentSize,
      });
    }
  }

  /**
   * 获取所有缓存的瓦片键
   */
  getKeys(): string[] {
    return Array.from(this._cache.keys());
  }

  /**
   * 检查是否包含指定瓦片
   */
  has(key: string): boolean {
    return this._cache.has(key);
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this._currentSize;
  }

  /**
   * 检查缓存是否为空
   */
  isEmpty(): boolean {
    return this._currentSize === 0;
  }

  /**
   * 设置最大缓存大小
   */
  setMaxSize(maxSize: number): void {
    this._maxSize = maxSize;
    this.evictIfNecessary();

    logger.info('Max cache size updated', 'TileCache', { maxSize });
  }

  /**
   * 设置最大内存使用量
   */
  setMaxMemory(maxMemory: number): void {
    this._maxMemory = maxMemory;
    this.evictIfNecessary();

    logger.info('Max memory updated', 'TileCache', {
      maxMemory: `${maxMemory / (1024 * 1024)}MB`,
    });
  }
}
