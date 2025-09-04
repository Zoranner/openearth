/**
 * Babylon.js 着色器文件导入类型定义
 */

declare module '*.vertex.fx?raw' {
  const content: string;
  export default content;
}

declare module '*.fragment.fx?raw' {
  const content: string;
  export default content;
}

declare module '*.fx?raw' {
  const content: string;
  export default content;
}
