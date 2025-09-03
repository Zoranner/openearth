/**
 * 太阳系统模块
 * 负责计算太阳位置和光照强度
 */

import { Vector3 } from '@babylonjs/core';
import { Season, type SunPosition, type AtmosphericConditions, type SeasonalFactors } from '../types';
import { MathUtils } from '../utils/MathUtils';
import { logger } from '../utils/Logger';

export interface SunSystemConfig {
  lightIntensity?: LightIntensityConfig;
  atmosphericConditions?: AtmosphericConditions;
  seasonalFactors?: SeasonalFactors;
}

export interface LightIntensityConfig {
  baseIntensity?: number;
  maxIntensity?: number;
  minIntensity?: number;
  enableAtmosphericAttenuation?: boolean;
  enableSeasonalVariation?: boolean;
  enableWeatherEffects?: boolean;
}

/**
 * 太阳位置计算器
 */
class SunPositionCalculator {
  /**
   * 计算太阳位置
   */
  calculateSunPosition(time: Date): SunPosition {
    const direction = this.calculateSunDirection(time);
    const distance = 149597870.7; // 日地平均距离（公里）

    return {
      direction,
      distance,
    };
  }

  /**
   * 计算太阳方向
   */
  calculateSunDirection(time: Date): Vector3 {
    const astronomicalCalculator = new AstronomicalCalculator();
    const julianDay = astronomicalCalculator.calculateJulianDay(time);

    return astronomicalCalculator.calculateSunPosition(julianDay);
  }
}

/**
 * 光照强度计算器
 */
class LightIntensityCalculator {
  private _baseIntensity: number;
  private _maxIntensity: number;
  private _minIntensity: number;
  private _enableAtmosphericAttenuation: boolean;
  private _enableSeasonalVariation: boolean;
  private _enableWeatherEffects: boolean;
  private _atmosphericConditions: AtmosphericConditions;
  private _seasonalFactors: SeasonalFactors;

  constructor(config: LightIntensityConfig) {
    this._baseIntensity = config.baseIntensity ?? 1.0;
    this._maxIntensity = config.maxIntensity ?? 1.2;
    this._minIntensity = config.minIntensity ?? 0.8;
    this._enableAtmosphericAttenuation = config.enableAtmosphericAttenuation !== false;
    this._enableSeasonalVariation = config.enableSeasonalVariation !== false;
    this._enableWeatherEffects = config.enableWeatherEffects !== false;

    this._atmosphericConditions = {
      cloudCover: 0.0,
      humidity: 0.5,
      pollution: 0.0,
    };

    this._seasonalFactors = {
      season: Season.SPRING,
      northernHemisphere: true,
    };
  }

  /**
   * 计算光照强度
   */
  calculateIntensity(): number {
    let intensity = this._baseIntensity;

    // 季节变化
    if (this._enableSeasonalVariation) {
      intensity *= this._calculateSeasonalFactor();
    }

    // 大气衰减
    if (this._enableAtmosphericAttenuation) {
      intensity *= this._calculateAtmosphericAttenuation();
    }

    // 天气效果
    if (this._enableWeatherEffects) {
      intensity *= this._calculateWeatherFactor();
    }

    return MathUtils.clamp(intensity, this._minIntensity, this._maxIntensity);
  }

  /**
   * 计算色温
   */
  calculateColorTemperature(): number {
    // 基础色温：5778K（太阳表面温度）
    let colorTemp = 5778;

    // 大气散射影响色温
    if (this._enableAtmosphericAttenuation) {
      const scatteringFactor = this._atmosphericConditions.humidity * 0.1 + this._atmosphericConditions.pollution * 0.2;
      colorTemp -= scatteringFactor * 500; // 散射使色温偏暖
    }

    return MathUtils.clamp(colorTemp, 4000, 7000);
  }

  /**
   * 计算太阳颜色
   */
  calculateSunColor(): Vector3 {
    const colorTemp = this.calculateColorTemperature();

    // 简化的色温到RGB转换
    let r, g, b;

    if (colorTemp < 5000) {
      // 偏暖色调
      r = 1.0;
      g = 0.8 + (colorTemp - 4000) * 0.0002;
      b = 0.6 + (colorTemp - 4000) * 0.0004;
    } else {
      // 偏冷色调
      r = 1.0 - (colorTemp - 5000) * 0.0001;
      g = 0.9 + (colorTemp - 5000) * 0.00005;
      b = 1.0;
    }

    return new Vector3(MathUtils.clamp(r, 0, 1), MathUtils.clamp(g, 0, 1), MathUtils.clamp(b, 0, 1));
  }

  /**
   * 更新大气条件
   */
  updateAtmosphericConditions(conditions: AtmosphericConditions): void {
    this._atmosphericConditions = { ...conditions };
  }

  /**
   * 更新季节因子
   */
  updateSeasonalFactors(factors: SeasonalFactors): void {
    this._seasonalFactors = { ...factors };
  }

  /**
   * 计算季节因子
   */
  private _calculateSeasonalFactor(): number {
    switch (this._seasonalFactors.season) {
      case Season.SUMMER:
        return this._seasonalFactors.northernHemisphere ? 1.1 : 0.9;
      case Season.WINTER:
        return this._seasonalFactors.northernHemisphere ? 0.9 : 1.1;
      case Season.SPRING:
      case Season.AUTUMN:
      default:
        return 1.0;
    }
  }

  /**
   * 计算大气衰减
   */
  private _calculateAtmosphericAttenuation(): number {
    const cloudAttenuation = 1.0 - this._atmosphericConditions.cloudCover * 0.3;
    const humidityAttenuation = 1.0 - this._atmosphericConditions.humidity * 0.1;
    const pollutionAttenuation = 1.0 - this._atmosphericConditions.pollution * 0.2;

    return cloudAttenuation * humidityAttenuation * pollutionAttenuation;
  }

  /**
   * 计算天气因子
   */
  private _calculateWeatherFactor(): number {
    // 简化的天气效果
    return 1.0 - this._atmosphericConditions.cloudCover * 0.4;
  }
}

/**
 * 天文计算器
 */
class AstronomicalCalculator {
  /**
   * 计算儒略日
   */
  calculateJulianDay(date: Date): number {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();

    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;

    let jd =
      day +
      Math.floor((153 * m + 2) / 5) +
      365 * y +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400) -
      32045;

    // 添加时间部分
    jd += (hour - 12) / 24 + minute / 1440 + second / 86400;

    return jd;
  }

  /**
   * 计算太阳赤纬角
   */
  calculateSolarDeclination(julianDay: number): number {
    const n = julianDay - 2451545.0; // 从J2000.0开始的天数
    const L = (280.46 + 0.9856474 * n) % 360; // 太阳平均黄经
    const g = MathUtils.degToRad((357.528 + 0.9856003 * n) % 360); // 太阳平均近点角
    const lambda = MathUtils.degToRad(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)); // 太阳真黄经

    const epsilon = MathUtils.degToRad(23.439 - 0.0000004 * n); // 黄赤交角

    return Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  }

  /**
   * 计算太阳位置
   */
  calculateSunPosition(julianDay: number): Vector3 {
    const n = julianDay - 2451545.0;
    const L = (280.46 + 0.9856474 * n) % 360;
    const g = MathUtils.degToRad((357.528 + 0.9856003 * n) % 360);
    const lambda = MathUtils.degToRad(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));

    const epsilon = MathUtils.degToRad(23.439 - 0.0000004 * n);

    // 计算太阳的赤道坐标
    const alpha = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda)); // 赤经
    const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambda)); // 赤纬

    // 转换为直角坐标系（从地球中心指向太阳）
    const x = Math.cos(delta) * Math.cos(alpha);
    const y = Math.sin(delta);
    const z = Math.cos(delta) * Math.sin(alpha);

    return new Vector3(x, y, z).normalize();
  }
}

/**
 * 太阳系统
 */
export class SunSystem {
  private _sunPosition: Vector3;
  private _sunDirection: Vector3;
  private _sunIntensity: number;
  private _sunColor: Vector3;
  private _isInitialized: boolean;
  private _config: Required<SunSystemConfig>;
  private _sunPositionCalculator: SunPositionCalculator;
  private _lightIntensityCalculator: LightIntensityCalculator;

  constructor(config: SunSystemConfig = {}) {
    this._config = {
      lightIntensity: {
        baseIntensity: 1.0,
        maxIntensity: 1.2,
        minIntensity: 0.8,
        enableAtmosphericAttenuation: true,
        enableSeasonalVariation: true,
        enableWeatherEffects: false,
        ...config.lightIntensity,
      },
      atmosphericConditions: {
        cloudCover: 0.0,
        humidity: 0.5,
        pollution: 0.0,
        ...config.atmosphericConditions,
      },
      seasonalFactors: {
        season: Season.SPRING,
        northernHemisphere: true,
        ...config.seasonalFactors,
      },
    };

    this._sunPosition = Vector3.Zero();
    this._sunDirection = new Vector3(1, 0.5, 0.3).normalize();
    this._sunIntensity = 1.0;
    this._sunColor = new Vector3(1.0, 0.95, 0.8);
    this._isInitialized = false;

    this._sunPositionCalculator = new SunPositionCalculator();
    this._lightIntensityCalculator = new LightIntensityCalculator(this._config.lightIntensity);

    // 应用初始配置
    this._lightIntensityCalculator.updateAtmosphericConditions(this._config.atmosphericConditions);
    this._lightIntensityCalculator.updateSeasonalFactors(this._config.seasonalFactors);

    logger.debug('SunSystem created', 'SunSystem', { config: this._config });
  }

  /**
   * 初始化太阳系统
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) {
      logger.warn('SunSystem already initialized', 'SunSystem');
      return;
    }

    try {
      // 计算初始太阳位置
      this.update(new Date());

      this._isInitialized = true;
      logger.info('SunSystem initialized successfully', 'SunSystem');
    } catch (error) {
      logger.error('Failed to initialize SunSystem', 'SunSystem', error);
      throw error;
    }
  }

  /**
   * 销毁太阳系统
   */
  dispose(): void {
    if (!this._isInitialized) {
      return;
    }

    this._isInitialized = false;
    logger.info('SunSystem disposed', 'SunSystem');
  }

  /**
   * 更新太阳系统
   */
  update(time: Date): void {
    if (!this._isInitialized) {
      return;
    }

    try {
      // 计算太阳位置
      const sunPosition = this._sunPositionCalculator.calculateSunPosition(time);
      this._sunPosition = sunPosition.direction.scale(sunPosition.distance);
      this._sunDirection = sunPosition.direction.normalize();

      // 计算光照强度
      this._sunIntensity = this._lightIntensityCalculator.calculateIntensity();

      // 计算太阳颜色
      this._sunColor = this._lightIntensityCalculator.calculateSunColor();

      logger.debug('Sun system updated', 'SunSystem', {
        time: time.toISOString(),
        direction: {
          x: this._sunDirection.x,
          y: this._sunDirection.y,
          z: this._sunDirection.z,
        },
        intensity: this._sunIntensity,
      });
    } catch (error) {
      logger.error('Failed to update SunSystem', 'SunSystem', error);
    }
  }

  /**
   * 获取太阳位置
   */
  getSunPosition(): Vector3 {
    return this._sunPosition.clone();
  }

  /**
   * 获取太阳方向
   */
  getSunDirection(): Vector3 {
    return this._sunDirection.clone();
  }

  /**
   * 获取太阳强度
   */
  getSunIntensity(): number {
    return this._sunIntensity;
  }

  /**
   * 获取太阳颜色
   */
  getSunColor(): Vector3 {
    return this._sunColor.clone();
  }

  /**
   * 设置大气条件
   */
  setAtmosphericConditions(conditions: AtmosphericConditions): void {
    this._config.atmosphericConditions = { ...conditions };
    this._lightIntensityCalculator.updateAtmosphericConditions(conditions);

    logger.debug('Atmospheric conditions updated', 'SunSystem', conditions);
  }

  /**
   * 设置季节因子
   */
  setSeasonalFactors(factors: SeasonalFactors): void {
    this._config.seasonalFactors = { ...factors };
    this._lightIntensityCalculator.updateSeasonalFactors(factors);

    logger.debug('Seasonal factors updated', 'SunSystem', factors);
  }

  /**
   * 获取配置
   */
  getConfig(): SunSystemConfig {
    return {
      lightIntensity: { ...this._config.lightIntensity },
      atmosphericConditions: { ...this._config.atmosphericConditions },
      seasonalFactors: { ...this._config.seasonalFactors },
    };
  }

  /**
   * 获取系统状态
   */
  getStatus(): {
    isInitialized: boolean;
    sunDirection: Vector3;
    sunIntensity: number;
    sunColor: Vector3;
  } {
    return {
      isInitialized: this._isInitialized,
      sunDirection: this._sunDirection.clone(),
      sunIntensity: this._sunIntensity,
      sunColor: this._sunColor.clone(),
    };
  }
}
