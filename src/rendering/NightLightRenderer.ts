/**
 * 夜间灯光渲染模块
 * 负责渲染地球表面的城市灯光效果
 */

import {
  ShaderMaterial,
  Texture,
  Color3,
  SphereBuilder,
  Effect,
  type Scene,
  type Mesh,
  type Vector3,
} from '@babylonjs/core';

import { logger } from '../utils/Logger';

export interface NightLightOptions {
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
 * 夜间灯光渲染器
 */
export class NightLightRenderer {
  private _scene: Scene;
  private _earthRadius: number;
  private _nightLightMesh: Mesh | null = null;
  private _nightLightMaterial: ShaderMaterial | null = null;
  private _nightTexture: Texture | null = null;
  private _intensity: number;
  private _brightness: number;
  private _cityLightColor: Color3;
  private _fadeDistance: number;
  private _minLightThreshold: number;
  private _maxLightThreshold: number;
  private _maxDisplayDistance: number;
  private _minDisplayDistance: number;
  private _enableDistanceControl: boolean;
  private _isInitialized: boolean;

  constructor(scene: Scene, earthRadius: number, options: NightLightOptions = {}) {
    this._scene = scene;
    this._earthRadius = earthRadius;
    this._intensity = options.intensity ?? 1.0;
    this._brightness = options.brightness ?? 0.8;
    this._cityLightColor = options.cityLightColor ?? new Color3(1.0, 0.9, 0.6);
    this._fadeDistance = options.fadeDistance ?? 0.1;
    this._minLightThreshold = options.minLightThreshold ?? 0.1;
    this._maxLightThreshold = options.maxLightThreshold ?? 0.9;
    this._maxDisplayDistance = options.maxDisplayDistance ?? 2.0;
    this._minDisplayDistance = options.minDisplayDistance ?? 1.2;
    this._enableDistanceControl = options.enableDistanceControl !== false;
    this._isInitialized = false;

    logger.debug('NightLightRenderer created', 'NightLightRenderer', {
      earthRadius,
      intensity: this._intensity,
      brightness: this._brightness,
    });
  }

  /**
   * 初始化夜间灯光渲染器
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) {
      logger.warn('NightLightRenderer already initialized', 'NightLightRenderer');
      return;
    }

    try {
      // 注册夜间灯光着色器
      this._registerNightLightShader();

      // 创建夜间灯光网格
      this._createNightLightMesh();

      // 创建夜间灯光材质
      this._createNightLightMaterial();

      // 加载夜间纹理
      await this._loadNightTexture();

      this._isInitialized = true;
      logger.info('NightLightRenderer initialized successfully', 'NightLightRenderer');
    } catch (error) {
      logger.error('Failed to initialize NightLightRenderer', 'NightLightRenderer', error);
      throw error;
    }
  }

  /**
   * 销毁夜间灯光渲染器
   */
  dispose(): void {
    if (!this._isInitialized) {
      return;
    }

    if (this._nightLightMesh) {
      this._nightLightMesh.dispose();
      this._nightLightMesh = null;
    }

    if (this._nightLightMaterial) {
      this._nightLightMaterial.dispose();
      this._nightLightMaterial = null;
    }

    if (this._nightTexture) {
      this._nightTexture.dispose();
      this._nightTexture = null;
    }

    this._isInitialized = false;
    logger.info('NightLightRenderer disposed', 'NightLightRenderer');
  }

  /**
   * 更新夜间灯光渲染器
   */
  update(cameraPosition: Vector3, sunDirection: Vector3): void {
    if (!this._isInitialized || !this._nightLightMesh || !this._nightLightMaterial) {
      return;
    }

    // 计算相机距离
    const cameraDistance = cameraPosition.length() / this._earthRadius;

    // 距离控制
    let distanceFactor = 1.0;
    if (this._enableDistanceControl) {
      if (cameraDistance < this._minDisplayDistance) {
        distanceFactor = 0.0;
      } else if (cameraDistance > this._maxDisplayDistance) {
        distanceFactor = 1.0;
      } else {
        distanceFactor =
          (cameraDistance - this._minDisplayDistance) / (this._maxDisplayDistance - this._minDisplayDistance);
      }
    }

    // 计算昼夜因子
    const nightFactor = this._calculateNightFactor(sunDirection);

    // 最终可见性
    const finalVisibility = nightFactor * distanceFactor;

    // 更新网格可见性
    this._nightLightMesh.setEnabled(finalVisibility > 0.01);

    if (finalVisibility > 0.01) {
      // 更新着色器uniforms
      this._updateShaderUniforms(cameraPosition, sunDirection, finalVisibility);
    }
  }

  /**
   * 时间变化回调
   */
  onTimeChanged(time: Date): void {
    logger.debug('Night light time changed', 'NightLightRenderer', { time: time.toISOString() });
  }

  /**
   * 设置强度
   */
  setIntensity(intensity: number): void {
    this._intensity = Math.max(0, Math.min(2, intensity));
    logger.debug('Night light intensity updated', 'NightLightRenderer', { intensity: this._intensity });
  }

  /**
   * 设置亮度
   */
  setBrightness(brightness: number): void {
    this._brightness = Math.max(0, Math.min(2, brightness));
    logger.debug('Night light brightness updated', 'NightLightRenderer', { brightness: this._brightness });
  }

  /**
   * 设置城市灯光颜色
   */
  setCityLightColor(color: Color3): void {
    this._cityLightColor = color;
    logger.debug('City light color updated', 'NightLightRenderer', { color });
  }

  /**
   * 设置灯光阈值
   */
  setLightThresholds(min: number, max: number): void {
    this._minLightThreshold = Math.max(0, Math.min(1, min));
    this._maxLightThreshold = Math.max(this._minLightThreshold, Math.min(1, max));

    logger.debug('Light thresholds updated', 'NightLightRenderer', {
      min: this._minLightThreshold,
      max: this._maxLightThreshold,
    });
  }

  /**
   * 设置距离控制
   */
  setDistanceControl(minDistance: number, maxDistance: number): void {
    this._minDisplayDistance = Math.max(1.0, minDistance);
    this._maxDisplayDistance = Math.max(this._minDisplayDistance, maxDistance);

    logger.debug('Distance control updated', 'NightLightRenderer', {
      min: this._minDisplayDistance,
      max: this._maxDisplayDistance,
    });
  }

  /**
   * 设置距离控制启用状态
   */
  setDistanceControlEnabled(enabled: boolean): void {
    this._enableDistanceControl = enabled;
    logger.debug('Distance control enabled state changed', 'NightLightRenderer', { enabled });
  }

  /**
   * 获取强度
   */
  getIntensity(): number {
    return this._intensity;
  }

  /**
   * 获取亮度
   */
  getBrightness(): number {
    return this._brightness;
  }

  /**
   * 获取距离控制启用状态
   */
  getDistanceControlEnabled(): boolean {
    return this._enableDistanceControl;
  }

  /**
   * 注册夜间灯光着色器
   */
  private _registerNightLightShader(): void {
    const vertexShader = `
      precision highp float;

      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 uv;

      uniform mat4 worldViewProjection;
      uniform mat4 world;
      uniform vec3 cameraPosition;
      uniform vec3 sunDirection;
      uniform float earthRadius;

      varying vec2 vUV;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying float vSunDot;
      varying float vViewAngle;

      void main() {
        vec4 worldPosition = world * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vNormal = normalize((world * vec4(normal, 0.0)).xyz);
        vViewDirection = normalize(cameraPosition - vWorldPosition);
        vUV = uv;

        // 计算太阳方向点积
        vSunDot = dot(vNormal, normalize(sunDirection));

        // 计算视角
        vViewAngle = dot(vNormal, vViewDirection);

        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;

      uniform sampler2D nightTexture;
      uniform vec3 sunDirection;
      uniform float nightFactor;
      uniform float intensity;
      uniform float brightness;
      uniform vec3 cityLightColor;
      uniform float fadeDistance;
      uniform float minLightThreshold;
      uniform float maxLightThreshold;
      uniform float visibility;

      varying vec2 vUV;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying float vSunDot;
      varying float vViewAngle;

      void main() {
        // 采样夜间纹理
        vec4 nightColor = texture2D(nightTexture, vUV);
        float lightIntensity = nightColor.r; // 使用红色通道作为灯光强度

        // 应用灯光阈值
        lightIntensity = smoothstep(minLightThreshold, maxLightThreshold, lightIntensity);

        // 计算夜间强度（基于太阳角度）
        float nightStrength = max(0.0, -vSunDot) * nightFactor;

        // 应用大气透视效果
        float atmosphericPerspective = pow(max(0.0, vViewAngle), fadeDistance);

        // 混合城市灯光颜色
        vec3 finalColor = cityLightColor * lightIntensity * nightStrength *
                         intensity * brightness * atmosphericPerspective;

        // 添加光晕效果
        float glow = pow(lightIntensity, 0.5) * nightStrength * 0.3;
        finalColor += vec3(glow * 0.8, glow * 0.6, glow * 0.4);

        // 应用可见性
        float alpha = lightIntensity * nightStrength * visibility;

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    Effect.ShadersStore['nightLightVertexShader'] = vertexShader;
    Effect.ShadersStore['nightLightFragmentShader'] = fragmentShader;

    logger.debug('Night light shader registered', 'NightLightRenderer');
  }

  /**
   * 创建夜间灯光网格
   */
  private _createNightLightMesh(): void {
    if (this._nightLightMesh) {
      this._nightLightMesh.dispose();
    }

    // 创建稍大于地球的球体
    this._nightLightMesh = SphereBuilder.CreateSphere(
      'nightLight',
      {
        diameter: this._earthRadius * 2.001, // 稍微大一点避免z-fighting
        segments: 64,
      },
      this._scene
    );

    // 设置渲染顺序
    this._nightLightMesh.renderingGroupId = 2; // 在大气之后渲染
    this._nightLightMesh.hasVertexAlpha = true;

    logger.debug('Night light mesh created', 'NightLightRenderer');
  }

  /**
   * 创建夜间灯光材质
   */
  private _createNightLightMaterial(): void {
    if (this._nightLightMaterial) {
      this._nightLightMaterial.dispose();
    }

    this._nightLightMaterial = new ShaderMaterial('nightLightMaterial', this._scene, 'nightLight', {
      attributes: ['position', 'normal', 'uv'],
      uniforms: [
        'worldViewProjection',
        'world',
        'cameraPosition',
        'sunDirection',
        'nightFactor',
        'intensity',
        'brightness',
        'cityLightColor',
        'fadeDistance',
        'minLightThreshold',
        'maxLightThreshold',
        'visibility',
        'earthRadius',
      ],
      samplers: ['nightTexture'],
    });

    // 设置混合模式
    this._nightLightMaterial.alphaMode = 2; // ALPHA_ADD
    this._nightLightMaterial.backFaceCulling = false;

    if (this._nightLightMesh) {
      this._nightLightMesh.material = this._nightLightMaterial;
    }

    logger.debug('Night light material created', 'NightLightRenderer');
  }

  /**
   * 加载夜间纹理
   */
  private async _loadNightTexture(): Promise<void> {
    try {
      // 尝试从assets目录加载夜间纹理
      this._nightTexture = new Texture('/assets/night.png', this._scene, true, false);

      // 等待纹理加载完成
      await new Promise<void>((resolve, reject) => {
        if (this._nightTexture) {
          this._nightTexture.onLoadObservable.addOnce(() => {
            logger.debug('Night texture loaded successfully', 'NightLightRenderer');
            resolve();
          });

          // 使用简单的超时作为错误处理
          setTimeout(() => {
            if (!this._nightTexture?.isReady()) {
              logger.warn('Night texture loading timeout, creating fallback', 'NightLightRenderer');
              this._createFallbackTexture();
              resolve();
            }
          }, 5000);
        } else {
          reject(new Error('Failed to create night texture'));
        }
      });

      if (this._nightLightMaterial && this._nightTexture) {
        this._nightLightMaterial.setTexture('nightTexture', this._nightTexture);
      }
    } catch (error) {
      logger.warn('Error loading night texture, creating fallback', 'NightLightRenderer', error);
      this._createFallbackTexture();
    }
  }

  /**
   * 创建备用纹理
   */
  private _createFallbackTexture(): void {
    if (this._nightTexture) {
      this._nightTexture.dispose();
    }

    // 创建程序化生成的夜间纹理
    const size = 512;
    const data = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = (y * size + x) * 4;

        // 简单的城市灯光分布模拟
        const lat = (y / size) * 180 - 90;

        // 在陆地区域添加一些随机的城市灯光
        let lightIntensity = 0;
        if (Math.abs(lat) < 60) {
          // 主要在温带地区
          const noise = Math.random();
          if (noise > 0.85) {
            // 15%的概率有灯光
            lightIntensity = Math.floor(noise * 255);
          }
        }

        data[index] = lightIntensity; // R
        data[index + 1] = lightIntensity; // G
        data[index + 2] = lightIntensity; // B
        data[index + 3] = 255; // A
      }
    }

    // 创建RawTexture作为替代
    import('@babylonjs/core')
      .then(({ RawTexture }) => {
        this._nightTexture = RawTexture.CreateRGBATexture(data, size, size, this._scene);

        if (this._nightLightMaterial && this._nightTexture) {
          this._nightLightMaterial.setTexture('nightTexture', this._nightTexture);
        }
      })
      .catch(() => {
        logger.error('Failed to create fallback night texture', 'NightLightRenderer');
      });

    logger.debug('Fallback night texture created', 'NightLightRenderer');
  }

  /**
   * 计算夜间因子
   */
  private _calculateNightFactor(sunDirection: Vector3): number {
    // 基于太阳高度角计算夜间因子
    const sunElevation = Math.asin(sunDirection.y);
    const sunElevationDegrees = (sunElevation * 180) / Math.PI;

    // 当太阳在地平线以下时显示夜间灯光
    if (sunElevationDegrees < -6) {
      return 1.0; // 完全夜间
    } else if (sunElevationDegrees > 6) {
      return 0.0; // 完全白天
    } else {
      // 黄昏/黎明过渡
      return (6 - sunElevationDegrees) / 12;
    }
  }

  /**
   * 更新着色器uniforms
   */
  private _updateShaderUniforms(cameraPosition: Vector3, sunDirection: Vector3, visibility: number): void {
    if (!this._nightLightMaterial) return;

    const nightFactor = this._calculateNightFactor(sunDirection);

    this._nightLightMaterial.setVector3('cameraPosition', cameraPosition);
    this._nightLightMaterial.setVector3('sunDirection', sunDirection);
    this._nightLightMaterial.setFloat('nightFactor', nightFactor);
    this._nightLightMaterial.setFloat('intensity', this._intensity);
    this._nightLightMaterial.setFloat('brightness', this._brightness);
    this._nightLightMaterial.setColor3('cityLightColor', this._cityLightColor);
    this._nightLightMaterial.setFloat('fadeDistance', this._fadeDistance);
    this._nightLightMaterial.setFloat('minLightThreshold', this._minLightThreshold);
    this._nightLightMaterial.setFloat('maxLightThreshold', this._maxLightThreshold);
    this._nightLightMaterial.setFloat('visibility', visibility);
    this._nightLightMaterial.setFloat('earthRadius', this._earthRadius);
  }

  /**
   * 获取系统状态
   */
  getStatus(): {
    isInitialized: boolean;
    intensity: number;
    brightness: number;
    enableDistanceControl: boolean;
  } {
    return {
      isInitialized: this._isInitialized,
      intensity: this._intensity,
      brightness: this._brightness,
      enableDistanceControl: this._enableDistanceControl,
    };
  }
}
