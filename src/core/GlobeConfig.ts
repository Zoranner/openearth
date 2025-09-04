/**
 * Globe配置模块
 * 提供系统参数配置和动态调整功能
 */

import { Vector3, Color3 } from '@babylonjs/core';
import type { TimeSystemConfig } from './TimeSystem';
import type { CameraControllerConfig } from '../camera/CameraController';
import type { TileLoaderConfig } from '../data/TileLoader';
import type { SunSystemConfig } from './SunSystem';
import { Season } from '../types';

/**
 * 瓦片贴图渲染器配置
 */
export interface TileTextureConfig {
  enabled?: boolean;
  textureManager?: TextureManagerConfig;
  lodManager?: TextureLODConfig;
  rendering?: TextureRenderingConfig;
}

export interface TextureManagerConfig {
  maxTextureCount?: number;
  maxTextureSize?: number;
  enableCompression?: boolean;
  compressionQuality?: number;
  enableMipmaps?: boolean;
}

export interface TextureLODConfig {
  maxZoom?: number;
  minZoom?: number;
  tileSize?: number;
  lodThresholds?: number[];
  frustumCulling?: boolean;
}

export interface TextureRenderingConfig {
  enableBlending?: boolean;
  blendMode?: string;
  enableFadeTransition?: boolean;
  fadeDistance?: number;
  enableSeamlessBlending?: boolean;
}

/**
 * 地形高度系统配置
 */
export interface TerrainHeightConfig {
  enabled?: boolean;
  meshConfig?: MeshConfiguration;
}

export interface MeshConfiguration {
  enableHeightMaps?: boolean;
  heightScale?: number;
  meshResolution?: number;
  enableNormalCalculation?: boolean;
  normalSmoothing?: boolean;
}

/**
 * 地球渲染器配置
 */
export interface EarthRendererConfig {
  enabled?: boolean;
  enableTileTextures?: boolean;
  enableTerrainHeight?: boolean;
  enableDayNightLighting?: boolean;
}

/**
 * 夜间灯光配置
 */
export interface NightLightConfig {
  intensity?: number;
  brightness?: number;
  cityLightColor?: Color3;
  fadeDistance?: number;
  minLightThreshold?: number;
  maxLightThreshold?: number;
  maxDisplayDistance?: number;
  minDisplayDistance?: number;
  enableDistanceControl?: boolean;
}

/**
 * 大气渲染配置
 */
export interface AtmosphereConfig {
  enabled?: boolean;
  atmosphereHeight?: number;
  sunDirection?: Vector3;
  rayleighCoefficient?: Vector3;
  mieCoefficient?: number;
  sunIntensity?: number;
  scaleHeight?: number;
  mieScaleHeight?: number;
  g?: number;
  exposure?: number;
  turbidity?: number;
}

/**
 * 地球配置选项 - 采用模块化配置风格
 */
export interface GlobeConfig {
  /** 容器元素 */
  container: HTMLCanvasElement;

  /** 初始缩放级别 */
  zoom?: number;

  /** 最小缩放级别 */
  minZoom?: number;

  /** 最大缩放级别 */
  maxZoom?: number;

  /** 初始中心位置 [经度, 纬度] */
  center?: [number, number];

  /** 初始高度（米） */
  altitude?: number;

  /** 地球半径（米） */
  earthRadius?: number;

  /** 抗锯齿 */
  antialias?: boolean;

  /** 适配设备像素比 */
  adaptToDeviceRatio?: boolean;

  /** 时间系统配置 */
  timeSystem?: TimeSystemConfig;

  /** 瓦片加载器配置 */
  tileLoader?: TileLoaderConfig;

  /** 瓦片贴图配置 */
  tileTexture?: TileTextureConfig;

  /** 地形高度配置 */
  terrainHeight?: TerrainHeightConfig;

  /** 地球渲染器配置 */
  earthRenderer?: EarthRendererConfig;

  /** 夜间灯光配置 */
  nightLight?: NightLightConfig;

  /** 大气渲染配置 */
  atmosphere?: AtmosphereConfig;

  /** 太阳系统配置 */
  sunSystem?: SunSystemConfig;

  /** 相机控制配置 */
  controls?: CameraControllerConfig;
}

/**
 * 默认配置
 */
export const defaultGlobeConfig: Omit<GlobeConfig, 'container'> = {
  zoom: 4,
  minZoom: 2,
  maxZoom: 18,
  center: [120.1551, 30.2741], // 杭州坐标
  altitude: 1000000,
  earthRadius: 6378.137, // 真实地球半径缩小1000倍 (6378137m / 1000)
  antialias: true,
  adaptToDeviceRatio: true,

  timeSystem: {
    initialTime: new Date(),
    timeScale: 1.0,
    enableRealTime: true,
    enablePause: true,
    enableReset: true,
    enableTimeJump: true,
    timeZone: 0,
    enableTimeZoneConversion: false,
  },

  tileLoader: {
    maxCacheSize: 1000,
    maxConcurrentLoads: 6,
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000,
    maxMemory: 256 * 1024 * 1024, // 256MB
    dataSources: [],
  },

  tileTexture: {
    enabled: true,
    textureManager: {
      maxTextureCount: 1000,
      maxTextureSize: 512,
      enableCompression: true,
      compressionQuality: 0.8,
      enableMipmaps: true,
    },
    lodManager: {
      maxZoom: 18,
      minZoom: 0,
      tileSize: 256,
      lodThresholds: [0.5, 1.0, 2.0, 4.0],
      frustumCulling: true,
    },
    rendering: {
      enableBlending: true,
      blendMode: 'alpha',
      enableFadeTransition: true,
      fadeDistance: 0.2,
      enableSeamlessBlending: true,
    },
  },

  terrainHeight: {
    enabled: true,
    meshConfig: {
      enableHeightMaps: true,
      heightScale: 10000,
      meshResolution: 64,
      enableNormalCalculation: true,
      normalSmoothing: true,
    },
  },

  earthRenderer: {
    enabled: true,
    enableTileTextures: true,
    enableTerrainHeight: true,
    enableDayNightLighting: true,
  },

  nightLight: {
    intensity: 1.0,
    brightness: 0.8,
    cityLightColor: new Color3(1.0, 0.9, 0.6),
    fadeDistance: 0.1,
    minLightThreshold: 0.1,
    maxLightThreshold: 0.9,
    maxDisplayDistance: 2.0,
    minDisplayDistance: 1.2,
    enableDistanceControl: true,
  },

  atmosphere: {
    enabled: true,
    atmosphereHeight: 100000,
    sunDirection: new Vector3(1, 0.5, 0.3),
    rayleighCoefficient: new Vector3(0.0058, 0.0135, 0.0331),
    mieCoefficient: 0.0021,
    sunIntensity: 22.0,
    scaleHeight: 8500,
    mieScaleHeight: 1200,
    g: -0.758,
    exposure: 2.0,
    turbidity: 2.0,
  },

  sunSystem: {
    lightIntensity: {
      baseIntensity: 1.0,
      maxIntensity: 1.2,
      minIntensity: 0.8,
      enableAtmosphericAttenuation: true,
      enableSeasonalVariation: true,
      enableWeatherEffects: false,
    },
    atmosphericConditions: {
      cloudCover: 0.0,
      humidity: 0.5,
      pollution: 0.0,
    },
    seasonalFactors: {
      season: Season.SPRING,
      northernHemisphere: true,
    },
  },

  controls: {
    enableMouse: true,
    enableKeyboard: true,
    enableWheel: true,
    sensitivity: 1.0,
    constraints: {
      minDistance: 1.2,
      maxDistance: 10.0,
      minPolarAngle: 0.1,
      maxPolarAngle: 3.04,
    },
    collision: {
      earthRadius: 6378.137, // 真实地球半径缩小1000倍 (6378137m / 1000)
      minAltitude: 1.2,
      maxAltitude: 10.0,
    },
    animation: {
      defaultDuration: 60,
      easingFunction: 'ease',
    },
  },
};

/**
 * 配置验证器
 */
export class ConfigValidator {
  /**
   * 验证Globe配置
   */
  static validateGlobeConfig(config: GlobeConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证必需参数
    if (!config.container) {
      errors.push('Container canvas element is required');
    }

    // 验证缩放级别
    if (config.zoom !== undefined) {
      if (config.zoom < 0 || config.zoom > 30) {
        errors.push('Zoom level must be between 0 and 30');
      }
    }

    if (config.minZoom !== undefined && config.maxZoom !== undefined) {
      if (config.minZoom >= config.maxZoom) {
        errors.push('minZoom must be less than maxZoom');
      }
    }

    // 验证中心坐标
    if (config.center) {
      const [lon, lat] = config.center;
      if (lon < -180 || lon > 180) {
        errors.push('Longitude must be between -180 and 180');
      }
      if (lat < -90 || lat > 90) {
        errors.push('Latitude must be between -90 and 90');
      }
    }

    // 验证高度
    if (config.altitude !== undefined && config.altitude < 0) {
      errors.push('Altitude must be non-negative');
    }

    // 验证地球半径
    if (config.earthRadius !== undefined && config.earthRadius <= 0) {
      errors.push('Earth radius must be positive');
    }

    // 验证时间系统配置
    if (config.timeSystem) {
      const timeErrors = this.validateTimeSystemConfig(config.timeSystem);
      errors.push(...timeErrors);
    }

    // 验证瓦片加载器配置
    if (config.tileLoader) {
      const tileLoaderErrors = this.validateTileLoaderConfig(config.tileLoader);
      errors.push(...tileLoaderErrors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证时间系统配置
   */
  static validateTimeSystemConfig(config: TimeSystemConfig): string[] {
    const errors: string[] = [];

    if (config.timeScale !== undefined) {
      if (config.timeScale < 0 || config.timeScale > 10000) {
        errors.push('Time scale must be between 0 and 10000');
      }
    }

    if (config.timeZone !== undefined) {
      if (config.timeZone < -12 || config.timeZone > 14) {
        errors.push('Time zone must be between -12 and 14');
      }
    }

    return errors;
  }

  /**
   * 验证瓦片加载器配置
   */
  static validateTileLoaderConfig(config: TileLoaderConfig): string[] {
    const errors: string[] = [];

    if (config.maxCacheSize !== undefined && config.maxCacheSize <= 0) {
      errors.push('Max cache size must be positive');
    }

    if (config.maxConcurrentLoads !== undefined && config.maxConcurrentLoads <= 0) {
      errors.push('Max concurrent loads must be positive');
    }

    if (config.retryAttempts !== undefined && config.retryAttempts < 0) {
      errors.push('Retry attempts must be non-negative');
    }

    if (config.timeout !== undefined && config.timeout <= 0) {
      errors.push('Timeout must be positive');
    }

    return errors;
  }
}

/**
 * 配置合并工具
 */
export class ConfigMerger {
  /**
   * 深度合并配置
   */
  static mergeConfigs<T>(defaultConfig: T, userConfig: Partial<T>): T {
    const result = { ...defaultConfig };

    for (const key in userConfig) {
      if (Object.prototype.hasOwnProperty.call(userConfig, key)) {
        const value = userConfig[key];

        if (value !== undefined) {
          if (this.isObject(value) && this.isObject(result[key])) {
            // 递归合并对象
            result[key] = this.mergeConfigs(result[key], value);
          } else {
            // 直接赋值
            result[key] = value as T[Extract<keyof T, string>];
          }
        }
      }
    }

    return result;
  }

  /**
   * 检查是否为对象
   */
  private static isObject(item: unknown): boolean {
    return (
      item !== null &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      !(item instanceof Date) &&
      !(item instanceof Vector3) &&
      !(item instanceof Color3)
    );
  }
}

/**
 * 创建完整的Globe配置
 */
export function createGlobeConfig(userConfig: Partial<GlobeConfig> & { container: HTMLCanvasElement }): GlobeConfig {
  const fullDefaultConfig = {
    ...defaultGlobeConfig,
    container: userConfig.container,
  };

  const mergedConfig = ConfigMerger.mergeConfigs(fullDefaultConfig, userConfig);

  // 验证配置
  const validation = ConfigValidator.validateGlobeConfig(mergedConfig);
  if (!validation.isValid) {
    throw new Error(`Invalid Globe configuration: ${validation.errors.join(', ')}`);
  }

  return mergedConfig;
}
