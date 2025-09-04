/**
 * 地球渲染器配置接口
 * 根据 07-地球渲染模块设计.md 定义
 */

/**
 * 地球渲染器配置
 */
export interface EarthRendererConfig {
  /** 是否启用地球渲染 */
  enabled: boolean;

  /** 是否启用瓦片贴图 */
  enableTileTextures: boolean;

  /** 是否启用地形高度 */
  enableTerrainHeight: boolean;

  /** 是否启用昼夜光照 */
  enableDayNightLighting: boolean;
}

/**
 * 创建默认的地球渲染器配置
 */
export function createEarthRendererConfig(userConfig: Partial<EarthRendererConfig> = {}): EarthRendererConfig {
  const defaultConfig: EarthRendererConfig = {
    enabled: true,
    enableTileTextures: true,
    enableTerrainHeight: true,
    enableDayNightLighting: true,
  };

  return {
    ...defaultConfig,
    ...userConfig,
  };
}
