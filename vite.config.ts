import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  return {
    // 库构建配置
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'OpenGlobusBabylon',
        fileName: format => `index.${format === 'es' ? 'esm' : format}.js`,
        formats: ['es', 'cjs', 'umd'],
      },
      rollupOptions: {
        external: [
          '@babylonjs/core',
          '@babylonjs/materials',
          '@babylonjs/loaders',
          '@babylonjs/post-processes',
          '@babylonjs/procedural-textures',
          '@babylonjs/serializers',
        ],
        output: {
          globals: {
            '@babylonjs/core': 'BABYLON',
            '@babylonjs/materials': 'BABYLON',
            '@babylonjs/loaders': 'BABYLON',
            '@babylonjs/post-processes': 'BABYLON',
            '@babylonjs/procedural-textures': 'BABYLON',
            '@babylonjs/serializers': 'BABYLON',
          },
        },
      },
      sourcemap: true,
      minify: 'terser',
      target: 'es2020',
    },

    // 插件配置
    plugins: [
      dts({
        insertTypesEntry: true,
        rollupTypes: true,
      }),
    ],

    // 开发环境配置
    server: {
      port: 3000,
      open: true,
      host: true,
      cors: true,
      fs: {
        // 允许访问上级目录
        allow: ['..'],
      },
    },

    // 预览配置
    preview: {
      port: 4173,
      open: true,
      host: true,
      fs: {
        allow: ['..'],
      },
    },

    // 路径别名
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        // 根据环境选择不同的入口
        ...(isDev
          ? {
              // 开发环境：直接使用 src 源码
              '@openglobus/babylon': resolve(__dirname, 'src/index.ts'),
            }
          : {
              // 生产环境：使用编译后的代码
              '@openglobus/babylon': resolve(__dirname, 'dist/index.js'),
            }),
      },
    },

    // 依赖优化
    optimizeDeps: {
      exclude: [
        '@babylonjs/core',
        '@babylonjs/materials',
        '@babylonjs/loaders',
        '@babylonjs/post-processes',
        '@babylonjs/procedural-textures',
        '@babylonjs/serializers',
      ],
    },

    // 环境变量
    define: {
      __DEV__: JSON.stringify(isDev),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },

    // 公共路径配置
    base: isDev ? '/' : '/',

    // 构建输出配置
    ...(isDev
      ? {}
      : {
          build: {
            outDir: 'dist',
            assetsDir: 'assets',
            emptyOutDir: true,
            rollupOptions: {
              input: {
                main: resolve(__dirname, 'src/index.ts'),
              },
            },
          },
        }),
  };
});
