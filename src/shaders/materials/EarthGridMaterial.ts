/**
 * 地球网格材质
 * 使用自定义着色器实现程序化网格效果
 */

import { ShaderMaterial, Vector3, type Scene } from '@babylonjs/core';
import { ShaderUtils } from './ShaderUtils';
import type { GridShaderConfig, EarthGridUniforms } from '../types';
import { logger } from '../../utils/Logger';

// 导入着色器文件和配置
import { vertexShader, fragmentShader, earthGridShaderConfig, defaultEarthGridConfig } from './earthGrid';

export class EarthGridMaterial {
  private _material!: ShaderMaterial;
  private _scene: Scene;
  private _config: Required<GridShaderConfig>;

  constructor(scene: Scene, config: GridShaderConfig = {}) {
    this._scene = scene;
    this._config = {
      ...defaultEarthGridConfig,
      ...config,
    };

    this._createMaterial();

    logger.debug('EarthGridMaterial created', 'EarthGridMaterial', {
      config: this._config,
    });
  }

  /**
   * 创建着色器材质
   */
  private _createMaterial(): void {
    // 验证着色器代码
    if (!ShaderUtils.validateShader(vertexShader, 'vertex')) {
      throw new Error('Invalid vertex shader');
    }
    if (!ShaderUtils.validateShader(fragmentShader, 'fragment')) {
      throw new Error('Invalid fragment shader');
    }

    // 创建着色器材质
    const shaderId = ShaderUtils.generateShaderId(vertexShader, fragmentShader);
    this._material = new ShaderMaterial(
      `earthGridMaterial_${shaderId}`,
      this._scene,
      {
        vertexSource: vertexShader,
        fragmentSource: fragmentShader,
      },
      earthGridShaderConfig
    );

    // 设置uniform值
    this._updateUniforms();

    // 设置材质属性
    this._material.backFaceCulling = false;
    this._material.transparencyMode = null; // 不透明
  }

  /**
   * 更新uniform值
   */
  private _updateUniforms(): void {
    const uniforms: EarthGridUniforms = {
      baseColor: this._config.baseColor,
      gridColor: this._config.gridColor,
      zeroLineColor: this._config.zeroLineColor,
      gridOpacity: this._config.gridOpacity,
      lineWidth: this._config.lineWidth,
    };

    // 设置向量uniform
    this._material.setVector3('baseColor', new Vector3(...uniforms.baseColor));
    this._material.setVector3('gridColor', new Vector3(...uniforms.gridColor));
    this._material.setVector3('zeroLineColor', new Vector3(...uniforms.zeroLineColor));

    // 设置标量uniform
    this._material.setFloat('gridOpacity', uniforms.gridOpacity);
    this._material.setFloat('lineWidth', uniforms.lineWidth);
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<GridShaderConfig>): void {
    this._config = {
      ...this._config,
      ...newConfig,
    };

    this._updateUniforms();

    logger.debug('EarthGridMaterial config updated', 'EarthGridMaterial', {
      config: this._config,
    });
  }

  /**
   * 更新相机位置
   */
  public updateCameraPosition(cameraPosition: Vector3): void {
    this._material.setVector3('cameraPosition', cameraPosition);
  }

  /**
   * 获取Babylon.js材质
   */
  public getMaterial(): ShaderMaterial {
    return this._material;
  }

  /**
   * 销毁材质
   */
  public dispose(): void {
    if (this._material) {
      this._material.dispose();
    }
    logger.debug('EarthGridMaterial disposed', 'EarthGridMaterial');
  }
}
