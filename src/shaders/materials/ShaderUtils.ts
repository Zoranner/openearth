/**
 * 着色器工具类
 * 提供着色器加载、编译和管理功能
 */

import { logger } from '../../utils/Logger';

export class ShaderUtils {
  /**
   * 加载着色器代码
   */
  static async loadShader(path: string): Promise<string> {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load shader: ${path}`);
      }
      return await response.text();
    } catch (error) {
      logger.error(`Error loading shader from ${path}`, 'ShaderUtils', error);
      throw error;
    }
  }

  /**
   * 处理着色器的 #include 指令
   */
  static processIncludes(shaderCode: string, _basePath: string): string {
    const includeRegex = /#include\s+"([^"]+)"/g;

    return shaderCode.replace(includeRegex, (_match, includePath) => {
      try {
        // 这里简化处理，实际项目中可能需要异步加载
        // 对于静态包含，我们直接返回内容
        return this.getIncludeContent(includePath, _basePath);
      } catch (error) {
        logger.warn(`Failed to include ${includePath}`, 'ShaderUtils', error);
        return `// Failed to include ${includePath}`;
      }
    });
  }

  /**
   * 获取包含文件的内容
   */
  private static getIncludeContent(_includePath: string, _basePath: string): string {
    // 这里可以实现更复杂的包含逻辑
    // 对于现在的实现，我们返回空字符串，实际内容会在构建时处理
    return '';
  }

  /**
   * 验证着色器代码
   */
  static validateShader(shaderCode: string, type: 'vertex' | 'fragment'): boolean {
    // 基本的着色器代码验证
    if (!shaderCode || shaderCode.trim().length === 0) {
      logger.error(`Empty ${type} shader code`, 'ShaderUtils');
      return false;
    }

    // 检查必要的主函数
    if (!shaderCode.includes('void main()')) {
      logger.error(`Missing main function in ${type} shader`, 'ShaderUtils');
      return false;
    }

    // 检查片段着色器的输出
    if (type === 'fragment' && !shaderCode.includes('gl_FragColor')) {
      logger.error('Fragment shader missing gl_FragColor output', 'ShaderUtils');
      return false;
    }

    // 检查顶点着色器的位置输出
    if (type === 'vertex' && !shaderCode.includes('gl_Position')) {
      logger.error('Vertex shader missing gl_Position output', 'ShaderUtils');
      return false;
    }

    return true;
  }

  /**
   * 生成着色器的唯一标识符
   */
  static generateShaderId(vertexCode: string, fragmentCode: string): string {
    // 简单的哈希实现
    const hash = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // 转换为32位整数
      }
      return hash.toString(16);
    };

    return `shader_${hash(vertexCode + fragmentCode)}`;
  }
}
