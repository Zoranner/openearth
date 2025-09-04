/**
 * 地球网格着色器材质
 * 导出着色器代码和相关配置
 */

// 导入着色器文件
import vertexShader from './earthGrid.vertex.fx?raw';
import fragmentShader from './earthGrid.fragment.fx?raw';

export { vertexShader, fragmentShader };

// 导出着色器配置
export const earthGridShaderConfig = {
  attributes: ['position', 'normal', 'uv'],
  uniforms: [
    'world',
    'worldViewProjection',
    'cameraPosition',
    'baseColor',
    'gridColor',
    'gridOpacity',
    'majorLineWidth',
    'minorLineWidth',
    'fadeDistance',
    'maxViewDistance',
  ],
};

// 导出默认配置
export const defaultEarthGridConfig = {
  baseColor: [0.2, 0.4, 0.8] as [number, number, number],
  gridColor: [1.0, 1.0, 1.0] as [number, number, number],
  gridOpacity: 0.8,
  majorLineWidth: 2.0,
  minorLineWidth: 1.0,
  fadeDistance: 5.0,
  maxViewDistance: 15.0,
};
