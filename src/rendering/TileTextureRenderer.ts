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
  Texture,
  DynamicTexture,
  type Scene,
  type Mesh,
  type StandardMaterial,
} from '@babylonjs/core';
import type { TileKey } from '../types';
import type { TileLoader } from '../data/TileLoader';
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
  private _visibleTileKeys: { x: number; y: number; z: number; source: string; layer: string }[] = [];
  private _tileLoader: TileLoader | null = null;
  private _compositedTexture: DynamicTexture | null = null;

  constructor(scene: Scene, config: TileTextureRendererConfig) {
    this._scene = scene;
    this._config = config;

    logger.debug('TileTextureRenderer created', 'TileTextureRenderer', {
      enabled: this._config.enabled,
      earthRadius: this._config.earthRadius,
      segments: this._config.segments,
    });
  }

  /** 注入 TileLoader */
  public setTileLoader(loader: TileLoader): void {
    this._tileLoader = loader;
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

    // 合成纹理（占位：简单拼贴）
    this._compositeTilesIfReady();
  }

  /**
   * 设置当前应显示的瓦片集合（占位：仅记录，不实际贴图）
   */
  public setVisibleTiles(tiles: { x: number; y: number; z: number; source: string; layer: string }[]): void {
    this._visibleTileKeys = tiles;
    // TODO: 合成瓦片纹理并更新到 EarthGridMaterial 的 diffuseMap
    // 先占位：当有材质时，打开纹理显示与网格开关默认开启
    if (this._earthGridMaterial) {
      this._earthGridMaterial.updateConfig({ diffuseOpacity: 1.0, gridEnabled: 1.0 });
    }
  }

  /**
   * 将可见瓦片合成到一张动态纹理（简单拼贴，后续可替换为更优方案）
   */
  private _compositeTilesIfReady(): void {
    if (!this._earthGridMaterial || !this._tileLoader) return;
    if (this._visibleTileKeys.length === 0) return;

    const sampleZoom = this._visibleTileKeys[0].z;
    const tileSize = 256;
    // 计算当前可见瓦片范围（同一zoom）
    const sameZoomTiles = this._visibleTileKeys.filter(t => t.z === sampleZoom);
    if (sameZoomTiles.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of sameZoomTiles) {
      if (t.x < minX) minX = t.x;
      if (t.x > maxX) maxX = t.x;
      if (t.y < minY) minY = t.y;
      if (t.y > maxY) maxY = t.y;
    }
    const gridW = Math.max(1, maxX - minX + 1);
    const gridH = Math.max(1, maxY - minY + 1);
    const canvasW = tileSize * gridW;
    const canvasH = tileSize * gridH;

    if (!this._compositedTexture || this._compositedTexture.getSize().width !== canvasW || this._compositedTexture.getSize().height !== canvasH) {
      this._compositedTexture = new DynamicTexture('tiles-composited', { width: canvasW, height: canvasH }, this._scene, false);
    }

    const ctx = this._compositedTexture.getContext();
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasW, canvasH);

    const center = sameZoomTiles[0] as TileKey;
    for (let ty = 0; ty < gridH; ty++) {
      for (let tx = 0; tx < gridW; tx++) {
        const x = minX + tx;
        const y = minY + ty;
        const tile: TileKey = { x, y, z: sampleZoom, source: center.source, layer: center.layer } as TileKey;
        const cached = this._tileLoader.getCachedTile(tile);
        if (cached && cached.data) {
          try {
            const blob = new Blob([cached.data], { type: 'image/jpeg' });
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = URL.createObjectURL(blob);
            img.onload = () => {
              ctx.drawImage(img, tx * tileSize, ty * tileSize, tileSize, tileSize);
              this._compositedTexture!.update(false);
              this._earthGridMaterial!.setDiffuseTexture(this._compositedTexture!);
              URL.revokeObjectURL(img.src);
            };
          } catch {}
        }
      }
    }

    // 设置合成纹理在全局Mercator空间的范围（归一化）
    const tilesPerWorld = Math.pow(2, sampleZoom);
    const originX = minX / tilesPerWorld;
    const originY = minY / tilesPerWorld;
    const scaleX = gridW / tilesPerWorld;
    const scaleY = gridH / tilesPerWorld;
    this._earthGridMaterial.setAtlasTransform([originX, originY], [scaleX, scaleY]);
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
      gridColor: [1, 1, 1],
      gridOpacity: 0.8,
      lineWidth: 1.0,
    });

    // 应用shader材质到球体
    this._earthSphere.material = this._earthGridMaterial.getMaterial();

    // 占位：加载一张全局纹理验证贴图链路（后续将由瓦片合成纹理替代）
    try {
      const placeholder = new Texture('assets/night.png', this._scene, true, false);
      this._earthGridMaterial.setDiffuseTexture(placeholder);
      this._earthGridMaterial.updateConfig({ diffuseOpacity: 1.0, gridEnabled: 1.0 });
      logger.debug('Placeholder texture applied', 'TileTextureRenderer');
    } catch (e) {
      logger.warn('Failed to load placeholder texture', 'TileTextureRenderer', e as Error);
    }

    logger.debug('Earth sphere created', 'TileTextureRenderer', {
      radius: this._config.earthRadius,
      segments: this._config.segments,
    });
  }
}
