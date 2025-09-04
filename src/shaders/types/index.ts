/**
 * Shader相关的TypeScript类型定义
 */

export interface ShaderUniforms {
  [key: string]: any;
}

export interface EarthGridUniforms extends ShaderUniforms {
  baseColor: [number, number, number];
  gridColor: [number, number, number];
  gridOpacity: number;
  majorLineWidth: number;
  minorLineWidth: number;
  fadeDistance: number;
  maxViewDistance: number;
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
  gridOpacity?: number;
  majorLineWidth?: number;
  minorLineWidth?: number;
  fadeDistance?: number;
  maxViewDistance?: number;
}
