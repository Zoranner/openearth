import { Scene, Mesh, StandardMaterial, Texture, DynamicTexture, Color3, Vector3 } from '@babylonjs/core';

/**
 * EarthSphere manages the basic earth sphere rendering
 * Uses Babylon.js built-in sphere geometry with earth textures
 */
export class EarthSphere {
  private _scene: Scene;
  private _earthRadius: number;
  private _earthMesh: Mesh | null = null;
  private _earthMaterial: StandardMaterial | null = null;
  private _isInitialized: boolean = false;

  constructor(scene: Scene, earthRadius: number) {
    this._scene = scene;
    this._earthRadius = earthRadius;
  }

  /**
   * Initialize the earth sphere
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // Create earth sphere mesh
      this._createEarthSphere();
      
      // Create earth material
      await this._createEarthMaterial();
      
      // Apply material to mesh
      if (this._earthMesh && this._earthMaterial) {
        this._earthMesh.material = this._earthMaterial;
      }

      this._isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize EarthSphere:', error);
      throw error;
    }
  }

  /**
   * Dispose of earth sphere resources
   */
  public dispose(): void {
    this._earthMaterial?.dispose();
    this._earthMesh?.dispose();
    this._isInitialized = false;
  }

  /**
   * Get the earth mesh
   */
  public get mesh(): Mesh | null {
    return this._earthMesh;
  }

  /**
   * Get the earth material
   */
  public get material(): StandardMaterial | null {
    return this._earthMaterial;
  }

  /**
   * Update earth sphere (for future enhancements)
   */
  public update(): void {
    // Future: Update based on camera position, time of day, etc.
  }

  /**
   * Set earth texture
   */
  public setTexture(texture: Texture): void {
    if (this._earthMaterial) {
      this._earthMaterial.diffuseTexture = texture;
    }
  }

  /**
   * Set earth normal map
   */
  public setNormalMap(normalMap: Texture): void {
    if (this._earthMaterial) {
      this._earthMaterial.bumpTexture = normalMap;
    }
  }

  /**
   * Set earth specular map
   */
  public setSpecularMap(specularMap: Texture): void {
    if (this._earthMaterial) {
      this._earthMaterial.specularTexture = specularMap;
    }
  }

  /**
   * Create the earth sphere mesh
   */
  private _createEarthSphere(): void {
    // Create sphere with appropriate detail level
    // Higher subdivision for better quality
    this._earthMesh = Mesh.CreateSphere(
      'earthSphere',
      64, // subdivisions - higher for smoother sphere
      this._earthRadius * 2, // diameter
      this._scene
    );

    // Position at world origin
    this._earthMesh.position = Vector3.Zero();
    
    // Enable back face culling for performance
    this._earthMesh.material = null; // Will be set after material creation
  }

  /**
   * Create earth material with basic textures
   */
  private async _createEarthMaterial(): Promise<void> {
    this._earthMaterial = new StandardMaterial('earthMaterial', this._scene);
    
    // Create a simple earth-like texture if no external texture is provided
    const earthTexture = this._createDefaultEarthTexture();
    this._earthMaterial.diffuseTexture = earthTexture;
    
    // Set material properties for earth-like appearance
    this._earthMaterial.specularColor = new Color3(0.1, 0.1, 0.2); // Low specular for land
    this._earthMaterial.specularPower = 32;
    this._earthMaterial.ambientColor = new Color3(0.2, 0.2, 0.2);
    
    // Enable backface culling for performance
    this._earthMaterial.backFaceCulling = true;
  }

  /**
   * Create a default earth texture using DynamicTexture
   */
  private _createDefaultEarthTexture(): DynamicTexture {
    const textureSize = 1024;
    const dynamicTexture = new DynamicTexture(
      'defaultEarthTexture',
      { width: textureSize, height: textureSize },
      this._scene
    );

    // Get the 2D context to draw on the texture
    const context = dynamicTexture.getContext();
    
    // Create a simple earth-like pattern
    this._drawEarthPattern(context, textureSize);
    
    // Update the texture
    dynamicTexture.update();
    
    return dynamicTexture;
  }

  /**
   * Draw a simple earth pattern on the texture
   */
  private _drawEarthPattern(context: CanvasRenderingContext2D, size: number): void {
    // Fill with ocean blue
    context.fillStyle = '#1e3a8a'; // Ocean blue
    context.fillRect(0, 0, size, size);
    
    // Add some simple continent shapes
    context.fillStyle = '#22c55e'; // Land green
    
    // Draw simple continent shapes (very basic representation)
    // North America
    context.beginPath();
    context.ellipse(size * 0.2, size * 0.3, size * 0.08, size * 0.12, 0, 0, 2 * Math.PI);
    context.fill();
    
    // Europe/Africa
    context.beginPath();
    context.ellipse(size * 0.55, size * 0.35, size * 0.06, size * 0.15, 0, 0, 2 * Math.PI);
    context.fill();
    
    // Asia
    context.beginPath();
    context.ellipse(size * 0.75, size * 0.25, size * 0.12, size * 0.08, 0, 0, 2 * Math.PI);
    context.fill();
    
    // Australia
    context.beginPath();
    context.ellipse(size * 0.8, size * 0.7, size * 0.04, size * 0.03, 0, 0, 2 * Math.PI);
    context.fill();
    
    // Add some cloud-like patterns for atmosphere effect
    context.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = Math.random() * 30 + 10;
      
      context.beginPath();
      context.ellipse(x, y, radius, radius * 0.6, Math.random() * Math.PI, 0, 2 * Math.PI);
      context.fill();
    }
  }

  /**
   * Load external earth texture from URL
   */
  public async loadEarthTexture(url: string): Promise<void> {
    try {
      const texture = new Texture(url, this._scene);
      
      // Wait for texture to load
      await new Promise<void>((resolve, reject) => {
        texture.onLoadObservable.add(() => resolve());
        texture.onErrorObservable.add(() => reject(new Error(`Failed to load texture: ${url}`)));
      });
      
      this.setTexture(texture);
    } catch (error) {
      console.warn('Failed to load earth texture, using default:', error);
    }
  }

  /**
   * Load external normal map from URL
   */
  public async loadNormalMap(url: string): Promise<void> {
    try {
      const normalMap = new Texture(url, this._scene);
      
      // Wait for texture to load
      await new Promise<void>((resolve, reject) => {
        normalMap.onLoadObservable.add(() => resolve());
        normalMap.onErrorObservable.add(() => reject(new Error(`Failed to load normal map: ${url}`)));
      });
      
      this.setNormalMap(normalMap);
    } catch (error) {
      console.warn('Failed to load normal map:', error);
    }
  }

  /**
   * Enable or disable wireframe mode
   */
  public setWireframe(enabled: boolean): void {
    if (this._earthMaterial) {
      this._earthMaterial.wireframe = enabled;
    }
  }

  /**
   * Set the opacity of the earth sphere
   */
  public setOpacity(opacity: number): void {
    if (this._earthMaterial) {
      this._earthMaterial.alpha = Math.max(0, Math.min(1, opacity));
    }
  }
}