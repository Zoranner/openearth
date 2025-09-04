/**
 * Globe类 - 地球核心模块
 * 系统的核心控制器，负责系统的统一入口、生命周期管理、配置管理和时间系统管理
 */

import { Engine, Scene, Vector3, Color4, ArcRotateCamera } from '@babylonjs/core';
import { TimeSystem, TimeEventType, type TimeEvent } from './TimeSystem';
import { SunSystem } from './SunSystem';
import { createGlobeConfig, type GlobeConfig } from './GlobeConfig';
import { CameraController } from '../camera/CameraController';
import { TileLoader } from '../data/TileLoader';
import { DataSourceFactory } from '../data/DataSource';
import { EarthRenderer } from '../rendering/EarthRenderer';
import { createEarthRendererConfig } from '../rendering/EarthRendererConfig';
import type { AtmosphereRenderer } from '../rendering/AtmosphereRenderer';
import type { NightLightRenderer } from '../rendering/NightLightRenderer';
import { logger } from '../utils/Logger';
import { eventBus } from '../utils/EventSystem';

// 定义系统状态类型
export interface SystemStatus {
  isInitialized: boolean;
  timeSystem: unknown;
  sunSystem: unknown;
  cameraController: unknown;
  tileLoader: unknown;
  earthRenderer: unknown;
  atmosphereRenderer: unknown;
  nightLightRenderer: unknown;
}

// 定义引擎选项类型
export interface EngineOptions {
  adaptToDeviceRatio?: boolean;
}

/**
 * Globe类
 * 系统的核心控制器，负责系统的统一入口、生命周期管理、配置管理和时间系统管理
 */
export class Globe {
  private _canvas: HTMLCanvasElement;
  private _engine!: Engine;
  private _scene!: Scene;
  private _camera!: ArcRotateCamera;
  private _config: GlobeConfig;
  private _isInitialized: boolean;

  // 核心系统
  private _timeSystem: TimeSystem | null = null;
  private _sunSystem: SunSystem | null = null;
  private _cameraController: CameraController | null = null;
  private _tileLoader: TileLoader | null = null;

  // 渲染模块
  private _earthRenderer: EarthRenderer | null = null;
  private _atmosphereRenderer: AtmosphereRenderer | null = null;
  private _nightLightRenderer: NightLightRenderer | null = null;

  constructor(userConfig: Partial<GlobeConfig> & { container: HTMLCanvasElement }) {
    this._canvas = userConfig.container;
    this._config = createGlobeConfig(userConfig);
    this._isInitialized = false;

    this._initializeBabylon();

    logger.info('Globe created', 'Globe', {
      center: this._config.center,
      zoom: this._config.zoom,
      earthRadius: this._config.earthRadius,
    });
  }

  /**
   * 初始化Globe系统
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      logger.warn('Globe already initialized', 'Globe');
      return;
    }

    try {
      logger.info('Initializing Globe system', 'Globe');

      // 1. 初始化时间系统（优先创建）
      await this._initializeTimeSystem();

      // 2. 初始化太阳系统
      await this._initializeSunSystem();

      // 3. 初始化瓦片加载器
      await this._initializeTileLoader();

      // 4. 初始化渲染模块
      await this._initializeRenderingModules();
      // 4. 初始化地球渲染器
      await this._initializeEarthRenderer();

      // 5. 初始化相机控制器
      await this._initializeCameraController();

      // 6. 设置事件订阅
      this._setupEventSubscriptions();

      // 7. 启动渲染循环
      this._startRenderLoop();

      this._isInitialized = true;
      logger.info('Globe system initialized successfully', 'Globe');

      // 发布初始化完成事件
      eventBus.publish('globe:initialized', {
        config: this._config,
      });
    } catch (error) {
      logger.error('Failed to initialize Globe', 'Globe', error);
      throw error;
    }
  }

  /**
   * 销毁Globe系统
   */
  public dispose(): void {
    if (!this._isInitialized) {
      return;
    }

    logger.info('Disposing Globe system', 'Globe');

    // 停止渲染循环
    if (this._engine) {
      this._engine.stopRenderLoop();
    }

    // 按相反顺序销毁模块
    if (this._cameraController) {
      this._cameraController.dispose();
      this._cameraController = null;
    }

    if (this._earthRenderer) {
      this._earthRenderer.dispose();
      this._earthRenderer = null;
    }

    if (this._nightLightRenderer) {
      this._nightLightRenderer.dispose();
      this._nightLightRenderer = null;
    }

    if (this._atmosphereRenderer) {
      this._atmosphereRenderer.dispose();
      this._atmosphereRenderer = null;
    }

    if (this._tileLoader) {
      this._tileLoader.dispose();
      this._tileLoader = null;
    }

    if (this._sunSystem) {
      this._sunSystem.dispose();
      this._sunSystem = null;
    }

    if (this._timeSystem) {
      this._timeSystem.dispose();
      this._timeSystem = null;
    }

    if (this._engine) {
      this._engine.dispose();
    }

    this._isInitialized = false;

    // 发布销毁事件
    eventBus.publish('globe:disposed');

    logger.info('Globe system disposed', 'Globe');
  }

  /**
   * 飞行到指定位置
   */
  public async flyTo(longitude: number, latitude: number, altitude?: number): Promise<void> {
    if (this._cameraController) {
      await this._cameraController.flyTo(longitude, latitude, altitude);
      logger.info('Fly to completed', 'Globe', { longitude, latitude, altitude });
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<GlobeConfig>): void {
    const oldConfig = { ...this._config };
    this._config = createGlobeConfig({ ...this._config, ...newConfig });

    // 更新各个模块的配置
    if (newConfig.timeSystem && this._timeSystem) {
      this._timeSystem.updateConfig(newConfig.timeSystem);
    }

    if (newConfig.sunSystem && this._sunSystem) {
      // 更新太阳系统配置
      if (newConfig.sunSystem.atmosphericConditions) {
        this._sunSystem.setAtmosphericConditions(newConfig.sunSystem.atmosphericConditions);
      }
      if (newConfig.sunSystem.seasonalFactors) {
        this._sunSystem.setSeasonalFactors(newConfig.sunSystem.seasonalFactors);
      }
    }

    logger.info('Globe configuration updated', 'Globe', {
      oldConfig,
      newConfig: this._config,
    });

    // 发布配置更新事件
    eventBus.publish('globe:config-updated', {
      oldConfig,
      newConfig: this._config,
    });
  }

  /**
   * 获取配置
   */
  public getConfig(): GlobeConfig {
    return { ...this._config };
  }

  /**
   * 获取时间系统
   */
  public getTimeSystem(): TimeSystem | null {
    return this._timeSystem;
  }

  /**
   * 获取太阳系统
   */
  public getSunSystem(): SunSystem | null {
    return this._sunSystem;
  }

  /**
   * 获取相机控制器
   */
  public getCameraController(): CameraController | null {
    return this._cameraController;
  }

  /**
   * 获取瓦片加载器
   */
  public getTileLoader(): TileLoader | null {
    return this._tileLoader;
  }

  /**
   * 获取地球渲染器
   */
  public getEarthRenderer(): EarthRenderer | null {
    return this._earthRenderer;
  }

  /**
   * 获取大气渲染器
   */
  public getAtmosphereRenderer(): AtmosphereRenderer | null {
    return this._atmosphereRenderer;
  }

  /**
   * 获取夜间灯光渲染器
   */
  public getNightLightRenderer(): NightLightRenderer | null {
    return this._nightLightRenderer;
  }

  /**
   * 获取场景
   */
  public getScene(): Scene {
    return this._scene;
  }

  /**
   * 获取相机
   */
  public getCamera(): ArcRotateCamera {
    return this._camera;
  }

  /**
   * 获取引擎
   */
  public getEngine(): Engine {
    return this._engine;
  }

  /**
   * 获取系统状态
   */
  public getStatus(): SystemStatus {
    return {
      isInitialized: this._isInitialized,
      timeSystem: this._timeSystem?.getStatus(),
      sunSystem: this._sunSystem?.getStatus(),
      cameraController: this._cameraController?.getStatus(),
      tileLoader: this._tileLoader?.getStatus(),
      earthRenderer: this._earthRenderer?.getStatus(),
      atmosphereRenderer: this._atmosphereRenderer?.getStatus(),
      nightLightRenderer: this._nightLightRenderer?.getStatus(),
    };
  }

  /**
   * 初始化Babylon.js引擎和场景
   */
  private _initializeBabylon(): void {
    // 创建引擎
    const engineOptions: EngineOptions = {};
    if (this._config.adaptToDeviceRatio !== undefined) {
      engineOptions.adaptToDeviceRatio = this._config.adaptToDeviceRatio;
    }

    this._engine = new Engine(this._canvas, this._config.antialias, engineOptions);

    // 创建场景
    this._scene = new Scene(this._engine);
    this._scene.clearColor = new Color4(0, 0, 0, 1);

    // 创建相机
    const center = this._config.center ?? [0, 0];
    const altitude = this._config.altitude ?? 2000000;

    this._camera = new ArcRotateCamera(
      'camera',
      (center[0] * Math.PI) / 180,
      ((90 - center[1]) * Math.PI) / 180,
      altitude / (this._config.earthRadius ?? 6378137),
      Vector3.Zero(),
      this._scene
    );

    // 设置相机参数
    this._camera.minZ = 0.1;
    this._camera.maxZ = 1000;
    this._camera.attachControl(this._canvas, true);

    // 设置相机约束
    if (this._config.minZoom !== undefined) {
      this._camera.lowerRadiusLimit = this._config.minZoom;
    }
    if (this._config.maxZoom !== undefined) {
      this._camera.upperRadiusLimit = this._config.maxZoom;
    }

    logger.debug('Babylon.js initialized', 'Globe', {
      antialias: this._config.antialias,
      adaptToDeviceRatio: this._config.adaptToDeviceRatio,
    });
  }

  /**
   * 初始化时间系统
   */
  private async _initializeTimeSystem(): Promise<void> {
    this._timeSystem = new TimeSystem(this._config.timeSystem);
    await this._timeSystem.initialize();
    logger.debug('TimeSystem initialized', 'Globe');
  }

  /**
   * 初始化太阳系统
   */
  private async _initializeSunSystem(): Promise<void> {
    this._sunSystem = new SunSystem(this._config.sunSystem);
    await this._sunSystem.initialize();
    logger.debug('SunSystem initialized', 'Globe');
  }

  /**
   * 初始化瓦片加载器
   */
  private async _initializeTileLoader(): Promise<void> {
    this._tileLoader = new TileLoader(this._config.tileLoader);
    await this._tileLoader.initialize();

    // 添加 ArcGIS 卫星影像数据源
    const arcgisDataSource = DataSourceFactory.createArcGISSatellite();
    this._tileLoader.addDataSource('arcgis', arcgisDataSource);

    logger.debug('TileLoader initialized', 'Globe');
  }

  /**
   * 初始化地球渲染器
   */
  private async _initializeEarthRenderer(): Promise<void> {
    logger.debug('Initializing EarthRenderer', 'Globe');

    // 创建地球渲染器配置
    const earthRendererConfig = createEarthRendererConfig({
      enabled: true,
      enableTileTextures: true,
      enableTerrainHeight: false, // 现阶段禁用
      enableDayNightLighting: false, // 现阶段禁用
    });

    // 创建地球渲染器
    this._earthRenderer = new EarthRenderer(this._scene, this._camera, earthRendererConfig);
    await this._earthRenderer.initialize();

    logger.debug('EarthRenderer initialized', 'Globe');
  }

  /**
   * 初始化相机控制器
   */
  private async _initializeCameraController(): Promise<void> {
    this._cameraController = new CameraController(this._scene, this._camera, this._config.controls);
    await this._cameraController.initialize();
    logger.debug('CameraController initialized', 'Globe');
  }

  /**
   * 设置事件订阅
   */
  private _setupEventSubscriptions(): void {
    if (!this._timeSystem) return;

    // 订阅时间系统事件
    this._timeSystem.getTimeObservable().add((event: TimeEvent) => {
      switch (event.type) {
        case TimeEventType.TIME_CHANGED:
        case TimeEventType.TIME_JUMPED:
          // 更新太阳系统
          if (this._sunSystem) {
            this._sunSystem.update(event.currentTime);
          }

          // 通知地球渲染器
          if (this._earthRenderer) {
            this._earthRenderer.onTimeChanged(event.currentTime);
          }

          // 通知夜间灯光渲染器
          if (this._nightLightRenderer) {
            this._nightLightRenderer.onTimeChanged(event.currentTime);
          }

          // 通知大气渲染器
          if (this._atmosphereRenderer) {
            this._atmosphereRenderer.onTimeChanged(event.currentTime);
          }
          break;
      }
    });

    logger.debug('Event subscriptions set up', 'Globe');
  }

  /**
   * 启动渲染循环
   */
  private _startRenderLoop(): void {
    this._engine.runRenderLoop(() => {
      const deltaTime = this._engine.getDeltaTime() / 1000; // 转换为秒

      // 更新时间系统
      if (this._timeSystem) {
        this._timeSystem.update(deltaTime);
      }

      // 更新相机控制器
      if (this._cameraController) {
        this._cameraController.update();
      }

      // 更新瓦片加载器
      if (this._tileLoader) {
        this._tileLoader.updateCameraPosition(this._camera.position);
      }

      // 更新地球渲染器
      if (this._earthRenderer) {
        this._earthRenderer.update(this._camera.position);
      }

      // 更新大气渲染器
      if (this._atmosphereRenderer && this._sunSystem) {
        this._atmosphereRenderer.update(this._camera.position, this._sunSystem.getSunDirection());
      }

      // 更新夜间灯光渲染器
      if (this._nightLightRenderer && this._sunSystem) {
        this._nightLightRenderer.update(this._camera.position, this._sunSystem.getSunDirection());
      }

      // 渲染场景
      this._scene.render();
    });

    // 处理窗口大小变化
    window.addEventListener('resize', () => {
      this._engine.resize();
    });

    logger.debug('Render loop started', 'Globe');
  }
}
