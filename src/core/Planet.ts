import { Scene, Mesh, SphereBuilder, StandardMaterial, Texture, Vector3, Color3 } from '@babylonjs/core';
import { TerrainSystem } from '../terrain/TerrainSystem';
import { AtmosphereRenderer } from './AtmosphereRenderer';

/**
 * Planet represents the Earth in the 3D scene with terrain, atmosphere, and surface rendering
 */
export class Planet {
  private _scene: Scene;
  private _planetMesh: Mesh | null = null;
  private _material: StandardMaterial | null = null;
  private _terrainSystem: TerrainSystem;
  private _atmosphereRenderer: AtmosphereRenderer;
  private _radius: number = 6378137; // Earth radius in meters
  private _isInitialized: boolean = false;

  constructor(scene: Scene, options: PlanetOptions = {}) {
    this._scene = scene;
    this._radius = options.radius ?? this._radius;
    
    this._terrainSystem = new TerrainSystem(scene, { planetRadius: this._radius });
    this._atmosphereRenderer = new AtmosphereRenderer(scene, this._radius);
  }

  /**
   * Initialize the planet and its systems
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // Create the base planet mesh
      this._createPlanetMesh();
      
      // Initialize terrain system
      await this._terrainSystem.initialize();
      
      // Initialize atmosphere renderer
      await this._atmosphereRenderer.initialize();
      
      // Setup materials and textures
      await this._setupMaterials();

      this._isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Planet:', error);
      throw error;
    }
  }

  /**
   * Dispose of all planet resources
   */
  public dispose(): void {
    this._atmosphereRenderer?.dispose();
    this._terrainSystem?.dispose();
    this._material?.dispose();
    this._planetMesh?.dispose();
    
    this._planetMesh = null;
    this._material = null;
    this._isInitialized = false;
  }

  /**
   * Update the planet rendering based on camera position
   */
  public update(cameraPosition: Vector3): void {
    if (!this._isInitialized) {
      return;
    }

    // Update terrain system with camera position
    this._terrainSystem.update(cameraPosition);
    
    // Update atmosphere rendering
    this._atmosphereRenderer.update(cameraPosition);
    
    // Update level of detail based on distance
    this._updateLevelOfDetail(cameraPosition);
  }

  /**
   * Get the planet mesh
   */
  public get mesh(): Mesh | null {
    return this._planetMesh;
  }

  /**
   * Get the planet radius
   */
  public get radius(): number {
    return this._radius;
  }

  /**
   * Get the terrain system
   */
  public get terrainSystem(): TerrainSystem {
    return this._terrainSystem;
  }

  /**
   * Get the atmosphere renderer
   */
  public get atmosphereRenderer(): AtmosphereRenderer {
    return this._atmosphereRenderer;
  }

  /**
   * Set the planet's surface texture
   */
  public setSurfaceTexture(textureUrl: string): void {
    if (this._material) {
      const texture = new Texture(textureUrl, this._scene);
      this._material.diffuseTexture = texture;
    }
  }

  /**
   * Set the planet's normal map
   */
  public setNormalMap(normalMapUrl: string): void {
    if (this._material) {
      const normalTexture = new Texture(normalMapUrl, this._scene);
      this._material.bumpTexture = normalTexture;
    }
  }

  /**
   * Enable or disable atmosphere rendering
   */
  public setAtmosphereEnabled(enabled: boolean): void {
    this._atmosphereRenderer.setEnabled(enabled);
  }

  /**
   * Create the base planet mesh
   */
  private _createPlanetMesh(): void {
    // Create a high-resolution sphere for the planet
    this._planetMesh = SphereBuilder.CreateSphere('planet', {
      diameter: this._radius * 2,
      segments: 64
    }, this._scene);

    // Position at origin
    this._planetMesh.position = Vector3.Zero();
    
    // Set rendering properties
    this._planetMesh.receiveShadows = true;
    this._planetMesh.renderingGroupId = 1; // Render after background, before UI
  }

  /**
   * Setup materials and textures for the planet
   */
  private async _setupMaterials(): Promise<void> {
    if (!this._planetMesh) {
      return;
    }

    // Create standard material for the planet surface
    this._material = new StandardMaterial('planetMaterial', this._scene);
    
    // Set basic properties
    this._material.diffuseColor = new Color3(0.4, 0.6, 0.8); // Ocean blue
    this._material.specularColor = new Color3(0.1, 0.1, 0.1); // Low specularity
    this._material.roughness = 0.8;
    
    // Apply material to mesh
    this._planetMesh.material = this._material;
  }

  /**
   * Update level of detail based on camera distance
   */
  private _updateLevelOfDetail(_cameraPosition: Vector3): void {
    if (!this._planetMesh) {
      return;
    }

    // Calculate distance from camera to planet surface
    // const distanceToSurface = Vector3.Distance(cameraPosition, Vector3.Zero()) - this._radius;
    
    // Adjust mesh detail based on distance
    // This is a simplified LOD system - in practice, you'd use more sophisticated techniques
    // const lodLevel = Math.min(Math.max(Math.floor(distanceToSurface / 100000), 1), 4);
    
    // Update terrain system LOD
    // TODO: Implement LOD system in TerrainSystem
    // this._terrainSystem.setLevelOfDetail(lodLevel);
  }
}

/**
 * Configuration options for Planet
 */
export interface PlanetOptions {
  /** Planet radius in meters (default: Earth radius) */
  radius?: number;
  /** Enable atmosphere rendering */
  atmosphere?: boolean;
  /** Enable terrain rendering */
  terrain?: boolean;
  /** Surface texture URL */
  surfaceTexture?: string;
  /** Normal map URL */
  normalMap?: string;
}