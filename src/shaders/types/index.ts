/**
 * Shader相关的TypeScript类型定义
 */

export interface ShaderUniforms {
  [key: string]: any;
}

export interface EarthGridUniforms extends ShaderUniforms {
  baseColor: [number, number, number];
  gridColor: [number, number, number];
  zeroLineColor: [number, number, number];
  gridOpacity: number;
  lineWidth: number;
}

export interface ShaderMaterialConfig {
  uniforms: ShaderUniforms;
  vertexShader: string;
  fragmentShader: string;
  transparent?: boolean;
  depthWrite?: boolean;
  depthTest?: boolean;
}

export interface GridShaderConfig {
  baseColor?: [number, number, number];
  gridColor?: [number, number, number];
  zeroLineColor?: [number, number, number];
  gridOpacity?: number;
  lineWidth?: number;
}
