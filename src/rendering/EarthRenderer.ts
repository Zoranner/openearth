/**
 * 地球渲染模块
 * 地球表面渲染协调器，负责整合瓦片贴图、地形高度和夜间灯光三个渲染效果
 * 严格按照 07-地球渲染模块设计.md 实现
 */

import { Vector3, type Scene, type Camera } from '@babylonjs/core';
import { TileTextureRenderer, createTileTextureRendererConfig } from './TileTextureRenderer';
import { TerrainHeightSystem, createTerrainHeightSystemConfig } from '../terrain/TerrainHeightSystem';
import type { NightLightRenderer } from './NightLightRenderer';
import { createEarthRendererConfig, type EarthRendererConfig } from './EarthRendererConfig';
import { logger } from '../utils/Logger';

/**
 * 地球渲染器类
 * 作为渲染层的协调器，通过依赖注入的方式使用各个子渲染模块
 */
export class EarthRenderer {
  private _scene: Scene;
  // private _camera: Camera; // 保留用于后续功能扩展，暂时注释避免未使用警告
  private _config: EarthRendererConfig;
  private _isInitialized = false;

  // 子渲染模块
  private _tileTextureRenderer: TileTextureRenderer;
  private _terrainHeightSystem: TerrainHeightSystem;
  private _nightLightRenderer: NightLightRenderer | null = null; // 现阶段可选

  constructor(scene: Scene, _camera: Camera, config: EarthRendererConfig = createEarthRendererConfig()) {
    this._scene = scene;
    // this._camera = camera; // 保留用于后续功能扩展
    this._config = config;

    // 创建子模块实例
    this._tileTextureRenderer = new TileTextureRenderer(
      this._scene,
      createTileTextureRendererConfig({
        enabled: this._config.enableTileTextures,
      })
    );

    this._terrainHeightSystem = new TerrainHeightSystem(
      this._scene,
      createTerrainHeightSystemConfig({
        enabled: this._config.enableTerrainHeight,
      })
    );

    // nightLightRenderer 现阶段留空，后续实现
    // this._nightLightRenderer = nightLightRenderer;

    logger.debug('EarthRenderer created', 'EarthRenderer', {
      enabled: this._config.enabled,
      enableTileTextures: this._config.enableTileTextures,
      enableTerrainHeight: this._config.enableTerrainHeight,
      enableDayNightLighting: this._config.enableDayNightLighting,
    });
  }

  /**
   * 初始化地球渲染器
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      logger.warn('EarthRenderer already initialized', 'EarthRenderer');
      return;
    }

    try {
      logger.debug('Initializing EarthRenderer', 'EarthRenderer');

      if (this._config.enabled) {
        // 按顺序初始化各个子模块
        if (this._config.enableTileTextures) {
          await this._tileTextureRenderer.initialize();
          logger.debug('TileTextureRenderer initialized', 'EarthRenderer');
        }

        if (this._config.enableTerrainHeight) {
          await this._terrainHeightSystem.initialize();
          logger.debug('TerrainHeightSystem initialized', 'EarthRenderer');
        }

        if (this._config.enableDayNightLighting && this._nightLightRenderer) {
          await this._nightLightRenderer.initialize();
          logger.debug('NightLightRenderer initialized', 'EarthRenderer');
        }
      }

      this._isInitialized = true;
      logger.info('EarthRenderer initialized successfully', 'EarthRenderer');
    } catch (error) {
      logger.error('Failed to initialize EarthRenderer', 'EarthRenderer', error);
      throw error;
    }
  }

  /**
   * 销毁地球渲染器
   */
  public dispose(): void {
    if (!this._isInitialized) {
      return;
    }

    logger.debug('Disposing EarthRenderer', 'EarthRenderer');

    // 按相反顺序销毁子模块
    if (this._nightLightRenderer) {
      this._nightLightRenderer.dispose();
    }

    this._terrainHeightSystem.dispose();
    this._tileTextureRenderer.dispose();

    this._isInitialized = false;
    logger.info('EarthRenderer disposed', 'EarthRenderer');
  }

  /**
   * 更新地球渲染器
   * @param cameraPosition 相机位置
   */
  public update(cameraPosition: Vector3): void {
    if (!this._isInitialized || !this._config.enabled) {
      return;
    }

    // 按顺序更新各个子模块
    if (this._config.enableTileTextures) {
      this._tileTextureRenderer.update(cameraPosition);
    }

    if (this._config.enableTerrainHeight) {
      this._terrainHeightSystem.update(cameraPosition);
    }

    if (this._config.enableDayNightLighting && this._nightLightRenderer) {
      // 这里需要太阳方向，现阶段使用固定值
      const sunDirection = new Vector3(-1, -1, -1);
      this._nightLightRenderer.update(cameraPosition, sunDirection);
    }
  }

  /**
   * 响应时间变化事件
   * @param time 当前时间
   */
  public onTimeChanged(time: Date): void {
    if (!this._isInitialized || !this._config.enabled) {
      return;
    }

    // 只有夜间灯光渲染器需要响应时间变化
    if (this._config.enableDayNightLighting && this._nightLightRenderer) {
      this._nightLightRenderer.onTimeChanged(time);
    }

    logger.debug('EarthRenderer time changed', 'EarthRenderer', {
      time: time.toISOString(),
    });
  }

  /**
   * 设置瓦片贴图启用状态
   * @param enabled 是否启用
   */
  public setTileTexturesEnabled(enabled: boolean): void {
    if (this._config.enableTileTextures === enabled) {
      return;
    }

    this._config.enableTileTextures = enabled;
    this._tileTextureRenderer.setEnabled(enabled);

    logger.debug('TileTextures enabled state changed', 'EarthRenderer', {
      enabled,
    });
  }

  /**
   * 设置地形高度启用状态
   * @param enabled 是否启用
   */
  public setTerrainHeightEnabled(enabled: boolean): void {
    if (this._config.enableTerrainHeight === enabled) {
      return;
    }

    this._config.enableTerrainHeight = enabled;
    this._terrainHeightSystem.enableTerrainHeight(enabled);

    logger.debug('TerrainHeight enabled state changed', 'EarthRenderer', {
      enabled,
    });
  }

  /**
   * 设置昼夜光照启用状态
   * @param enabled 是否启用
   */
  public setDayNightLightingEnabled(enabled: boolean): void {
    if (this._config.enableDayNightLighting === enabled) {
      return;
    }

    this._config.enableDayNightLighting = enabled;

    // 现阶段夜间灯光渲染器还未实现，暂时只记录日志
    logger.debug('DayNightLighting enabled state changed', 'EarthRenderer', {
      enabled,
    });
  }

  /**
   * 获取瓦片贴图启用状态
   */
  public getTileTexturesEnabled(): boolean {
    return this._config.enableTileTextures;
  }

  /**
   * 获取地形高度启用状态
   */
  public getTerrainHeightEnabled(): boolean {
    return this._config.enableTerrainHeight;
  }

  /**
   * 获取昼夜光照启用状态
   */
  public getDayNightLightingEnabled(): boolean {
    return this._config.enableDayNightLighting;
  }

  /**
   * 设置配置
   * @param config 新配置
   */
  public setConfig(config: EarthRendererConfig): void {
    const oldConfig = { ...this._config };
    this._config = config;

    // 更新子模块配置
    this._tileTextureRenderer.updateConfig({
      enabled: this._config.enableTileTextures,
    });

    this._terrainHeightSystem.updateConfig({
      enabled: this._config.enableTerrainHeight,
    });

    logger.debug('EarthRenderer configuration updated', 'EarthRenderer', {
      oldConfig,
      newConfig: this._config,
    });
  }

  /**
   * 获取配置
   */
  public getConfig(): EarthRendererConfig {
    return { ...this._config };
  }

  /**
   * 获取指定位置的地形高度
   * @param longitude 经度
   * @param latitude 纬度
   * @returns 地形高度（米）
   */
  public async getHeightAt(longitude: number, latitude: number): Promise<number> {
    if (!this._isInitialized || !this._config.enabled || !this._config.enableTerrainHeight) {
      return 0;
    }

    return await this._terrainHeightSystem.getHeightAt(longitude, latitude);
  }

  /**
   * 获取瓦片贴图渲染器
   */
  public getTileTextureRenderer(): TileTextureRenderer {
    return this._tileTextureRenderer;
  }

  /**
   * 获取地形高度系统
   */
  public getTerrainHeightSystem(): TerrainHeightSystem {
    return this._terrainHeightSystem;
  }

  /**
   * 获取夜间灯光渲染器
   */
  public getNightLightRenderer(): NightLightRenderer | null {
    return this._nightLightRenderer;
  }

  /**
   * 获取系统状态
   */
  public getStatus(): unknown {
    return {
      isInitialized: this._isInitialized,
      enabled: this._config.enabled,
      enableTileTextures: this._config.enableTileTextures,
      enableTerrainHeight: this._config.enableTerrainHeight,
      enableDayNightLighting: this._config.enableDayNightLighting,
      tileTextureRenderer: {
        activeTextures: this._tileTextureRenderer.getActiveTextureCount(),
        cachedTextures: this._tileTextureRenderer.getCachedTextureCount(),
      },
      terrainHeightSystem: this._terrainHeightSystem.getStatus(),
    };
  }
}
