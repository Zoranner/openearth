/**
 * OpenEarth 主入口文件
 * 导出重构后的所有模块
 */

// 核心模块
export { Globe } from './core/Globe';
export { TimeSystem, TimeEventType } from './core/TimeSystem';
export type { TimeEvent, TimeSystemConfig } from './core/TimeSystem';
export { createGlobeConfig, ConfigValidator, ConfigMerger } from './core/GlobeConfig';
export type { GlobeConfig } from './core/GlobeConfig';
export { SunSystem } from './core/SunSystem';
export type { SunSystemConfig, LightIntensityConfig } from './core/SunSystem';

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
export { TileLoader } from './data/TileLoader';
export type { TileLoaderConfig } from './data/TileLoader';
export { DataSource, XYZDataSource, TMSDataSource, WMTSDataSource, DataSourceFactory } from './data/DataSource';
export type { DataSourceConfig } from './data/DataSource';
export { TileCache } from './data/TileCache';
export type { Tile } from './data/TileCache';

// 渲染模块
export { EarthRenderer } from './rendering/EarthRenderer';
export { TileTextureRenderer } from './rendering/TileTextureRenderer';
export type { EarthRendererConfig } from './rendering/EarthRendererConfig';
export { AtmosphereRenderer } from './rendering/AtmosphereRenderer';
export type { AtmosphereOptions, AtmosphereScatteringOptions } from './rendering/AtmosphereRenderer';
export { NightLightRenderer } from './rendering/NightLightRenderer';
export type { NightLightOptions } from './rendering/NightLightRenderer';

// 地形模块
export { TerrainHeightSystem } from './terrain/TerrainHeightSystem';
export type { TerrainHeightSystemConfig } from './terrain/TerrainHeightSystem';

// 工具模块
export { MathUtils, CoordinateUtils, MatrixUtils } from './utils/MathUtils';
export { Logger, LogLevel, logger } from './utils/Logger';
export type { LogEntry } from './utils/Logger';
export { EventBus, StateManager, eventBus, stateManager } from './utils/EventSystem';
export type { EventCallback, EventSubscription } from './utils/EventSystem';
export { NetworkManager, networkManager } from './utils/NetworkManager';
export type { RequestConfig, RequestResult, RequestError } from './utils/NetworkManager';

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
  NightLightConfig,
  AtmosphereConfig,
} from './core/GlobeConfig';
