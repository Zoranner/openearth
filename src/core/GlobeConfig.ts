import { Vector3 } from '@babylonjs/core';

/**
 * 地球配置选项 - 采用类似 maplibre 的简洁配置风格
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

  /** 是否显示 Logo */
  showLogo?: boolean;

  /** 渲染配置 */
  render?: {
    /** 抗锯齿 */
    antialias?: boolean;
    /** 适配设备像素比 */
    adaptToDeviceRatio?: boolean;
    /** 地球半径（米） */
    earthRadius?: number;
  };

  /** 数据源配置 */
  sources?: {
    /** 卫星影像数据源 */
    satellite?: {
      /** 瓦片服务地址 */
      tiles: string;
      /** 瓦片大小 */
      tileSize?: number;
      /** 最小缩放级别 */
      minZoom?: number;
      /** 最大缩放级别 */
      maxZoom?: number;
      /** 版权信息 */
      attribution?: string;
    };
    /** 地形数据源 */
    terrain?: {
      /** 高程瓦片服务地址 */
      tiles: string;
      /** 瓦片大小 */
      tileSize?: number;
      /** 最小缩放级别 */
      minZoom?: number;
      /** 最大缩放级别 */
      maxZoom?: number;
      /** 版权信息 */
      attribution?: string;
    };
  };

  /** 图层配置 */
  layers?: {
    /** 卫星影像图层 */
    satellite?: {
      /** 是否启用 */
      enabled?: boolean;
      /** 透明度 */
      opacity?: number;
    };
    /** 地形图层 */
    terrain?: {
      /** 是否启用 */
      enabled?: boolean;
      /** 高度缩放 */
      heightScale?: number;
      /** 细节缩放 */
      detailScale?: number;
    };
    /** 大气层图层 */
    atmosphere?: {
      /** 是否启用 */
      enabled?: boolean;
      /** 强度 */
      intensity?: number;
    };
    /** 夜景灯光图层 */
    nightLights?: {
      /** 是否启用 */
      enabled?: boolean;
      /** 强度 */
      intensity?: number;
      /** 亮度 */
      brightness?: number;
    };
  };

  /** 交互控制 */
  controls?: {
    /** 允许拖拽平移 */
    dragPan?: boolean;
    /** 允许滚轮缩放 */
    scrollZoom?: boolean;
    /** 允许右键拖拽旋转 */
    dragRotate?: boolean;
    /** 允许框选缩放 */
    boxZoom?: boolean;
    /** 允许键盘控制 */
    keyboard?: boolean;
    /** 允许触摸控制 */
    touchZoomRotate?: boolean;
  };

  /** 太阳系统配置 */
  sun?: {
    /** 是否启用日夜循环 */
    dayNightCycle?: boolean;
    /** 初始时间（小时） */
    timeOfDay?: number;
    /** 初始纬度 */
    latitude?: number;
    /** 循环速度（毫秒/天） */
    cycleSpeed?: number;
  };

  /** 性能配置 */
  performance?: {
    /** 最大 LOD 级别 */
    maxLOD?: number;
    /** 最小 LOD 级别 */
    minLOD?: number;
    /** 瓦片缓存大小 */
    tileCacheSize?: number;
    /** 最大纹理内存（字节） */
    maxTextureMemory?: number;
    /** 垃圾回收间隔（毫秒） */
    garbageCollectionInterval?: number;
  };
}

/**
 * 默认配置
 */
export const defaultGlobeConfig: Partial<GlobeConfig> = {
  zoom: 4,
  minZoom: 2,
  maxZoom: 18,
  center: [120.1551, 30.2741], // 杭州坐标
  altitude: 1000000,
  showLogo: false,

  render: {
    antialias: true,
    adaptToDeviceRatio: true,
    earthRadius: 6378137,
  },

  sources: {
    satellite: {
      tiles: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      tileSize: 256,
      minZoom: 0,
      maxZoom: 19,
      attribution: '© Esri',
    },
    terrain: {
      tiles: 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png',
      tileSize: 256,
      minZoom: 0,
      maxZoom: 15,
      attribution: '© Mapzen',
    },
  },

  layers: {
    satellite: {
      enabled: true,
      opacity: 1.0,
    },
    terrain: {
      enabled: true,
      heightScale: 10000,
      detailScale: 16,
    },
    atmosphere: {
      enabled: true,
      intensity: 1.0,
    },
    nightLights: {
      enabled: true,
      intensity: 1.0,
      brightness: 0.8,
    },
  },

  controls: {
    dragPan: true,
    scrollZoom: true,
    dragRotate: false,
    boxZoom: false,
    keyboard: false,
    touchZoomRotate: true,
  },

  sun: {
    dayNightCycle: true,
    timeOfDay: 12.0,
    latitude: 39.9,
    cycleSpeed: 24000, // 24秒 = 1天
  },

  performance: {
    maxLOD: 18,
    minLOD: 0,
    tileCacheSize: 1000,
    maxTextureMemory: 512 * 1024 * 1024, // 512MB
    garbageCollectionInterval: 30000,
  },
};
