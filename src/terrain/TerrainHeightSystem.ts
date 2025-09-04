/**
 * 地形高度系统
 * 处理terrain-rgb格式的高度图瓦片，生成3D地形网格
 * 现阶段作为占位符，后续实现完整功能
 */

import type { Scene, Vector3 } from '@babylonjs/core';
import { logger } from '../utils/Logger';

/**
 * 地形高度系统配置
 */
export interface TerrainHeightSystemConfig {
  /** 是否启用地形高度 */
  enabled: boolean;

  /** 高度缩放因子 */
  heightScale: number;

  /** 最大高度值 */
  maxHeight: number;

  /** 最小高度值 */
  minHeight: number;
}

/**
 * 创建默认的地形高度系统配置
 */
export function createTerrainHeightSystemConfig(
  userConfig: Partial<TerrainHeightSystemConfig> = {}
): TerrainHeightSystemConfig {
  const defaultConfig: TerrainHeightSystemConfig = {
    enabled: false, // 现阶段默认禁用
    heightScale: 1.0,
    maxHeight: 8848, // 珠峰高度（米）
    minHeight: -11034, // 马里亚纳海沟深度（米）
  };

  return {
    ...defaultConfig,
    ...userConfig,
  };
}

/**
 * 地形高度系统类
 */
export class TerrainHeightSystem {
  // private _scene: Scene; // 保留用于后续功能扩展
  private _config: TerrainHeightSystemConfig;
  private _isInitialized = false;

  constructor(_scene: Scene, config: TerrainHeightSystemConfig) {
    // this._scene = scene; // 保留用于后续功能扩展
    this._config = config;

    logger.debug('TerrainHeightSystem created', 'TerrainHeightSystem', {
      enabled: this._config.enabled,
    });
  }

  /**
   * 初始化地形高度系统
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      logger.warn('TerrainHeightSystem already initialized', 'TerrainHeightSystem');
      return;
    }

    try {
      logger.debug('Initializing TerrainHeightSystem', 'TerrainHeightSystem');

      // 现阶段不实现具体功能，只是占位符
      if (this._config.enabled) {
        logger.debug('TerrainHeightSystem enabled but not implemented yet', 'TerrainHeightSystem');
      }

      this._isInitialized = true;
      logger.info('TerrainHeightSystem initialized successfully', 'TerrainHeightSystem');
    } catch (error) {
      logger.error('Failed to initialize TerrainHeightSystem', 'TerrainHeightSystem', error);
      throw error;
    }
  }

  /**
   * 销毁地形高度系统
   */
  public dispose(): void {
    if (!this._isInitialized) {
      return;
    }

    logger.debug('Disposing TerrainHeightSystem', 'TerrainHeightSystem');

    // 清理资源
    this._isInitialized = false;
    logger.info('TerrainHeightSystem disposed', 'TerrainHeightSystem');
  }

  /**
   * 更新地形高度系统
   * @param cameraPosition 相机位置
   */
  public update(_cameraPosition: Vector3): void {
    if (!this._isInitialized || !this._config.enabled) {
      return;
    }

    // 现阶段暂时不需要特殊的更新逻辑
  }

  /**
   * 获取指定位置的地形高度
   * @param longitude 经度
   * @param latitude 纬度
   * @returns 地形高度（米）
   */
  public async getHeightAt(_longitude: number, _latitude: number): Promise<number> {
    if (!this._isInitialized || !this._config.enabled) {
      return 0; // 海平面高度
    }

    // 现阶段返回固定值，后续实现真实的高度查询
    return 0;
  }

  /**
   * 设置地形高度启用状态
   * @param enabled 是否启用
   */
  public enableTerrainHeight(enabled: boolean): void {
    if (this._config.enabled === enabled) {
      return;
    }

    this._config.enabled = enabled;

    logger.debug('TerrainHeightSystem enabled state changed', 'TerrainHeightSystem', {
      enabled,
    });
  }

  /**
   * 获取启用状态
   */
  public isEnabled(): boolean {
    return this._config.enabled;
  }

  /**
   * 更新配置
   * @param newConfig 新配置
   */
  public updateConfig(newConfig: Partial<TerrainHeightSystemConfig>): void {
    const oldConfig = { ...this._config };
    this._config = createTerrainHeightSystemConfig({ ...this._config, ...newConfig });

    logger.debug('TerrainHeightSystem configuration updated', 'TerrainHeightSystem', {
      oldConfig,
      newConfig: this._config,
    });
  }

  /**
   * 获取系统状态
   */
  public getStatus(): unknown {
    return {
      isInitialized: this._isInitialized,
      enabled: this._config.enabled,
      heightScale: this._config.heightScale,
    };
  }
}
