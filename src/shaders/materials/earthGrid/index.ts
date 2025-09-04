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
    'zeroLineColor',
    'gridOpacity',
    'lineWidth',
  ],
};

// 导出默认配置
export const defaultEarthGridConfig = {
  baseColor: [0.2, 0.4, 0.8] as [number, number, number],
  gridColor: [1.0, 1.0, 1.0] as [number, number, number],
  zeroLineColor: [1.0, 1.0, 0.0] as [number, number, number], // 亮黄色
  gridOpacity: 0.8,
  lineWidth: 1.0,
};
