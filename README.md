# OpenGlobus - Babylon.js Implementation

一个基于 Babylon.js 的现代化 3D 地球可视化库，提供高性能的地球渲染、地形可视化和交互功能。

## ✨ 特性

### 🌍 核心功能
- **高性能地球渲染** - 基于 Babylon.js 的现代 WebGL 渲染引擎
- **瓦片地图系统** - 支持多种地图数据源和 LOD 优化
- **相机控制系统** - 流畅的 3D 导航和交互体验
- **大气层效果** - 真实的大气散射和边缘光晕效果

### 🌅 光照与环境
- **太阳系统** - 真实的太阳位置计算和光照模拟
- **昼夜循环** - 动态的日夜变化效果
- **夜晚灯光** - 城市灯光和夜景纹理渲染
- **动态阴影** - 基于太阳位置的实时阴影计算

### 🏔️ 地形渲染
- **地形优化器** - 智能 LOD 管理和性能优化
- **高度图支持** - 真实地形高度数据渲染
- **法线贴图** - 增强地形细节和光照效果
- **细节纹理** - 多层次地形纹理混合

### ⚡ 性能优化
- **视锥体裁剪** - 只渲染可见区域的地形
- **内存管理** - 智能瓦片缓存和清理机制
- **异步加载** - 非阻塞的资源加载系统
- **性能监控** - 实时 FPS、帧时间和绘制调用统计

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 构建项目

```bash
npm run build
```

### 运行示例

```bash
npm run dev
```

然后在浏览器中打开 `http://localhost:8080/examples/basic-globe.html`

## 📖 基本用法

### 创建基础地球

```typescript
import { createBasicGlobe } from './src/examples/basic-globe.js';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const globeExample = await createBasicGlobe(canvas);
```

### 配置太阳系统

```typescript
// 设置时间为正午
globeExample.globe.sunSystem.setTimeOfDay(12.0);

// 设置纬度为北京
globeExample.globe.sunSystem.setLatitude(39.9);

// 启动昼夜循环（24秒 = 1天）
globeExample.globe.sunSystem.startDayNightCycle(24000);
```

### 配置夜晚灯光

```typescript
// 设置夜晚灯光强度
globeExample.globe.nightLightRenderer.setIntensity(1.2);

// 设置城市灯光颜色
const warmYellow = new BABYLON.Color3(1.0, 0.9, 0.6);
globeExample.globe.nightLightRenderer.setCityLightColor(warmYellow);
```

### 地形优化配置

```typescript
// 配置 LOD 设置
globeExample.globe.terrainOptimizer.setLODConfig({
  maxLOD: 18,
  minLOD: 0,
  lodBias: 1.0,
  distanceScale: 1.0
});

// 启用高度图和法线贴图
globeExample.globe.terrainDetailRenderer.setHeightMapsEnabled(true);
globeExample.globe.terrainDetailRenderer.setNormalMapsEnabled(true);
```

## 🎮 交互控制

示例页面提供了丰富的交互控制：

### 🌅 太阳系统控制
- **时间滑块** - 调整一天中的时间（0-24小时）
- **纬度滑块** - 设置观察位置的纬度（-90°到90°）
- **昼夜循环** - 启动/停止自动昼夜变化

### 🌃 夜晚灯光控制
- **灯光强度** - 调整夜晚城市灯光的整体强度
- **灯光亮度** - 控制灯光的亮度和对比度

### 🏔️ 地形控制
- **地形优化** - 启用/禁用地形渲染优化
- **高度图** - 切换真实地形高度数据
- **法线贴图** - 切换地形法线贴图效果
- **高度缩放** - 调整地形高度的缩放比例
- **细节缩放** - 控制地形纹理的细节级别

### 📊 性能监控
- **帧率 (FPS)** - 实时显示渲染帧率
- **帧时间** - 每帧渲染所需时间
- **活跃瓦片** - 当前渲染的地图瓦片数量
- **缓存瓦片** - 内存中缓存的瓦片数量
- **绘制调用** - GPU 绘制调用次数

## 🏗️ 项目结构

```
src/
├── core/                    # 核心模块
│   ├── Globe.ts            # 主要地球类
│   ├── EarthSphere.ts      # 地球球体渲染
│   ├── AtmosphereRenderer.ts # 大气层渲染
│   ├── NightLightRenderer.ts # 夜晚灯光渲染
│   └── SunSystem.ts        # 太阳系统
├── terrain/                 # 地形系统
│   ├── TileLoader.ts       # 瓦片加载器
│   ├── TerrainOptimizer.ts # 地形优化器
│   └── TerrainDetailRenderer.ts # 地形细节渲染
├── examples/               # 示例代码
│   ├── basic-globe.ts      # 基础地球示例
│   └── basic-globe.html    # 示例页面
└── types/                  # TypeScript 类型定义
    └── index.ts
```

## 🔧 配置选项

### Globe 配置

```typescript
interface GlobeOptions {
  earthRadius?: number;        // 地球半径（米）
  adaptToDeviceRatio?: boolean; // 适应设备像素比
  antialias?: boolean;         // 抗锯齿
}
```

### 地形优化配置

```typescript
interface LODConfig {
  maxLOD: number;      // 最大细节级别
  minLOD: number;      // 最小细节级别
  lodBias: number;     // LOD 偏移
  distanceScale: number; // 距离缩放
}

interface MemoryConfig {
  maxTiles: number;      // 最大瓦片数量
  maxMemoryMB: number;   // 最大内存使用（MB）
  cleanupInterval: number; // 清理间隔（毫秒）
}
```

## 🌐 支持的地图源

- **OpenStreetMap** - 开源地图数据
- **ArcGIS Satellite** - 卫星影像
- **ArcGIS Terrain** - 地形图
- **自定义瓦片服务** - 支持标准 XYZ 瓦片格式

## 🎯 性能建议

1. **合理设置 LOD 参数** - 根据应用场景调整最大和最小细节级别
2. **控制内存使用** - 设置合适的瓦片缓存大小
3. **启用视锥体裁剪** - 只渲染可见区域以提高性能
4. **优化纹理大小** - 使用适当分辨率的地形纹理
5. **监控性能指标** - 使用内置的性能监控工具

## 🔮 未来计划

- [ ] 矢量数据支持
- [ ] 3D 建筑物渲染
- [ ] 天气效果系统
- [ ] 多球体支持（月球、火星等）
- [ ] WebXR/VR 支持
- [ ] 更多地图数据源集成

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 联系

如有问题或建议，请通过 GitHub Issues 联系我们。