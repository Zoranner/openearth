import { Engine, Scene, Vector3, HemisphericLight, Color3 } from '@babylonjs/core';
import { Globe } from '../core/Globe';

/**
 * Basic Globe Example
 * Demonstrates the basic usage of OpenGlobus with Babylon.js
 */
export class BasicGlobeExample {
  private _canvas: HTMLCanvasElement;
  private _engine: Engine;
  private _scene: Scene;
  private _globe: Globe;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._engine = new Engine(canvas, true, {
      adaptToDeviceRatio: true,
      antialias: true
    });
    this._scene = new Scene(this._engine);
    
    // Initialize globe
    this._globe = new Globe(this._scene, {
      earthRadius: 6371000, // Earth radius in meters
      adaptToDeviceRatio: true
    });
  }

  /**
   * Initialize the example
   */
  public async initialize(): Promise<void> {
    try {
      // Set up basic lighting
      this._setupLighting();
      
      // Initialize globe
      await this._globe.initialize();
      
      // Configure sun system for demonstration
        if (this._globe.sunSystem) {
          // Set initial time to noon
          this._globe.sunSystem.setTimeOfDay(12.0);
          
          // Set location to Beijing (39.9°N)
          this._globe.sunSystem.setLatitude(39.9);
          
          // Start day/night cycle (24 seconds = 1 day)
          this._globe.sunSystem.startDayNightCycle(24000);
        }
        
        // Configure night light renderer
        if (this._globe.nightLightRenderer) {
          // Set night light properties
          this._globe.nightLightRenderer.setIntensity(1.2);
          this._globe.nightLightRenderer.setBrightness(0.9);
          
          // Set warm city light color
          const { Color3 } = await import('@babylonjs/core');
          this._globe.nightLightRenderer.setCityLightColor(new Color3(1.0, 0.9, 0.6));
        }
        
        // Configure terrain optimizer
        if (this._globe.terrainOptimizer) {
          // Set LOD configuration
          this._globe.terrainOptimizer.setLODConfig({
            maxLOD: 18,
            minLOD: 0,
            lodBias: 1.0,
            distanceScale: 1.0
          });
          
          // Set memory limits
          this._globe.terrainOptimizer.setMemoryConfig({
            maxTiles: 1000,
            maxMemoryMB: 512,
            cleanupInterval: 30000
          });
          
          // Enable frustum culling
          this._globe.terrainOptimizer.setFrustumCullingEnabled(true);
        }
        
        // Configure terrain detail renderer
        if (this._globe.terrainDetailRenderer) {
          // Enable height maps and normal maps
          this._globe.terrainDetailRenderer.setHeightMapsEnabled(true);
          this._globe.terrainDetailRenderer.setNormalMapsEnabled(true);
          
          // Set height and detail scales
          this._globe.terrainDetailRenderer.setHeightScale(10000); // 10km max height
          this._globe.terrainDetailRenderer.setDetailScale(16); // 16x detail multiplier
          
          // Set texture providers (using default providers)
          this._globe.terrainDetailRenderer.setHeightTextureProvider('https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png');
          this._globe.terrainDetailRenderer.setNormalTextureProvider('https://elevation-tiles-prod.s3.amazonaws.com/normal/{z}/{x}/{y}.png');
        }
      
      // Set up camera position
      this._setupCamera();
      
      // Start render loop
      this._startRenderLoop();
      
      // Handle window resize
      this._setupWindowResize();
      
      console.log('Basic Globe Example initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Basic Globe Example:', error);
      throw error;
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this._globe?.dispose();
    this._scene?.dispose();
    this._engine?.dispose();
  }

  /**
   * Get the globe instance
   */
  public get globe(): Globe {
    return this._globe;
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
   * Set up basic lighting
   */
  private _setupLighting(): void {
    // Create hemispheric light
    const light = new HemisphericLight('hemisphericLight', new Vector3(0, 1, 0), this._scene);
    light.intensity = 0.8;
    light.diffuse = new Color3(1, 1, 0.9); // Slightly warm white
    light.specular = new Color3(0.2, 0.2, 0.2); // Subtle specular
    light.groundColor = new Color3(0.1, 0.1, 0.2); // Dark blue ground color
  }

  /**
   * Set up camera position
   */
  private _setupCamera(): void {
    const camera = this._globe.camera;
    if (camera) {
      // Position camera to show Earth from space
      const earthRadius = this._globe.earthRadius;
      camera.setTarget(Vector3.Zero());
      camera.setPosition(new Vector3(0, 0, earthRadius * 3)); // 3x Earth radius distance
      
      // Set camera limits
      camera.lowerRadiusLimit = earthRadius * 1.1; // Minimum distance (just above surface)
      camera.upperRadiusLimit = earthRadius * 10;  // Maximum distance
      
      // Enable camera controls
      camera.attachToCanvas(this._canvas);
    }
  }

  /**
   * Start the render loop
   */
  private _startRenderLoop(): void {
    this._engine.runRenderLoop(() => {
      if (this._scene && this._scene.activeCamera) {
        // Update globe with camera position
        this._globe.update(this._scene.activeCamera.position);
        
        // Render scene
        this._scene.render();
      }
    });
  }

  /**
   * Set up window resize handling
   */
  private _setupWindowResize(): void {
    window.addEventListener('resize', () => {
      this._engine.resize();
    });
  }

  /**
   * Fly to a specific location
   */
  public flyTo(longitude: number, latitude: number, altitude: number = 1000000): void {
    this._globe.flyTo(longitude, latitude, altitude);
  }

  /**
   * Load tiles in a specific area
   */
  public async loadArea(west: number, east: number, south: number, north: number, level: number = 8): Promise<void> {
    await this._globe.loadTiles({
      west,
      east,
      south,
      north,
      level
    });
  }
}

/**
 * Create and initialize a basic globe example
 */
export async function createBasicGlobe(canvas: HTMLCanvasElement): Promise<BasicGlobeExample> {
  const example = new BasicGlobeExample(canvas);
  await example.initialize();
  return example;
}

/**
 * Example usage in HTML page
 */
export function setupBasicGlobeExample(): void {
  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
    
    if (!canvas) {
      console.error('Canvas element with id "renderCanvas" not found');
      return;
    }
    
    try {
      const example = await createBasicGlobe(canvas);
      
      // Example: Fly to Beijing after 3 seconds
      setTimeout(() => {
        example.flyTo(116.4074, 39.9042, 500000); // Beijing coordinates
      }, 3000);
      
      // Example: Load detailed tiles for Europe
      setTimeout(async () => {
        await example.loadArea(-10, 30, 35, 70, 6); // Europe bounds
      }, 5000);
      
      // Make example globally available for debugging
      (window as any).globeExample = example;
      
    } catch (error) {
      console.error('Failed to create basic globe example:', error);
    }
  });
}