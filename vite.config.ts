import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import type { UserConfig } from 'vite';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      exclude: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*', 'examples/**/*']
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'OpenGlobusBabylon',
      formats: ['es', 'umd'],
      fileName: (format) => `index.${format === 'es' ? 'esm' : format}.js`
    },
    rollupOptions: {
      external: [
        '@babylonjs/core',
        '@babylonjs/materials',
        '@babylonjs/loaders',
        '@babylonjs/post-processes',
        '@babylonjs/procedural-textures',
        '@babylonjs/serializers'
      ],
      output: {
        globals: {
          '@babylonjs/core': 'BABYLON',
          '@babylonjs/materials': 'BABYLON.Materials',
          '@babylonjs/loaders': 'BABYLON.Loaders',
          '@babylonjs/post-processes': 'BABYLON.PostProcesses',
          '@babylonjs/procedural-textures': 'BABYLON.ProceduralTextures',
          '@babylonjs/serializers': 'BABYLON.Serializers'
        },
        exports: 'named'
      }
    },
    sourcemap: true,
    minify: 'terser',
    target: 'es2020',
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    open: true,
    host: true,
    cors: true
  },
  preview: {
    port: 4173,
    open: true,
    host: true
  },
  optimizeDeps: {
    exclude: [
      '@babylonjs/core',
      '@babylonjs/materials',
      '@babylonjs/loaders',
      '@babylonjs/post-processes',
      '@babylonjs/procedural-textures',
      '@babylonjs/serializers'
    ]
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
} satisfies UserConfig);
