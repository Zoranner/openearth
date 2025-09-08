/**
 * 瓦片LOD选择器
 * 基于相机与地心距离映射到缩放级别，并在该缩放下计算视域附近应加载的瓦片集合
 */

import { Vector3 } from '@babylonjs/core';
import type { TileKey } from '../types';
import { CoordinateUtils, MathUtils } from '../utils/MathUtils';

export interface TileLodSelectorConfig {
  /** 允许的最小/最大缩放级别（受数据源限制，最终还需与数据源取交集） */
  minZoom?: number;
  maxZoom?: number;
  /** 预加载的同心环数量（以瓦片为单位的曼哈顿半径） */
  preloadRings?: number;
  /** 地球标准化半径（与渲染一致，Globe 中地球半径为1） */
  normalizedEarthRadius?: number;
  /** 将相机半径映射到zoom的函数参数：zoom = base - log2(r / k) */
  zoomBase?: number;
  zoomScaleK?: number;
}

export interface VisibleTilesResult {
  zoom: number;
  centerTile: { x: number; y: number };
  tiles: TileKey[];
}

export class TileLodSelector {
  private _config: Required<TileLodSelectorConfig>;

  constructor(config: TileLodSelectorConfig = {}) {
    this._config = {
      minZoom: config.minZoom ?? 0,
      maxZoom: config.maxZoom ?? 18,
      preloadRings: config.preloadRings ?? 2,
      normalizedEarthRadius: config.normalizedEarthRadius ?? 1.0,
      zoomBase: config.zoomBase ?? 20,
      zoomScaleK: config.zoomScaleK ?? 1.0,
    };
  }

  /**
   * 依据相机世界坐标（Babylon ArcRotateCamera 的 position 是世界坐标，地球位于原点）挑选可见瓦片
   */
  public selectVisible(cameraPosition: Vector3, source = 'arcgis', layer = 'base'): VisibleTilesResult {
    const radius = cameraPosition.length();
    const zoomFloat = this._config.zoomBase - Math.log2(Math.max(radius, 1e-3) / this._config.zoomScaleK);
    const zoom = MathUtils.clamp(Math.floor(zoomFloat), this._config.minZoom, this._config.maxZoom);

    const centerLonLat = CoordinateUtils.cartesianToLonLat(cameraPosition.scale(this._toMetersScale()));
    const centerTile = this._lonLatToTile(centerLonLat.longitude, centerLonLat.latitude, zoom);

    const tiles: TileKey[] = [];
    const rings = this._config.preloadRings;
    const maxIndex = Math.pow(2, zoom) - 1;
    for (let dy = -rings; dy <= rings; dy++) {
      for (let dx = -rings; dx <= rings; dx++) {
        const x = centerTile.x + dx;
        const y = centerTile.y + dy;
        if (x < 0 || y < 0 || x > maxIndex || y > maxIndex) continue;
        tiles.push({ x, y, z: zoom, source, layer });
      }
    }

    return { zoom, centerTile, tiles };
  }

  /**
   * 归一化球半径到真实米制球半径的比例（CoordinateUtils 假设地球半径为 6378137m）。
   * 我们渲染中地球半径为 normalizedEarthRadius（通常为1），所以将世界坐标缩放到米制坐标。
   */
  private _toMetersScale(): number {
    // Babylon 场景里: 地球半径 = normalizedEarthRadius，对应真实 6378137m
    // position(单位:场景单位) * (6378137 / normalizedEarthRadius) => 米
    const EARTH_RADIUS_METERS = 6378137;
    return EARTH_RADIUS_METERS / this._config.normalizedEarthRadius;
  }

  /**
   * 经纬度转 WebMercator 瓦片坐标
   * 与标准 XYZ 切片规格一致
   */
  private _lonLatToTile(longitude: number, latitude: number, zoom: number): { x: number; y: number } {
    const latRad = MathUtils.degToRad(latitude);
    const n = Math.pow(2, zoom);
    const x = Math.floor(((longitude + 180) / 360) * n);
    const y = Math.floor(
      (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
    );
    return { x, y };
  }
}


