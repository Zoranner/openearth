import { Engine, Scene, Vector3, Color4, ArcRotateCamera } from '@babylonjs/core';
import { TileLoader } from '../terrain/TileLoader';
import { TerrainOptimizer } from '../terrain/TerrainOptimizer';
import { TerrainDetailRenderer } from '../terrain/TerrainDetailRenderer';
import { EarthSphere } from './EarthSphere';
import { AtmosphereRenderer } from './AtmosphereRenderer';
import { SunSystem } from './SunSystem';
import { NightLightRenderer } from './NightLightRenderer';

/**
 * Globe is the main entry point for the OpenGlobus Babylon.js implementation
 * Focuses on earth sphere rendering and tile data loading using Babylon.js architecture
 */
export class Globe {
  private _canvas: HTMLCanvasElement;
  private _engine!: Engine;
  private _scene!: Scene;
  private _camera!: ArcRotateCamera;
  private _earthSphere!: EarthSphere;
  private _tileLoader: TileLoader | null = null;
  private _terrainOptimizer: TerrainOptimizer | null = null;
  private _terrainDetailRenderer: TerrainDetailRenderer | null = null;
  private _atmosphereRenderer: AtmosphereRenderer | null = null;
  private _sunSystem: SunSystem | null = null;
  private _nightLightRenderer: NightLightRenderer | null = null;
  private _isInitialized: boolean = false;
  private _lastUpdateTime: number = 0;

  // Earth configuration
  private _earthRadius: number = 6378137; // Earth radius in meters
  private _options: GlobeOptions;

  constructor(canvas: HTMLCanvasElement, options: GlobeOptions = {}) {
    this._canvas = canvas;
    this._options = {
      antialias: true,
      adaptToDeviceRatio: true,
      earthRadius: this._earthRadius,
      ...options
    };

    this._earthRadius = this._options.earthRadius!;
    this._initializeBabylon();
  }

  /**
   * Initialize the globe and all its systems
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // Create earth sphere
      this._earthSphere = new EarthSphere(this._scene, this._earthRadius);
      await this._earthSphere.initialize();
      
      // Initialize tile loader
      this._tileLoader = new TileLoader(this._scene, this._earthRadius);
      await this._tileLoader.initialize();
      
      // Initialize terrain optimizer
      this._terrainOptimizer = new TerrainOptimizer(this._scene, this._tileLoader);
      this._terrainOptimizer.initialize();
      
      // Initialize terrain detail renderer
      this._terrainDetailRenderer = new TerrainDetailRenderer(this._scene, this._earthRadius);
      await this._terrainDetailRenderer.initialize();
      
      // Initialize atmosphere renderer
      this._atmosphereRenderer = new AtmosphereRenderer(this._scene, this._earthRadius);
      await this._atmosphereRenderer.initialize();
      
      // Initialize sun system
      this._sunSystem = new SunSystem(this._scene);
      await this._sunSystem.initialize();
      
      // Initialize night light renderer
      this._nightLightRenderer = new NightLightRenderer(this._scene, this._earthRadius);
      await this._nightLightRenderer.initialize();
      
      // Note: Lighting is now handled by SunSystem
      
      // Start render loop
      this._startRenderLoop();
      
      this._isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Globe:', error);
      throw error;
    }
  }

  /**
   * Dispose of all resources and stop rendering
   */
  public dispose(): void {
    if (this._engine) {
      this._engine.stopRenderLoop();
    }

    this._earthSphere?.dispose();
    this._tileLoader?.dispose();
    this._terrainOptimizer?.dispose();
    this._terrainDetailRenderer?.dispose();
    this._atmosphereRenderer?.dispose();
    this._sunSystem?.dispose();
    this._nightLightRenderer?.dispose();
    this._scene?.dispose();
    this._engine?.dispose();

    this._isInitialized = false;
  }

  /**
   * Resize the globe when canvas size changes
   */
  public resize(): void {
    this._engine.resize();
  }

  /**
   * Fly camera to specific geographic location
   */
  public flyTo(longitude: number, latitude: number, altitude: number = 2000000): void {
    if (!this._camera) return;
    
    // Convert geographic coordinates to world position
    const position = this._geographicToWorld(longitude, latitude, altitude);
    const target = this._geographicToWorld(longitude, latitude, 0);
    
    // Animate camera to position
    this._animateCameraTo(position, target);
  }

  /**
   * Load tile data for specific area
   */
  public async loadTiles(bounds: { west: number; east: number; south: number; north: number; level: number }): Promise<void> {
    if (this._tileLoader) {
      await this._tileLoader.loadTilesInBounds(bounds);
    }
  }

  /**
   * Get the camera
   */
  public get camera(): ArcRotateCamera {
    return this._camera;
  }

  /**
   * Get the earth sphere
   */
  public get earthSphere(): EarthSphere {
    return this._earthSphere;
  }

  /**
   * Get the tile loader
   */
  public get tileLoader(): TileLoader | null {
    return this._tileLoader;
  }

  /**
   * Get the terrain optimizer
   */
  public get terrainOptimizer(): TerrainOptimizer | null {
    return this._terrainOptimizer;
  }

  /**
   * Get the terrain detail renderer
   */
  public get terrainDetailRenderer(): TerrainDetailRenderer | null {
    return this._terrainDetailRenderer;
  }

  /**
   * Get the atmosphere renderer
   */
  public get atmosphereRenderer(): AtmosphereRenderer | null {
    return this._atmosphereRenderer;
  }

  /**
   * Get the sun system
   */
  public get sunSystem(): SunSystem | null {
    return this._sunSystem;
  }

  /**
   * Get the night light renderer
   */
  public get nightLightRenderer(): NightLightRenderer | null {
    return this._nightLightRenderer;
  }

  /**
   * Get the scene instance
   */
  public get scene(): Scene {
    return this._scene;
  }

  /**
   * Get the engine instance
   */
  public get engine(): Engine {
    return this._engine;
  }

  /**
   * Initialize Babylon.js engine, scene and camera
   */
  private _initializeBabylon(): void {
    // Initialize Babylon.js engine
    this._engine = new Engine(this._canvas, this._options.antialias, {
      adaptToDeviceRatio: this._options.adaptToDeviceRatio ?? true,
      preserveDrawingBuffer: true,
      stencil: true
    });

    // Create scene
    this._scene = new Scene(this._engine);
    
    // Set background color to space black
    this._scene.clearColor = new Color4(0.02, 0.02, 0.05, 1.0);
    
    // Create arc rotate camera (orbital camera)
    this._camera = new ArcRotateCamera(
      'camera',
      0, // alpha (horizontal rotation)
      Math.PI / 2, // beta (vertical rotation)  
      this._earthRadius * 3, // radius (distance from target)
      Vector3.Zero(), // target
      this._scene
    );
    
    // Setup camera
    this._camera.attachControl(this._canvas, true);
    this._camera.minZ = 0.1;
    this._camera.maxZ = this._earthRadius * 10;
    this._camera.lowerRadiusLimit = this._earthRadius + 1000; // 1km above surface
    this._camera.upperRadiusLimit = this._earthRadius * 5; // 5x earth radius
    this._camera.wheelPrecision = 50;
  }

  // Note: Lighting setup is now handled by SunSystem

  /**
   * Update the globe rendering
   */
  public update(): void {
    if (!this._isInitialized) {
      return;
    }

    // Calculate delta time
    const currentTime = performance.now();
    const deltaTime = this._lastUpdateTime > 0 ? currentTime - this._lastUpdateTime : 0;
    this._lastUpdateTime = currentTime;

    // Update sun system
    if (this._sunSystem) {
      this._sunSystem.update(deltaTime);
    }

    // Update terrain optimizer (includes tile loading optimization)
    if (this._camera && this._terrainOptimizer) {
      // TerrainOptimizer doesn't have an update method - it works automatically
      // this._terrainOptimizer.update(this._camera.position, deltaTime);
    }

    // Update tile loading based on camera position
    if (this._camera && this._tileLoader) {
      this._tileLoader.update(this._camera.position);
    }

    // Update atmosphere rendering with sun direction
    if (this._camera && this._atmosphereRenderer && this._sunSystem) {
      const sunDirection = this._sunSystem.sunDirection;
      this._atmosphereRenderer.update(this._camera.position, sunDirection);
    }

    // Update night light rendering
    if (this._camera && this._nightLightRenderer && this._sunSystem) {
      const sunDirection = this._sunSystem.sunDirection;
      this._nightLightRenderer.update(this._camera.position, sunDirection);
    }

    // Render the scene
    this._scene?.render();
  }

  /**
   * Start the render loop
   */
  private _startRenderLoop(): void {
    this._engine.runRenderLoop(() => {
      if (this._scene && this._scene.activeCamera) {
        this.update();
      }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.resize();
    });
  }

  /**
   * Convert geographic coordinates to world position
   */
  private _geographicToWorld(longitude: number, latitude: number, altitude: number): Vector3 {
    const lonRad = longitude * Math.PI / 180;
    const latRad = latitude * Math.PI / 180;
    const radius = this._earthRadius + altitude;
    
    const x = radius * Math.cos(latRad) * Math.cos(lonRad);
    const y = radius * Math.sin(latRad);
    const z = radius * Math.cos(latRad) * Math.sin(lonRad);
    
    return new Vector3(x, y, z);
  }

  /**
   * Animate camera to specific position
   */
  private _animateCameraTo(position: Vector3, target: Vector3): void {
    // Simple implementation - direct assignment
    // TODO: Add smooth animation using Babylon.js Animation system
    this._camera.setTarget(target);
    this._camera.setPosition(position);
  }
}

/**
 * Configuration options for Globe initialization
 */
export interface GlobeOptions {
  /** Enable antialiasing */
  antialias?: boolean;
  /** Adapt to device pixel ratio */
  adaptToDeviceRatio?: boolean;
  /** Earth radius in meters */
  earthRadius?: number;
  /** Initial camera position */
  initialCameraPosition?: Vector3;
  /** Initial camera target */
  initialCameraTarget?: Vector3;
}