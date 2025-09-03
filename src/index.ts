/**
 * OpenEarth 主入口文件
 * 导出重构后的所有模块
 */

// 核心模块
export { Globe } from './core/Globe';
export { TimeSystem, TimeEvent, TimeEventType, TimeSystemConfig } from './core/TimeSystem';
export { GlobeConfig, defaultGlobeConfig, createGlobeConfig, ConfigValidator, ConfigMerger } from './core/GlobeConfig';
export { SunSystem, SunSystemConfig, LightIntensityConfig } from './core/SunSystem';

// 相机模块
export {
  CameraController,
  CameraControllerConfig,
  InputConfig,
  ConstraintConfig,
  CollisionConfig,
  AnimationConfig,
} from './camera/CameraController';

// 数据管理模块
export { TileLoader, TileLoaderConfig } from './data/TileLoader';
export {
  DataSource,
  DataSourceConfig,
  XYZDataSource,
  TMSDataSource,
  WMTSDataSource,
  DataSourceFactory,
} from './data/DataSource';
export { TileCache, Tile } from './data/TileCache';

// 渲染模块
export { AtmosphereRenderer, AtmosphereOptions, AtmosphereScatteringOptions } from './rendering/AtmosphereRenderer';
export { NightLightRenderer, NightLightOptions } from './rendering/NightLightRenderer';

// 工具模块
export { MathUtils, CoordinateUtils, MatrixUtils } from './utils/MathUtils';
export { Logger, LogLevel, LogEntry, logger } from './utils/Logger';
export { EventBus, StateManager, EventCallback, EventSubscription, eventBus, stateManager } from './utils/EventSystem';
export { NetworkManager, RequestConfig, RequestResult, RequestError, networkManager } from './utils/NetworkManager';

// 类型定义
export * from './types';

// 配置类型导出
export type {
  TileTextureConfig,
  TextureManagerConfig,
  TextureLODConfig,
  TextureRenderingConfig,
  TerrainHeightConfig,
  MeshConfiguration,
  EarthRendererConfig,
  NightLightConfig,
  AtmosphereConfig,
} from './core/GlobeConfig';
