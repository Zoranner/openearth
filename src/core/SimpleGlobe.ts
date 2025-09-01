import { Engine, Scene, Vector3, ArcRotateCamera } from '@babylonjs/core';
import type { GlobeConfig } from './GlobeConfig';
import { defaultGlobeConfig } from './GlobeConfig';
import { EarthSphere } from './EarthSphere';
import { TileLoader } from '../terrain/TileLoader';
import { TerrainOptimizer } from '../terrain/TerrainOptimizer';
import { TerrainDetailRenderer } from '../terrain/TerrainDetailRenderer';
import { AtmosphereRenderer } from './AtmosphereRenderer';
import { SunSystem } from './SunSystem';
import { NightLightRenderer } from './NightLightRenderer';
import { CameraController } from '../camera/CameraController';

/**
 * 简化版地球类 - 采用类似 maplibre 的配置风格
 */
export class SimpleGlobe {
  private _canvas: HTMLCanvasElement;
  private _engine!: Engine;
  private _scene!: Scene;
  private _camera!: ArcRotateCamera;
  private _config: GlobeConfig;

  // 核心组件
  private _earthSphere!: EarthSphere;
  private _tileLoader: TileLoader | null = null;
  private _terrainOptimizer: TerrainOptimizer | null = null;
  private _terrainDetailRenderer: TerrainDetailRenderer | null = null;
  private _atmosphereRenderer: AtmosphereRenderer | null = null;
  private _sunSystem: SunSystem | null = null;
  private _nightLightRenderer: NightLightRenderer | null = null;
  private _cameraController: CameraController | null = null;

  // 状态管理
  private _isInitialized = false;
  private _lastUpdateTime = 0;

  constructor(config: GlobeConfig) {
    this._canvas = config.container;
    this._config = { ...defaultGlobeConfig, ...config };

    this._initializeBabylon();
  }

  /**
   * 初始化地球系统
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // 创建地球球体
      this._earthSphere = new EarthSphere(this._scene, this._config.render?.earthRadius || 6378137);
      await this._earthSphere.initialize();

      // 初始化瓦片加载器
      if (this._config.sources?.satellite) {
        this._tileLoader = new TileLoader(this._scene, this._config.render?.earthRadius || 6378137);
        await this._tileLoader.initialize();
        this._tileLoader.setTileProvider(this._config.sources.satellite.tiles);
      }

      // 初始化地形优化器
      if (this._config.layers?.terrain?.enabled) {
        this._terrainOptimizer = new TerrainOptimizer(this._scene, this._tileLoader!);
        this._terrainOptimizer.initialize();
      }

      // 初始化地形细节渲染器
      if (this._config.layers?.terrain?.enabled) {
        this._terrainDetailRenderer = new TerrainDetailRenderer(
          this._scene,
          this._config.render?.earthRadius || 6378137
        );
        await this._terrainDetailRenderer.initialize();

        // 配置地形参数
        this._terrainDetailRenderer.configure({
          enableHeightMaps: true,
          enableNormalMaps: true,
          heightScale: this._config.layers.terrain.heightScale || 10000,
          detailScale: this._config.layers.terrain.detailScale || 16,
        });
      }

      // 初始化大气层渲染器
      if (this._config.layers?.atmosphere?.enabled) {
        this._atmosphereRenderer = new AtmosphereRenderer(this._scene, this._config.render?.earthRadius || 6378137);
        await this._atmosphereRenderer.initialize();
      }

      // 初始化太阳系统
      if (this._config.sun) {
        this._sunSystem = new SunSystem(this._scene);
        await this._sunSystem.initialize();

        // 配置太阳系统
        this._sunSystem.setTimeOfDay(this._config.sun.timeOfDay || 12.0);
        this._sunSystem.setLatitude(this._config.sun.latitude || 39.9);

        if (this._config.sun.dayNightCycle) {
          this._sunSystem.startDayNightCycle(this._config.sun.cycleSpeed || 24000);
        }
      }

      // 初始化夜景灯光渲染器
      if (this._config.layers?.nightLights?.enabled) {
        this._nightLightRenderer = new NightLightRenderer(this._scene, this._config.render?.earthRadius || 6378137);
        await this._nightLightRenderer.initialize();

        // 配置夜景灯光
        this._nightLightRenderer.setIntensity(this._config.layers.nightLights.intensity || 1.0);
        this._nightLightRenderer.setBrightness(this._config.layers.nightLights.brightness || 0.8);
      }

      // 初始化相机控制器
      this._cameraController = new CameraController(this._camera, this._config.controls);

      // 设置初始相机位置
      this._setInitialCameraPosition();

      // 启动渲染循环
      this._startRenderLoop();

      this._isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize SimpleGlobe:', error);
      throw error;
    }
  }

  /**
   * 销毁资源
   */
  public dispose(): void {
    if (this._engine) {
      this._engine.stopRenderLoop();
      this._engine.dispose();
    }

    if (this._scene) {
      this._scene.dispose();
    }

    this._isInitialized = false;
  }

  /**
   * 飞行到指定位置
   */
  public flyTo(longitude: number, latitude: number, altitude?: number): void {
    if (!this._cameraController) return;

    const targetAltitude = altitude || this._config.altitude || 1000000;
    this._cameraController.flyTo(longitude, latitude, targetAltitude);
  }

  /**
   * 设置瓦片数据源
   */
  public setTileSource(sourceType: 'satellite' | 'terrain', tiles: string): void {
    if (this._tileLoader && sourceType === 'satellite') {
      this._tileLoader.setTileProvider(tiles);
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<GlobeConfig>): void {
    this._config = { ...this._config, ...newConfig };

    // 应用配置更改
    this._applyConfigChanges();
  }

  /**
   * 获取当前配置
   */
  public getConfig(): GlobeConfig {
    return { ...this._config };
  }

  /**
   * 获取场景对象
   */
  public get scene(): Scene {
    return this._scene;
  }

  /**
   * 获取相机对象
   */
  public get camera(): ArcRotateCamera {
    return this._camera;
  }

  /**
   * 获取引擎对象
   */
  public get engine(): Engine {
    return this._engine;
  }

  /**
   * 初始化 Babylon.js
   */
  private _initializeBabylon(): void {
    this._engine = new Engine(this._canvas, this._config.render?.antialias || true, {
      adaptToDeviceRatio: this._config.render?.adaptToDeviceRatio || true,
    });

    this._scene = new Scene(this._engine);

    // 创建相机
    const earthRadius = this._config.render?.earthRadius || 6378137;
    this._camera = new ArcRotateCamera('camera', 0, Math.PI / 4, earthRadius * 3, Vector3.Zero(), this._scene);

    this._scene.activeCamera = this._camera;
  }

  /**
   * 设置初始相机位置
   */
  private _setInitialCameraPosition(): void {
    if (!this._config.center) return;

    const [longitude, latitude] = this._config.center;
    const altitude = this._config.altitude || 1000000;

    this.flyTo(longitude, latitude, altitude);
  }

  /**
   * 启动渲染循环
   */
  private _startRenderLoop(): void {
    this._engine.runRenderLoop(() => {
      if (this._scene && this._scene.activeCamera) {
        this._update();
      }
    });

    // 处理窗口大小变化
    window.addEventListener('resize', () => {
      this._engine.resize();
    });
  }

  /**
   * 更新循环
   */
  private _update(): void {
    if (!this._isInitialized) return;

    const currentTime = performance.now();
    const deltaTime = this._lastUpdateTime > 0 ? currentTime - this._lastUpdateTime : 0;
    this._lastUpdateTime = currentTime;

    // 更新太阳系统
    if (this._sunSystem) {
      this._sunSystem.update(deltaTime);
    }

    // 更新瓦片加载
    if (this._camera && this._tileLoader) {
      this._tileLoader.update(this._camera.position);
    }

    // 更新大气层渲染
    if (this._camera && this._atmosphereRenderer && this._sunSystem) {
      const sunDirection = this._sunSystem.sunDirection;
      this._atmosphereRenderer.update(this._camera.position, sunDirection);
    }

    // 更新夜景灯光渲染
    if (this._camera && this._nightLightRenderer && this._sunSystem) {
      const sunDirection = this._sunSystem.sunDirection;
      this._nightLightRenderer.update(this._camera.position, sunDirection);
    }

    // 渲染场景
    this._scene?.render();
  }

  /**
   * 应用配置更改
   */
  private _applyConfigChanges(): void {
    // 应用图层配置
    if (this._config.layers?.atmosphere && this._atmosphereRenderer) {
      this._atmosphereRenderer.setIntensity(this._config.layers.atmosphere.intensity || 1.0);
    }

    if (this._config.layers?.nightLights && this._nightLightRenderer) {
      this._nightLightRenderer.setIntensity(this._config.layers.nightLights.intensity || 1.0);
      this._nightLightRenderer.setBrightness(this._config.layers.nightLights.brightness || 0.8);
    }

    if (this._config.layers?.terrain && this._terrainDetailRenderer) {
      this._terrainDetailRenderer.setHeightScale(this._config.layers.terrain.heightScale || 10000);
      this._terrainDetailRenderer.setDetailScale(this._config.layers.terrain.detailScale || 16);
    }

    // 应用太阳系统配置
    if (this._config.sun && this._sunSystem) {
      this._sunSystem.setTimeOfDay(this._config.sun.timeOfDay || 12.0);
      this._sunSystem.setLatitude(this._config.sun.latitude || 39.9);
    }
  }
}
