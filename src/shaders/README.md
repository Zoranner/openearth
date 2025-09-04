# Shaders 目录

这个目录包含所有的着色器代码和相关的材质管理器，遵循Babylon.js官方规范。

## 目录结构

```
shaders/
├── materials/              # 着色器材质目录
│   ├── earthGrid/          # 地球网格材质
│   │   ├── earthGrid.vertex.fx     # 顶点着色器
│   │   ├── earthGrid.fragment.fx   # 片段着色器
│   │   └── index.ts               # 导出文件
│   ├── atmosphere/         # 大气材质 (待实现)
│   ├── terrain/           # 地形材质 (待实现)
│   ├── EarthGridMaterial.ts  # 地球网格材质管理器
│   └── ShaderUtils.ts        # 着色器工具类
└── types/                  # TypeScript 类型定义
    └── index.ts
```

## Babylon.js 官方规范

### 文件命名

- 顶点着色器：`*.vertex.fx`
- 片段着色器：`*.fragment.fx`
- 材质管理器：`*Material.ts`

### 导入方式

```typescript
import vertexShader from './shader.vertex.fx?raw';
import fragmentShader from './shader.fragment.fx?raw';
```

### 着色器组织

- 每个材质有独立的目录
- 包含顶点和片段着色器文件
- 提供index.ts导出配置和着色器代码
- 所有常量和函数直接在着色器文件中定义，避免复杂的include系统
