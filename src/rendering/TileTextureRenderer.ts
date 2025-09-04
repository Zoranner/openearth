/**
 * 瓦片贴图渲染器
 * 负责将图像瓦片数据转换为纹理对象并应用到地球表面
 * 现阶段实现基础的地球球体渲染和光照
 */

import {
  Vector3,
  Color3,
  MeshBuilder,
  HemisphericLight,
  DirectionalLight,
  type Scene,
  type Mesh,
  type StandardMaterial,
} from '@babylonjs/core';
import { EarthGridMaterial } from '../shaders/materials/EarthGridMaterial';
import { logger } from '../utils/Logger';

/**
 * 瓦片贴图渲染器配置
 */
export interface TileTextureRendererConfig {
  /** 是否启用瓦片贴图渲染 */
  enabled: boolean;

  /** 地球半径（标准化单位） */
  earthRadius: number;

  /** 球体细分段数 */
  segments: number;

  /** 海洋颜色 */
  oceanColor: Color3;

  /** 环境光强度 */
  ambientLightIntensity: number;

  /** 太阳光强度 */
  sunLightIntensity: number;
}

/**
 * 创建默认的瓦片贴图渲染器配置
 */
export function createTileTextureRendererConfig(
  userConfig: Partial<TileTextureRendererConfig> = {}
): TileTextureRendererConfig {
  const defaultConfig: TileTextureRendererConfig = {
    enabled: true,
    earthRadius: 1.0, // 标准化半径
    segments: 64,
    oceanColor: new Color3(0.2, 0.4, 0.8), // 蓝色海洋
    ambientLightIntensity: 0.7,
    sunLightIntensity: 1.0,
  };

  return {
    ...defaultConfig,
    ...userConfig,
  };
}

/**
 * 瓦片贴图渲染器类
 */
export class TileTextureRenderer {
  private _scene: Scene;
  private _config: TileTextureRendererConfig;
  private _isInitialized = false;

  // 渲染对象
  private _earthSphere: Mesh | null = null;
  private _earthMaterial: StandardMaterial | null = null;
  private _earthGridMaterial: EarthGridMaterial | null = null;
  private _hemisphericLight: HemisphericLight | null = null;
  private _directionalLight: DirectionalLight | null = null;

  // 纹理相关
  private _activeTextureCount = 0;
  private _cachedTextureCount = 0;

  constructor(scene: Scene, config: TileTextureRendererConfig) {
    this._scene = scene;
    this._config = config;

    logger.debug('TileTextureRenderer created', 'TileTextureRenderer', {
      enabled: this._config.enabled,
      earthRadius: this._config.earthRadius,
      segments: this._config.segments,
    });
  }

  /**
   * 初始化瓦片贴图渲染器
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      logger.warn('TileTextureRenderer already initialized', 'TileTextureRenderer');
      return;
    }

    try {
      logger.debug('Initializing TileTextureRenderer', 'TileTextureRenderer');

      if (this._config.enabled) {
        // 创建光照
        await this._createLighting();

        // 创建地球球体
        await this._createEarthSphere();
      }

      this._isInitialized = true;
      logger.info('TileTextureRenderer initialized successfully', 'TileTextureRenderer');
    } catch (error) {
      logger.error('Failed to initialize TileTextureRenderer', 'TileTextureRenderer', error);
      throw error;
    }
  }

  /**
   * 销毁瓦片贴图渲染器
   */
  public dispose(): void {
    if (!this._isInitialized) {
      return;
    }

    logger.debug('Disposing TileTextureRenderer', 'TileTextureRenderer');

    // 清理渲染对象
    if (this._earthGridMaterial) {
      this._earthGridMaterial.dispose();
      this._earthGridMaterial = null;
    }

    if (this._earthSphere) {
      this._earthSphere.dispose();
      this._earthSphere = null;
    }

    if (this._earthMaterial) {
      this._earthMaterial.dispose();
      this._earthMaterial = null;
    }

    if (this._hemisphericLight) {
      this._hemisphericLight.dispose();
      this._hemisphericLight = null;
    }

    if (this._directionalLight) {
      this._directionalLight.dispose();
      this._directionalLight = null;
    }

    this._isInitialized = false;
    logger.info('TileTextureRenderer disposed', 'TileTextureRenderer');
  }

  /**
   * 更新瓦片贴图渲染器
   * @param cameraPosition 相机位置
   */
  public update(cameraPosition: Vector3): void {
    if (!this._isInitialized || !this._config.enabled) {
      return;
    }

    // 更新shader材质的相机位置
    if (this._earthGridMaterial) {
      this._earthGridMaterial.updateCameraPosition(cameraPosition);
    }

    // 现阶段暂时不需要其他更新逻辑
    // 后续可以在这里添加LOD计算、瓦片加载等逻辑
  }

  /**
   * 设置瓦片贴图渲染启用状态
   * @param enabled 是否启用
   */
  public setEnabled(enabled: boolean): void {
    if (this._config.enabled === enabled) {
      return;
    }

    this._config.enabled = enabled;

    if (this._earthSphere) {
      this._earthSphere.setEnabled(enabled);
    }

    logger.debug('TileTextureRenderer enabled state changed', 'TileTextureRenderer', {
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
   * 获取活跃纹理数量
   */
  public getActiveTextureCount(): number {
    return this._activeTextureCount;
  }

  /**
   * 获取缓存纹理数量
   */
  public getCachedTextureCount(): number {
    return this._cachedTextureCount;
  }

  /**
   * 更新配置
   * @param newConfig 新配置
   */
  public updateConfig(newConfig: Partial<TileTextureRendererConfig>): void {
    const oldConfig = { ...this._config };
    this._config = createTileTextureRendererConfig({ ...this._config, ...newConfig });

    logger.debug('TileTextureRenderer configuration updated', 'TileTextureRenderer', {
      oldConfig,
      newConfig: this._config,
    });

    // 如果需要重新初始化
    if (
      this._isInitialized &&
      (oldConfig.earthRadius !== this._config.earthRadius ||
        oldConfig.segments !== this._config.segments ||
        oldConfig.enabled !== this._config.enabled)
    ) {
      this.dispose();
      this.initialize();
    }
  }

  /**
   * 创建基础光照
   */
  private async _createLighting(): Promise<void> {
    // 创建环境光 - 提供基础照明
    this._hemisphericLight = new HemisphericLight('hemisphericLight', new Vector3(0, 1, 0), this._scene);
    this._hemisphericLight.intensity = this._config.ambientLightIntensity;
    this._hemisphericLight.diffuse = new Color3(1, 1, 1);
    this._hemisphericLight.specular = new Color3(1, 1, 1);
    this._hemisphericLight.groundColor = new Color3(0.2, 0.2, 0.3);

    // 创建方向光 - 模拟太阳光
    this._directionalLight = new DirectionalLight('sunLight', new Vector3(-1, -1, -1), this._scene);
    this._directionalLight.intensity = this._config.sunLightIntensity;
    this._directionalLight.diffuse = new Color3(1, 1, 0.9);
    this._directionalLight.specular = new Color3(1, 1, 1);

    logger.debug('Lighting created', 'TileTextureRenderer', {
      hemisphericLight: this._hemisphericLight.intensity,
      directionalLight: this._directionalLight.intensity,
    });
  }

  /**
   * 创建地球球体
   */
  private async _createEarthSphere(): Promise<void> {
    // 创建地球球体几何体
    this._earthSphere = MeshBuilder.CreateSphere(
      'earth',
      {
        diameter: this._config.earthRadius * 2,
        segments: this._config.segments,
      },
      this._scene
    );

    // 创建基于shader的网格材质
    this._earthGridMaterial = new EarthGridMaterial(this._scene, {
      baseColor: [this._config.oceanColor.r, this._config.oceanColor.g, this._config.oceanColor.b],
      gridColor: [1.0, 1.0, 1.0],
      gridOpacity: 0.8,
      majorLineWidth: 2.0,
      minorLineWidth: 1.0,
      fadeDistance: 5.0,
      maxViewDistance: 15.0,
    });

    // 应用shader材质到球体
    this._earthSphere.material = this._earthGridMaterial.getMaterial();

    logger.debug('Earth sphere created', 'TileTextureRenderer', {
      radius: this._config.earthRadius,
      segments: this._config.segments,
    });
  }
}
