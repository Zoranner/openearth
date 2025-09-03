/**
 * 大气渲染模块
 * 负责渲染地球的大气层效果
 */

import {
  ShaderMaterial,
  StandardMaterial,
  Vector3,
  Color3,
  SphereBuilder,
  Effect,
  type Scene,
  type Mesh,
} from '@babylonjs/core';

import { logger } from '../utils/Logger';

export interface AtmosphereOptions {
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

export interface AtmosphereScatteringOptions {
  rayleighCoefficient?: Vector3;
  mieCoefficient?: number;
  sunIntensity?: number;
  scaleHeight?: number;
}

/**
 * 大气渲染器
 */
export class AtmosphereRenderer {
  private _scene: Scene;
  private _atmosphereMesh: Mesh | null = null;
  private _atmosphereMaterial: ShaderMaterial | null = null;
  private _glowMesh: Mesh | null = null;
  private _glowMaterial: StandardMaterial | null = null;
  private _planetRadius: number;
  private _atmosphereRadius: number;
  private _atmosphereHeight: number;
  private _sunDirection: Vector3;
  private _rayleighCoefficient: Vector3;
  private _mieCoefficient: number;
  private _sunIntensity: number;
  private _scaleHeight: number;
  private _mieScaleHeight: number;
  private _g: number;
  private _exposure: number;
  private _turbidity: number;
  private _isEnabled: boolean;
  private _isInitialized: boolean;

  constructor(scene: Scene, planetRadius: number, options: AtmosphereOptions = {}) {
    this._scene = scene;
    this._planetRadius = planetRadius;
    this._atmosphereHeight = options.atmosphereHeight ?? 100000;
    this._atmosphereRadius = this._planetRadius + this._atmosphereHeight;
    this._sunDirection = options.sunDirection ?? new Vector3(1, 0.5, 0.3);
    this._rayleighCoefficient = options.rayleighCoefficient ?? new Vector3(0.0058, 0.0135, 0.0331);
    this._mieCoefficient = options.mieCoefficient ?? 0.0021;
    this._sunIntensity = options.sunIntensity ?? 22.0;
    this._scaleHeight = options.scaleHeight ?? 8500;
    this._mieScaleHeight = options.mieScaleHeight ?? 1200;
    this._g = options.g ?? -0.758;
    this._exposure = options.exposure ?? 2.0;
    this._turbidity = options.turbidity ?? 2.0;
    this._isEnabled = true;
    this._isInitialized = false;

    logger.debug('AtmosphereRenderer created', 'AtmosphereRenderer', {
      planetRadius,
      atmosphereHeight: this._atmosphereHeight,
      atmosphereRadius: this._atmosphereRadius,
    });
  }

  /**
   * 初始化大气渲染器
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) {
      logger.warn('AtmosphereRenderer already initialized', 'AtmosphereRenderer');
      return;
    }

    try {
      // 注册大气散射着色器
      this._registerAtmosphereShader();

      // 创建大气网格
      this._createAtmosphereMesh();

      // 创建大气材质
      this._createAtmosphereMaterial();

      // 创建光晕效果
      this._createGlowEffect();

      this._isInitialized = true;
      logger.info('AtmosphereRenderer initialized successfully', 'AtmosphereRenderer');
    } catch (error) {
      logger.error('Failed to initialize AtmosphereRenderer', 'AtmosphereRenderer', error);
      throw error;
    }
  }

  /**
   * 销毁大气渲染器
   */
  dispose(): void {
    if (!this._isInitialized) {
      return;
    }

    if (this._atmosphereMesh) {
      this._atmosphereMesh.dispose();
      this._atmosphereMesh = null;
    }

    if (this._atmosphereMaterial) {
      this._atmosphereMaterial.dispose();
      this._atmosphereMaterial = null;
    }

    if (this._glowMesh) {
      this._glowMesh.dispose();
      this._glowMesh = null;
    }

    if (this._glowMaterial) {
      this._glowMaterial.dispose();
      this._glowMaterial = null;
    }

    this._isInitialized = false;
    logger.info('AtmosphereRenderer disposed', 'AtmosphereRenderer');
  }

  /**
   * 更新大气渲染器
   */
  update(cameraPosition: Vector3, sunDirection?: Vector3): void {
    if (!this._isInitialized || !this._isEnabled) {
      return;
    }

    if (sunDirection) {
      this._sunDirection = sunDirection.normalize();
    }

    // 更新着色器参数
    if (this._atmosphereMaterial) {
      this._updateShaderUniforms(cameraPosition);
    }

    // 更新光晕效果
    if (this._glowMaterial) {
      this._updateGlowEffect();
    }
  }

  /**
   * 时间变化回调
   */
  onTimeChanged(time: Date): void {
    // 大气渲染主要响应太阳方向变化，由update方法处理
    logger.debug('Atmosphere time changed', 'AtmosphereRenderer', { time: time.toISOString() });
  }

  /**
   * 设置启用状态
   */
  setEnabled(enabled: boolean): void {
    this._isEnabled = enabled;

    if (this._atmosphereMesh) {
      this._atmosphereMesh.setEnabled(enabled);
    }

    if (this._glowMesh) {
      this._glowMesh.setEnabled(enabled);
    }

    logger.debug('Atmosphere enabled state changed', 'AtmosphereRenderer', { enabled });
  }

  /**
   * 设置太阳方向
   */
  setSunDirection(direction: Vector3): void {
    this._sunDirection = direction.normalize();
    logger.debug('Sun direction updated', 'AtmosphereRenderer', { direction });
  }

  /**
   * 设置太阳强度
   */
  setSunIntensity(intensity: number): void {
    this._sunIntensity = intensity;
    logger.debug('Sun intensity updated', 'AtmosphereRenderer', { intensity });
  }

  /**
   * 设置大气层高度
   */
  setAtmosphereHeight(height: number): void {
    this._atmosphereHeight = height;
    this._atmosphereRadius = this._planetRadius + height;

    // 重新创建大气网格
    if (this._isInitialized) {
      this._createAtmosphereMesh();
    }

    logger.debug('Atmosphere height updated', 'AtmosphereRenderer', { height });
  }

  /**
   * 设置曝光度
   */
  setExposure(exposure: number): void {
    this._exposure = exposure;
    logger.debug('Exposure updated', 'AtmosphereRenderer', { exposure });
  }

  /**
   * 设置浑浊度
   */
  setTurbidity(turbidity: number): void {
    this._turbidity = turbidity;
    logger.debug('Turbidity updated', 'AtmosphereRenderer', { turbidity });
  }

  /**
   * 设置散射参数
   */
  setScatteringParameters(options: AtmosphereScatteringOptions): void {
    if (options.rayleighCoefficient) {
      this._rayleighCoefficient = options.rayleighCoefficient;
    }
    if (options.mieCoefficient !== undefined) {
      this._mieCoefficient = options.mieCoefficient;
    }
    if (options.sunIntensity !== undefined) {
      this._sunIntensity = options.sunIntensity;
    }
    if (options.scaleHeight !== undefined) {
      this._scaleHeight = options.scaleHeight;
    }

    logger.debug('Scattering parameters updated', 'AtmosphereRenderer', options);
  }

  /**
   * 设置光晕启用状态
   */
  setGlowEnabled(enabled: boolean): void {
    if (this._glowMesh) {
      this._glowMesh.setEnabled(enabled);
    }

    logger.debug('Glow enabled state changed', 'AtmosphereRenderer', { enabled });
  }

  /**
   * 获取大气网格
   */
  getAtmosphereMesh(): Mesh | null {
    return this._atmosphereMesh;
  }

  /**
   * 获取光晕网格
   */
  getGlowMesh(): Mesh | null {
    return this._glowMesh;
  }

  /**
   * 注册大气散射着色器
   */
  private _registerAtmosphereShader(): void {
    const vertexShader = `
      precision highp float;

      attribute vec3 position;
      attribute vec3 normal;

      uniform mat4 worldViewProjection;
      uniform mat4 world;
      uniform vec3 cameraPosition;
      uniform vec3 sunDirection;
      uniform float planetRadius;
      uniform float atmosphereRadius;

      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying vec3 vSunDirection;
      varying float vHeight;

      void main() {
        vec4 worldPosition = world * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vNormal = normalize((world * vec4(normal, 0.0)).xyz);
        vViewDirection = normalize(cameraPosition - vWorldPosition);
        vSunDirection = normalize(sunDirection);

        float distance = length(vWorldPosition);
        vHeight = (distance - planetRadius) / (atmosphereRadius - planetRadius);

        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;

      uniform vec3 sunDirection;
      uniform vec3 cameraPosition;
      uniform vec3 rayleighCoefficient;
      uniform float mieCoefficient;
      uniform float sunIntensity;
      uniform float scaleHeight;
      uniform float mieScaleHeight;
      uniform float g;
      uniform float exposure;
      uniform float turbidity;
      uniform float planetRadius;
      uniform float atmosphereRadius;

      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying vec3 vSunDirection;
      varying float vHeight;

      const float PI = 3.14159265359;
      const int SAMPLES = 16;

      // 瑞利相位函数
      float rayleighPhase(float cosTheta) {
        return 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
      }

      // 米相位函数 (Henyey-Greenstein)
      float miePhase(float cosTheta, float g) {
        float g2 = g * g;
        return 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + cosTheta * cosTheta)) /
               ((2.0 + g2) * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
      }

      // 计算光学深度
      float opticalDepth(vec3 start, vec3 end) {
        vec3 dir = normalize(end - start);
        float dist = length(end - start);
        float stepSize = dist / float(SAMPLES);

        float depth = 0.0;
        for (int i = 0; i < SAMPLES; i++) {
          vec3 pos = start + dir * stepSize * (float(i) + 0.5);
          float height = length(pos) - planetRadius;
          depth += exp(-height / scaleHeight) * stepSize;
        }

        return depth;
      }

      void main() {
        vec3 viewDir = normalize(vViewDirection);
        vec3 sunDir = normalize(vSunDirection);

        float cosTheta = dot(viewDir, sunDir);

        // 计算大气散射
        vec3 rayStart = cameraPosition;
        vec3 rayEnd = vWorldPosition;

        // 瑞利散射
        float rayleighOpticalDepth = opticalDepth(rayStart, rayEnd);
        vec3 rayleighScattering = rayleighCoefficient * rayleighPhase(cosTheta) *
                                 rayleighOpticalDepth * sunIntensity;

        // 米散射
        float mieOpticalDepth = rayleighOpticalDepth * 0.1; // 简化
        vec3 mieScattering = vec3(mieCoefficient) * miePhase(cosTheta, g) *
                            mieOpticalDepth * sunIntensity;

        // 总散射
        vec3 totalScattering = rayleighScattering + mieScattering;

        // 应用曝光
        totalScattering = 1.0 - exp(-totalScattering * exposure);

        // 大气光晕效果
        float glowFactor = pow(max(0.0, dot(vNormal, sunDir)), 2.0);
        vec3 glowColor = vec3(0.3, 0.6, 1.0) * glowFactor * 0.5;

        // 高度衰减
        float heightFactor = exp(-vHeight * 2.0);

        vec3 finalColor = totalScattering + glowColor;
        float alpha = heightFactor * 0.8;

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    Effect.ShadersStore['atmosphereVertexShader'] = vertexShader;
    Effect.ShadersStore['atmosphereFragmentShader'] = fragmentShader;

    logger.debug('Atmosphere shader registered', 'AtmosphereRenderer');
  }

  /**
   * 创建大气网格
   */
  private _createAtmosphereMesh(): void {
    if (this._atmosphereMesh) {
      this._atmosphereMesh.dispose();
    }

    this._atmosphereMesh = SphereBuilder.CreateSphere(
      'atmosphere',
      {
        diameter: this._atmosphereRadius * 2,
        segments: 64,
      },
      this._scene
    );

    // 设置渲染顺序（在地球之后渲染）
    this._atmosphereMesh.renderingGroupId = 1;
    this._atmosphereMesh.hasVertexAlpha = true;

    logger.debug('Atmosphere mesh created', 'AtmosphereRenderer', {
      radius: this._atmosphereRadius,
      segments: 64,
    });
  }

  /**
   * 创建大气材质
   */
  private _createAtmosphereMaterial(): void {
    if (this._atmosphereMaterial) {
      this._atmosphereMaterial.dispose();
    }

    this._atmosphereMaterial = new ShaderMaterial('atmosphereMaterial', this._scene, 'atmosphere', {
      attributes: ['position', 'normal'],
      uniforms: [
        'worldViewProjection',
        'world',
        'cameraPosition',
        'sunDirection',
        'rayleighCoefficient',
        'mieCoefficient',
        'sunIntensity',
        'scaleHeight',
        'mieScaleHeight',
        'g',
        'exposure',
        'turbidity',
        'planetRadius',
        'atmosphereRadius',
      ],
    });

    // 设置混合模式
    this._atmosphereMaterial.alphaMode = 2; // ALPHA_ADD
    this._atmosphereMaterial.backFaceCulling = false;

    if (this._atmosphereMesh) {
      this._atmosphereMesh.material = this._atmosphereMaterial;
    }

    logger.debug('Atmosphere material created', 'AtmosphereRenderer');
  }

  /**
   * 创建光晕效果
   */
  private _createGlowEffect(): void {
    if (this._glowMesh) {
      this._glowMesh.dispose();
    }

    if (this._glowMaterial) {
      this._glowMaterial.dispose();
    }

    // 创建稍大的球体作为光晕
    this._glowMesh = SphereBuilder.CreateSphere(
      'atmosphereGlow',
      {
        diameter: this._atmosphereRadius * 2.1,
        segments: 32,
      },
      this._scene
    );

    // 创建光晕材质
    this._glowMaterial = new StandardMaterial('atmosphereGlowMaterial', this._scene);
    this._glowMaterial.diffuseColor = new Color3(0.3, 0.6, 1.0);
    this._glowMaterial.emissiveColor = new Color3(0.1, 0.3, 0.6);
    this._glowMaterial.alpha = 0.3;
    this._glowMaterial.backFaceCulling = false;

    this._glowMesh.material = this._glowMaterial;
    this._glowMesh.renderingGroupId = 0; // 在大气之前渲染
    this._glowMesh.hasVertexAlpha = true;

    logger.debug('Atmosphere glow created', 'AtmosphereRenderer');
  }

  /**
   * 更新着色器uniforms
   */
  private _updateShaderUniforms(cameraPosition: Vector3): void {
    if (!this._atmosphereMaterial) return;

    this._atmosphereMaterial.setVector3('cameraPosition', cameraPosition);
    this._atmosphereMaterial.setVector3('sunDirection', this._sunDirection);
    this._atmosphereMaterial.setVector3('rayleighCoefficient', this._rayleighCoefficient);
    this._atmosphereMaterial.setFloat('mieCoefficient', this._mieCoefficient);
    this._atmosphereMaterial.setFloat('sunIntensity', this._sunIntensity);
    this._atmosphereMaterial.setFloat('scaleHeight', this._scaleHeight);
    this._atmosphereMaterial.setFloat('mieScaleHeight', this._mieScaleHeight);
    this._atmosphereMaterial.setFloat('g', this._g);
    this._atmosphereMaterial.setFloat('exposure', this._exposure);
    this._atmosphereMaterial.setFloat('turbidity', this._turbidity);
    this._atmosphereMaterial.setFloat('planetRadius', this._planetRadius);
    this._atmosphereMaterial.setFloat('atmosphereRadius', this._atmosphereRadius);
  }

  /**
   * 更新光晕效果
   */
  private _updateGlowEffect(): void {
    if (!this._glowMaterial) return;

    // 根据太阳角度调整光晕强度
    const sunAngle = Math.acos(Math.max(-1, Math.min(1, this._sunDirection.y)));
    const glowIntensity = Math.max(0.1, Math.sin(sunAngle));

    this._glowMaterial.alpha = glowIntensity * 0.3;
    this._glowMaterial.emissiveColor = new Color3(0.1 * glowIntensity, 0.3 * glowIntensity, 0.6 * glowIntensity);
  }

  /**
   * 获取系统状态
   */
  getStatus(): {
    isInitialized: boolean;
    isEnabled: boolean;
    atmosphereRadius: number;
    sunDirection: Vector3;
    sunIntensity: number;
  } {
    return {
      isInitialized: this._isInitialized,
      isEnabled: this._isEnabled,
      atmosphereRadius: this._atmosphereRadius,
      sunDirection: this._sunDirection.clone(),
      sunIntensity: this._sunIntensity,
    };
  }
}
