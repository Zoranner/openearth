/**
 * 通用类型定义
 */

import { Vector3 } from '@babylonjs/core';

// 基础几何类型
export interface TileKey {
  x: number;
  y: number;
  z: number;
  source: string;
  layer: string;
}

export interface TileBounds {
  west: number;
  east: number;
  south: number;
  north: number;
  level: number;
}

export interface TileCoordinate {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// 相机相关类型
export interface CameraPosition {
  longitude: number;
  latitude: number;
  altitude: number;
  heading: number;
  pitch: number;
  roll: number;
}

// 统计信息类型
export interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
}

export interface TextureStats {
  textureCount: number;
  maxTextureCount: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
}

export interface PoolStats {
  availableCount: number;
  usedCount: number;
  maxPoolSize: number;
  utilizationRate: number;
}

// 枚举类型
export enum TaskPriority {
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
  LOW = 'LOW',
}

export enum AnimationType {
  FLY_TO = 'FLY_TO',
  ROTATION = 'ROTATION',
  ZOOM = 'ZOOM',
}

export enum Season {
  SPRING = 'SPRING',
  SUMMER = 'SUMMER',
  AUTUMN = 'AUTUMN',
  WINTER = 'WINTER',
}

// 太阳系统相关类型
export interface SunPosition {
  direction: Vector3;
  distance: number;
}

export interface AtmosphericConditions {
  cloudCover: number;
  humidity: number;
  pollution: number;
}

export interface SeasonalFactors {
  season: Season;
  northernHemisphere: boolean;
}

// 工具函数
export class TileKeyUtils {
  static equals(a: TileKey, b: TileKey): boolean {
    return a.x === b.x && a.y === b.y && a.z === b.z && a.source === b.source && a.layer === b.layer;
  }

  static toString(key: TileKey): string {
    return `${key.source}:${key.layer}:${key.z}:${key.x}:${key.y}`;
  }

  static getParent(key: TileKey): TileKey {
    return {
      ...key,
      x: Math.floor(key.x / 2),
      y: Math.floor(key.y / 2),
      z: key.z - 1,
    };
  }

  static getChildren(key: TileKey): TileKey[] {
    const children: TileKey[] = [];
    for (let dx = 0; dx < 2; dx++) {
      for (let dy = 0; dy < 2; dy++) {
        children.push({
          ...key,
          x: key.x * 2 + dx,
          y: key.y * 2 + dy,
          z: key.z + 1,
        });
      }
    }
    return children;
  }
}

export class BoundingBoxUtils {
  static contains(box: BoundingBox, x: number, y: number): boolean {
    return x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
  }

  static intersects(a: BoundingBox, b: BoundingBox): boolean {
    return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
  }
}

export class CameraPositionUtils {
  static toVector3(position: CameraPosition): Vector3 {
    const phi = ((90 - position.latitude) * Math.PI) / 180;
    const theta = (position.longitude * Math.PI) / 180;
    const radius = position.altitude;

    return new Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  static fromVector3(vector: Vector3): CameraPosition {
    const radius = vector.length();
    const phi = Math.acos(vector.y / radius);
    const theta = Math.atan2(vector.z, vector.x);

    return {
      longitude: (theta * 180) / Math.PI,
      latitude: 90 - (phi * 180) / Math.PI,
      altitude: radius,
      heading: 0,
      pitch: 0,
      roll: 0,
    };
  }

  static clone(position: CameraPosition): CameraPosition {
    return { ...position };
  }

  static equals(a: CameraPosition, b: CameraPosition): boolean {
    return (
      a.longitude === b.longitude &&
      a.latitude === b.latitude &&
      a.altitude === b.altitude &&
      a.heading === b.heading &&
      a.pitch === b.pitch &&
      a.roll === b.roll
    );
  }
}
