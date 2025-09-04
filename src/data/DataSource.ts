/**
 * 数据源模块
 * 负责外部瓦片服务接口封装和协议适配
 */

import type { TileKey } from '../types';
import { logger } from '../utils/Logger';

export interface DataSourceConfig {
  name: string;
  type: string;
  url: string;
  attribution?: string;
  maxZoom: number;
  minZoom: number;
  format: string;
  headers?: Record<string, string>;
  subdomains?: string[];
  tileSize?: number;
}

/**
 * 数据源基类
 */
export abstract class DataSource {
  protected _name: string;
  protected _type: string;
  protected _urlTemplate: string;
  protected _attribution: string;
  protected _maxZoom: number;
  protected _minZoom: number;
  protected _format: string;
  protected _headers: Record<string, string>;
  protected _subdomains: string[];
  protected _tileSize: number;

  constructor(config: DataSourceConfig) {
    this._name = config.name;
    this._type = config.type;
    this._urlTemplate = config.url;
    this._attribution = config.attribution ?? '';
    this._maxZoom = config.maxZoom;
    this._minZoom = config.minZoom;
    this._format = config.format;
    this._headers = config.headers ?? {};
    this._subdomains = config.subdomains ?? [];
    this._tileSize = config.tileSize ?? 256;

    logger.debug('DataSource created', 'DataSource', {
      name: this._name,
      type: this._type,
      maxZoom: this._maxZoom,
      minZoom: this._minZoom,
    });
  }

  /**
   * 获取数据源名称
   */
  getName(): string {
    return this._name;
  }

  /**
   * 获取数据源类型
   */
  getType(): string {
    return this._type;
  }

  /**
   * 获取瓦片URL
   */
  abstract getUrl(tileKey: TileKey): string;

  /**
   * 检查是否支持指定缩放级别
   */
  supportsZoom(zoom: number): boolean {
    return zoom >= this._minZoom && zoom <= this._maxZoom;
  }

  /**
   * 获取版权信息
   */
  getAttribution(): string {
    return this._attribution;
  }

  /**
   * 获取最大缩放级别
   */
  getMaxZoom(): number {
    return this._maxZoom;
  }

  /**
   * 获取最小缩放级别
   */
  getMinZoom(): number {
    return this._minZoom;
  }

  /**
   * 获取数据格式
   */
  getFormat(): string {
    return this._format;
  }

  /**
   * 获取瓦片大小
   */
  getTileSize(): number {
    return this._tileSize;
  }

  /**
   * 获取请求头
   */
  getHeaders(): Record<string, string> {
    return { ...this._headers };
  }

  /**
   * 选择子域名
   */
  protected selectSubdomain(tileKey: TileKey): string {
    if (this._subdomains.length === 0) {
      return '';
    }

    const index = (tileKey.x + tileKey.y + tileKey.z) % this._subdomains.length;
    return this._subdomains[index];
  }

  /**
   * 替换URL模板中的占位符
   */
  protected replaceUrlPlaceholders(template: string, tileKey: TileKey): string {
    const subdomain = this.selectSubdomain(tileKey);

    return template
      .replace('{x}', tileKey.x.toString())
      .replace('{y}', tileKey.y.toString())
      .replace('{z}', tileKey.z.toString())
      .replace('{s}', subdomain);
  }
}

/**
 * XYZ瓦片数据源
 */
export class XYZDataSource extends DataSource {
  constructor(config: DataSourceConfig) {
    super(config);
  }

  getUrl(tileKey: TileKey): string {
    return this.replaceUrlPlaceholders(this._urlTemplate, tileKey);
  }
}

/**
 * TMS瓦片数据源
 */
export class TMSDataSource extends DataSource {
  constructor(config: DataSourceConfig) {
    super(config);
  }

  getUrl(tileKey: TileKey): string {
    // TMS使用翻转的Y坐标
    const tmsY = Math.pow(2, tileKey.z) - 1 - tileKey.y;
    const tmsTileKey = { ...tileKey, y: tmsY };
    return this.replaceUrlPlaceholders(this._urlTemplate, tmsTileKey);
  }
}

/**
 * WMTS瓦片数据源
 */
export class WMTSDataSource extends DataSource {
  private _layer: string;
  private _style: string;
  private _matrixSet: string;

  constructor(
    config: DataSourceConfig & {
      layer: string;
      style?: string;
      matrixSet?: string;
    }
  ) {
    super(config);
    this._layer = config.layer;
    this._style = config.style ?? 'default';
    this._matrixSet = config.matrixSet ?? 'EPSG:3857';
  }

  getUrl(tileKey: TileKey): string {
    const baseUrl = this._urlTemplate;
    const params = new URLSearchParams({
      SERVICE: 'WMTS',
      REQUEST: 'GetTile',
      VERSION: '1.0.0',
      LAYER: this._layer,
      STYLE: this._style,
      TILEMATRIXSET: this._matrixSet,
      TILEMATRIX: tileKey.z.toString(),
      TILEROW: tileKey.y.toString(),
      TILECOL: tileKey.x.toString(),
      FORMAT: this._format,
    });

    return `${baseUrl}?${params.toString()}`;
  }
}

/**
 * 数据源工厂
 */
export class DataSourceFactory {
  /**
   * 创建数据源
   */
  static create(
    config: DataSourceConfig | (DataSourceConfig & { layer: string; style?: string; matrixSet?: string })
  ): DataSource {
    switch (config.type.toLowerCase()) {
      case 'xyz':
        return new XYZDataSource(config as DataSourceConfig);
      case 'tms':
        return new TMSDataSource(config as DataSourceConfig);
      case 'wmts':
        return new WMTSDataSource(config as DataSourceConfig & { layer: string; style?: string; matrixSet?: string });
      default:
        throw new Error(`Unsupported data source type: ${config.type}`);
    }
  }

  /**
   * 创建常用数据源
   */
  static createOpenStreetMap(): XYZDataSource {
    return new XYZDataSource({
      name: 'OpenStreetMap',
      type: 'xyz',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
      minZoom: 0,
      format: 'image/png',
      subdomains: ['a', 'b', 'c'],
    });
  }

  static createBingMaps(apiKey: string, imagerySet = 'Aerial'): XYZDataSource {
    return new XYZDataSource({
      name: 'Bing Maps',
      type: 'xyz',
      url: `https://dev.virtualearth.net/REST/v1/Imagery/Map/${imagerySet}/{z}/{x}/{y}?mapSize=256,256&key=${apiKey}`,
      attribution: '© Microsoft Corporation',
      maxZoom: 21,
      minZoom: 1,
      format: 'image/jpeg',
    });
  }

  static createMapboxSatellite(accessToken: string): XYZDataSource {
    return new XYZDataSource({
      name: 'Mapbox Satellite',
      type: 'xyz',
      url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg?access_token=${accessToken}`,
      attribution: '© Mapbox © OpenStreetMap',
      maxZoom: 22,
      minZoom: 0,
      format: 'image/jpeg',
    });
  }

  static createTerrainRGB(accessToken: string): XYZDataSource {
    return new XYZDataSource({
      name: 'Mapbox Terrain RGB',
      type: 'xyz',
      url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${accessToken}`,
      attribution: '© Mapbox',
      maxZoom: 15,
      minZoom: 0,
      format: 'image/png',
    });
  }

  static createNightLights(): XYZDataSource {
    return new XYZDataSource({
      name: 'Night Lights',
      type: 'xyz',
      url: '/assets/night-lights/{z}/{x}/{y}.png', // 本地夜间灯光数据
      attribution: 'Night Lights Data',
      maxZoom: 8,
      minZoom: 0,
      format: 'image/png',
    });
  }

  static createArcGISSatellite(): XYZDataSource {
    return new XYZDataSource({
      name: 'ArcGIS World Imagery',
      type: 'xyz',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxZoom: 19,
      minZoom: 0,
      format: 'image/jpeg',
    });
  }
}
