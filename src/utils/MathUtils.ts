/**
 * 数学工具库
 * 提供3D向量计算、矩阵运算和坐标转换功能
 */

import { Vector3, Matrix } from '@babylonjs/core';

export class MathUtils {
  /**
   * 角度转弧度
   */
  static degToRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * 弧度转角度
   */
  static radToDeg(radians: number): number {
    return (radians * 180) / Math.PI;
  }

  /**
   * 限制值在指定范围内
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * 线性插值
   */
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * 平滑插值
   */
  static smoothstep(edge0: number, edge1: number, x: number): number {
    const t = this.clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
  }

  /**
   * 球面线性插值
   */
  static slerp(a: Vector3, b: Vector3, t: number): Vector3 {
    const dot = Vector3.Dot(a, b);
    const theta = Math.acos(Math.abs(dot)) * t;
    const relativeVec = b.subtract(a.scale(dot));
    relativeVec.normalize();

    return a.scale(Math.cos(theta)).add(relativeVec.scale(Math.sin(theta)));
  }

  /**
   * 计算两点间的距离
   */
  static distance(a: Vector3, b: Vector3): number {
    return Vector3.Distance(a, b);
  }

  /**
   * 计算两点间的平方距离（避免开方运算）
   */
  static distanceSquared(a: Vector3, b: Vector3): number {
    return Vector3.DistanceSquared(a, b);
  }

  /**
   * 计算向量的长度
   */
  static magnitude(v: Vector3): number {
    return v.length();
  }

  /**
   * 标准化向量
   */
  static normalize(v: Vector3): Vector3 {
    return v.normalize();
  }

  /**
   * 向量点积
   */
  static dot(a: Vector3, b: Vector3): number {
    return Vector3.Dot(a, b);
  }

  /**
   * 向量叉积
   */
  static cross(a: Vector3, b: Vector3): Vector3 {
    return Vector3.Cross(a, b);
  }

  /**
   * 计算反射向量
   */
  static reflect(incident: Vector3, normal: Vector3): Vector3 {
    return incident.subtract(normal.scale(2 * Vector3.Dot(incident, normal)));
  }

  /**
   * 计算折射向量
   */
  static refract(incident: Vector3, normal: Vector3, eta: number): Vector3 {
    const dot = Vector3.Dot(incident, normal);
    const k = 1.0 - eta * eta * (1.0 - dot * dot);
    if (k < 0.0) {
      return Vector3.Zero();
    }
    return incident.scale(eta).subtract(normal.scale(eta * dot + Math.sqrt(k)));
  }
}

/**
 * 坐标转换工具
 */
export class CoordinateUtils {
  private static readonly EARTH_RADIUS = 6378137; // 地球半径（米）

  /**
   * 经纬度转换为笛卡尔坐标
   */
  static lonLatToCartesian(longitude: number, latitude: number, altitude = 0): Vector3 {
    const phi = MathUtils.degToRad(90 - latitude);
    const theta = MathUtils.degToRad(longitude);
    const radius = this.EARTH_RADIUS + altitude;

    return new Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  /**
   * 笛卡尔坐标转换为经纬度
   */
  static cartesianToLonLat(position: Vector3): { longitude: number; latitude: number; altitude: number } {
    const radius = position.length();
    const phi = Math.acos(position.y / radius);
    const theta = Math.atan2(position.z, position.x);

    return {
      longitude: MathUtils.radToDeg(theta),
      latitude: 90 - MathUtils.radToDeg(phi),
      altitude: radius - this.EARTH_RADIUS,
    };
  }

  /**
   * Web墨卡托投影转换为经纬度
   */
  static webMercatorToLonLat(x: number, y: number): { longitude: number; latitude: number } {
    const longitude = (x / 20037508.34) * 180;
    let latitude = (y / 20037508.34) * 180;
    latitude = (180 / Math.PI) * (2 * Math.atan(Math.exp((latitude * Math.PI) / 180)) - Math.PI / 2);

    return { longitude, latitude };
  }

  /**
   * 经纬度转换为Web墨卡托投影
   */
  static lonLatToWebMercator(longitude: number, latitude: number): { x: number; y: number } {
    const x = (longitude * 20037508.34) / 180;
    let y = Math.log(Math.tan(((90 + latitude) * Math.PI) / 360)) / (Math.PI / 180);
    y = (y * 20037508.34) / 180;

    return { x, y };
  }

  /**
   * 计算两个经纬度点之间的距离（米）
   */
  static haversineDistance(lon1: number, lat1: number, lon2: number, lat2: number): number {
    const dLat = MathUtils.degToRad(lat2 - lat1);
    const dLon = MathUtils.degToRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(MathUtils.degToRad(lat1)) * Math.cos(MathUtils.degToRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS * c;
  }

  /**
   * 计算方位角
   */
  static bearing(lon1: number, lat1: number, lon2: number, lat2: number): number {
    const dLon = MathUtils.degToRad(lon2 - lon1);
    const lat1Rad = MathUtils.degToRad(lat1);
    const lat2Rad = MathUtils.degToRad(lat2);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    return MathUtils.radToDeg(Math.atan2(y, x));
  }
}

/**
 * 矩阵工具
 */
export class MatrixUtils {
  /**
   * 创建平移矩阵
   */
  static translation(x: number, y: number, z: number): Matrix {
    return Matrix.Translation(x, y, z);
  }

  /**
   * 创建旋转矩阵
   */
  static rotation(x: number, y: number, z: number): Matrix {
    return Matrix.RotationYawPitchRoll(y, x, z);
  }

  /**
   * 创建缩放矩阵
   */
  static scaling(x: number, y: number, z: number): Matrix {
    return Matrix.Scaling(x, y, z);
  }

  /**
   * 创建观察矩阵
   */
  static lookAt(eye: Vector3, target: Vector3, up: Vector3): Matrix {
    return Matrix.LookAtLH(eye, target, up);
  }

  /**
   * 创建透视投影矩阵
   */
  static perspective(fov: number, aspect: number, near: number, far: number): Matrix {
    return Matrix.PerspectiveFovLH(fov, aspect, near, far);
  }

  /**
   * 创建正交投影矩阵
   */
  static orthographic(width: number, height: number, near: number, far: number): Matrix {
    return Matrix.OrthoLH(width, height, near, far);
  }

  /**
   * 矩阵相乘
   */
  static multiply(a: Matrix, b: Matrix): Matrix {
    return a.multiply(b);
  }

  /**
   * 矩阵求逆
   */
  static invert(matrix: Matrix): Matrix {
    const result = new Matrix();
    matrix.invertToRef(result);
    return result;
  }

  /**
   * 矩阵转置
   */
  static transpose(matrix: Matrix): Matrix {
    const result = new Matrix();
    matrix.transposeToRef(result);
    return result;
  }
}
