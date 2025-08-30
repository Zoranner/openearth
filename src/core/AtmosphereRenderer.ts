import { Scene, Mesh, SphereBuilder, ShaderMaterial, Vector3, Color3, Texture, Effect, MeshBuilder, StandardMaterial, Color4, BackFaceCulling } from '@babylonjs/core';

/**
 * AtmosphereRenderer handles atmospheric scattering and rendering effects
 * Provides realistic atmospheric rendering using Babylon.js shaders and Rayleigh/Mie scattering
 */
export class AtmosphereRenderer {
  private _scene: Scene;
  private _atmosphereMesh: Mesh | null = null;
  private _atmosphereMaterial: ShaderMaterial | null = null;
  private _glowMesh: Mesh | null = null;
  private _glowMaterial: StandardMaterial | null = null;
  private _planetRadius: number;
  private _atmosphereRadius: number;
  private _isEnabled: boolean = true;
  private _isInitialized: boolean = false;

  // Atmospheric scattering parameters
  private _atmosphereHeight: number = 100000; // 100km atmosphere height
  private _sunDirection: Vector3 = new Vector3(1, 0.5, 0.3).normalize();
  private _rayleighCoefficient: Vector3 = new Vector3(0.0025, 0.0040, 0.0095); // Blue scattering
  private _mieCoefficient: number = 0.0010; // Haze/pollution scattering
  private _sunIntensity: number = 20.0;
  private _scaleHeight: number = 8500; // Rayleigh scale height in meters
  private _mieScaleHeight: number = 1200; // Mie scale height in meters
  private _g: number = -0.75; // Mie phase function asymmetry parameter

  constructor(scene: Scene, planetRadius: number, options: AtmosphereOptions = {}) {
    this._scene = scene;
    this._planetRadius = planetRadius;
    this._atmosphereRadius = planetRadius * 1.025; // Atmosphere extends 2.5% beyond surface
    this._atmosphereHeight = options.atmosphereHeight ?? this._atmosphereHeight;
    this._sunDirection = options.sunDirection ?? this._sunDirection;
    this._rayleighCoefficient = options.rayleighCoefficient ?? this._rayleighCoefficient;
    this._mieCoefficient = options.mieCoefficient ?? this._mieCoefficient;
    this._sunIntensity = options.sunIntensity ?? this._sunIntensity;
    this._scaleHeight = options.scaleHeight ?? this._scaleHeight;
    this._mieScaleHeight = options.mieScaleHeight ?? this._mieScaleHeight;
    this._g = options.g ?? this._g;
  }

  /**
   * Initialize the atmosphere renderer
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // Register custom atmosphere shader
      this._registerAtmosphereShader();
      
      // Create atmosphere mesh (outer sphere)
      this._createAtmosphereMesh();
      
      // Create atmosphere material with scattering
      this._createAtmosphereMaterial();

      // Create atmospheric glow effect
      this._createAtmosphericGlow();

      this._isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize AtmosphereRenderer:', error);
      throw error;
    }
  }

  /**
   * Dispose of atmosphere rendering resources
   */
  public dispose(): void {
    this._atmosphereMaterial?.dispose();
    this._atmosphereMesh?.dispose();
    this._glowMaterial?.dispose();
    this._glowMesh?.dispose();
    
    this._atmosphereMaterial = null;
    this._atmosphereMesh = null;
    this._glowMaterial = null;
    this._glowMesh = null;
    this._isInitialized = false;
  }

  /**
   * Create atmospheric glow effect
   */
  private _createAtmosphericGlow(): void {
    if (!this._atmosphereMesh) return;

    // Create a slightly larger sphere for the glow effect
    const glowRadius = this._planetRadius + this._atmosphereHeight * 1.1;
    
    this._glowMesh = MeshBuilder.CreateSphere('atmosphereGlow', {
      diameter: glowRadius * 2,
      segments: 32
    }, this._scene);

    this._glowMesh.position = Vector3.Zero();
    this._glowMesh.renderingGroupId = 0; // Render before atmosphere

    // Create glow material
    this._glowMaterial = new StandardMaterial('atmosphereGlowMaterial', this._scene);
    this._glowMaterial.diffuseColor = new Color3(0.4, 0.7, 1.0); // Blue atmospheric glow
    this._glowMaterial.emissiveColor = new Color3(0.2, 0.4, 0.8);
    this._glowMaterial.alpha = 0.1;
    this._glowMaterial.backFaceCulling = false;
    
    this._glowMesh.material = this._glowMaterial;
  }

  /**
   * Update atmosphere rendering parameters
   */
  public update(cameraPosition: Vector3, sunDirection?: Vector3): void {
    if (!this._isInitialized || !this._atmosphereMaterial || !this._isEnabled) {
      return;
    }

    // Update sun direction if provided
    if (sunDirection) {
      this._sunDirection = sunDirection.normalize();
    }

    // Update shader uniforms
    this._atmosphereMaterial.setVector3('cameraPosition', cameraPosition);
    this._atmosphereMaterial.setFloat('cameraHeight', cameraPosition.length());
    this._atmosphereMaterial.setFloat('cameraHeight2', cameraPosition.lengthSquared());
    this._atmosphereMaterial.setVector3('sunDirection', this._sunDirection);
    this._atmosphereMaterial.setVector3('rayleighCoefficient', this._rayleighCoefficient);
    this._atmosphereMaterial.setFloat('mieCoefficient', this._mieCoefficient);
    this._atmosphereMaterial.setFloat('sunIntensity', this._sunIntensity);
    this._atmosphereMaterial.setFloat('scaleHeight', this._scaleHeight);
    this._atmosphereMaterial.setFloat('mieScaleHeight', this._mieScaleHeight);
    this._atmosphereMaterial.setFloat('g', this._g);

    // Update glow effect based on sun angle
    if (this._glowMaterial) {
      const sunAngle = Vector3.Dot(cameraPosition.normalize(), this._sunDirection);
      const glowIntensity = Math.max(0.1, 0.3 + sunAngle * 0.2);
      this._glowMaterial.alpha = glowIntensity;
    }
  }

  /**
   * Enable or disable atmosphere rendering
   */
  public setEnabled(enabled: boolean): void {
    this._isEnabled = enabled;
    if (this._atmosphereMesh) {
      this._atmosphereMesh.setEnabled(enabled);
    }
  }

  /**
   * Set sun direction for atmospheric scattering
   */
  public setSunDirection(direction: Vector3): void {
    if (this._atmosphereMaterial) {
      this._atmosphereMaterial.setVector3('sunDirection', direction.normalize());
    }
  }

  /**
   * Set atmospheric scattering parameters
   */
  public setScatteringParameters(options: AtmosphereScatteringOptions): void {
    if (options.rayleighCoefficient) {
      this._rayleighCoefficient = options.rayleighCoefficient;
    }
    if (options.mieCoefficient !== undefined) {
      this._mieCoefficient = options.mieCoefficient;
    }
    if (options.sunIntensity !== undefined) {
      this._sunIntensity = options.sunIntensity;
    }
    if (options.scaleHeight !== undefined) {
      this._scaleHeight = options.scaleHeight;
    }

    // Update material uniforms
    this._updateMaterialUniforms();
  }

  /**
   * Get the atmosphere mesh
   */
  public get mesh(): Mesh | null {
    return this._atmosphereMesh;
  }

  /**
   * Get current sun direction
   */
  get sunDirection(): Vector3 {
    return this._sunDirection.clone();
  }

  /**
   * Set sun direction
   */
  set sunDirection(direction: Vector3) {
    this._sunDirection = direction.normalize();
  }

  /**
   * Get sun intensity
   */
  get sunIntensity(): number {
    return this._sunIntensity;
  }

  /**
   * Set sun intensity
   */
  set sunIntensity(intensity: number) {
    this._sunIntensity = intensity;
  }

  /**
   * Set Rayleigh scattering coefficient (affects blue sky color)
   */
  setRayleighCoefficient(coefficient: Vector3): void {
    this._rayleighCoefficient = coefficient;
  }

  /**
   * Set Mie scattering coefficient (affects haze/pollution)
   */
  setMieCoefficient(coefficient: number): void {
    this._mieCoefficient = coefficient;
  }

  /**
   * Set atmosphere scale heights
   */
  setScaleHeights(rayleigh: number, mie: number): void {
    this._scaleHeight = rayleigh;
    this._mieScaleHeight = mie;
  }

  /**
   * Set Mie phase function asymmetry parameter
   */
  setMieAsymmetry(g: number): void {
    this._g = g;
  }

  /**
   * Enable or disable atmospheric glow effect
   */
  setGlowEnabled(enabled: boolean): void {
    if (this._glowMesh) {
      this._glowMesh.setEnabled(enabled);
    }
  }

  /**
   * Get atmosphere mesh for external manipulation
   */
  get atmosphereMesh(): Mesh | null {
    return this._atmosphereMesh;
  }

  /**
   * Get glow mesh for external manipulation
   */
  get glowMesh(): Mesh | null {
    return this._glowMesh;
  }

  /**
   * Create the atmosphere mesh
   */
  private _createAtmosphereMesh(): void {
    // Create a sphere slightly larger than the planet for atmosphere
    const atmosphereRadius = this._planetRadius + this._atmosphereHeight;
    
    this._atmosphereMesh = MeshBuilder.CreateSphere('atmosphere', {
      diameter: atmosphereRadius * 2,
      segments: 64
    }, this._scene);

    // Position at origin (same as planet)
    this._atmosphereMesh.position = Vector3.Zero();
    
    // Set rendering order to render after the planet
    this._atmosphereMesh.renderingGroupId = 1;
    
    // Disable back face culling to see atmosphere from inside
    this._atmosphereMesh.material = null; // Will be set in _createAtmosphereMaterial
  }

  /**
   * Create the atmosphere material with advanced scattering
   */
  private _createAtmosphereMaterial(): void {
    this._atmosphereMaterial = new ShaderMaterial('atmosphereMaterial', this._scene, {
      vertex: 'atmosphere',
      fragment: 'atmosphere'
    }, {
      attributes: ['position', 'normal'],
      uniforms: [
        'world', 'worldView', 'worldViewProjection', 'view', 'projection',
        'cameraPosition', 'cameraHeight', 'cameraHeight2',
        'planetRadius', 'atmosphereRadius',
        'rayleighCoefficient', 'mieCoefficient',
        'sunDirection', 'sunIntensity', 'scaleHeight',
        'mieScaleHeight', 'g'
      ]
    });

    // Set initial uniform values
    this._updateMaterialUniforms();

    // Set material properties for proper blending
    this._atmosphereMaterial.backFaceCulling = false;
    this._atmosphereMaterial.alphaMode = 2; // ALPHA_BLEND
    this._atmosphereMaterial.disableDepthWrite = true;
    this._atmosphereMaterial.needAlphaBlending = true;

    // Apply material to mesh
    if (this._atmosphereMesh) {
      this._atmosphereMesh.material = this._atmosphereMaterial;
    }
  }

  /**
   * Update material uniform values
   */
  private _updateMaterialUniforms(): void {
    if (!this._atmosphereMaterial) {
      return;
    }

    this._atmosphereMaterial.setFloat('planetRadius', this._planetRadius);
    this._atmosphereMaterial.setFloat('atmosphereRadius', this._atmosphereRadius);
    this._atmosphereMaterial.setVector3('rayleighCoefficient', this._rayleighCoefficient);
    this._atmosphereMaterial.setFloat('mieCoefficient', this._mieCoefficient);
    this._atmosphereMaterial.setFloat('sunIntensity', this._sunIntensity);
    this._atmosphereMaterial.setFloat('scaleHeight', this._scaleHeight);
    
    // Default sun direction (from above)
    this._atmosphereMaterial.setVector3('sunDirection', new Vector3(0, 1, 0));
  }

  /**
   * Register custom atmosphere shader with advanced scattering
   */
  private _registerAtmosphereShader(): void {
    // Vertex shader for atmosphere
    const vertexShader = `
      precision highp float;
      
      // Attributes
      attribute vec3 position;
      attribute vec3 normal;
      
      // Uniforms
      uniform mat4 worldViewProjection;
      uniform mat4 world;
      uniform vec3 cameraPosition;
      uniform float planetRadius;
      
      // Varyings
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying float vAltitude;
      
      void main() {
        vec4 worldPosition = world * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vNormal = normalize((world * vec4(normal, 0.0)).xyz);
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        vAltitude = length(worldPosition.xyz) - planetRadius;
        
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;

    // Fragment shader with advanced atmospheric scattering
    const fragmentShader = `
      precision highp float;
      
      // Uniforms
      uniform vec3 sunDirection;
      uniform vec3 cameraPosition;
      uniform vec3 rayleighCoefficient;
      uniform float mieCoefficient;
      uniform float sunIntensity;
      uniform float scaleHeight;
      uniform float planetRadius;
      uniform float atmosphereRadius;
      
      // Varyings
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying float vAltitude;
      
      // Constants
      const float PI = 3.14159265359;
      const int SAMPLE_COUNT = 8;
      
      // Rayleigh phase function
      float rayleighPhase(float cosTheta) {
        return (3.0 / (16.0 * PI)) * (1.0 + cosTheta * cosTheta);
      }
      
      // Mie phase function (Henyey-Greenstein)
      float miePhase(float cosTheta, float g) {
        float g2 = g * g;
        return (1.0 / (4.0 * PI)) * ((1.0 - g2) / pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
      }
      
      // Optical depth calculation
      float opticalDepth(vec3 start, vec3 end, float scaleH) {
        vec3 step = (end - start) / float(SAMPLE_COUNT);
        float depth = 0.0;
        
        for (int i = 0; i < SAMPLE_COUNT; i++) {
          vec3 samplePoint = start + step * (float(i) + 0.5);
          float altitude = length(samplePoint) - planetRadius;
          depth += exp(-altitude / scaleH) * length(step);
        }
        
        return depth;
      }
      
      void main() {
        vec3 viewDir = normalize(vViewDirection);
        vec3 sunDir = normalize(sunDirection);
        
        float cosTheta = dot(viewDir, sunDir);
        
        // Calculate atmospheric density at current position
        float rayleighDensity = exp(-vAltitude / scaleHeight);
        float mieDensity = exp(-vAltitude / (scaleHeight * 0.2));
        
        // Calculate optical depth from camera to current position
        float rayleighOpticalDepth = opticalDepth(cameraPosition, vWorldPosition, scaleHeight);
        float mieOpticalDepth = opticalDepth(cameraPosition, vWorldPosition, scaleHeight * 0.2);
        
        // Calculate scattering
        vec3 rayleighScattering = rayleighCoefficient * rayleighPhase(cosTheta) * rayleighDensity;
        float mieScattering = mieCoefficient * miePhase(cosTheta, -0.75) * mieDensity;
        
        // Apply extinction
        vec3 extinction = exp(-(rayleighCoefficient * rayleighOpticalDepth + mieCoefficient * mieOpticalDepth));
        
        // Final color calculation
        vec3 inscattering = (rayleighScattering + vec3(mieScattering)) * sunIntensity * (1.0 - extinction);
        
        // Add sunset/sunrise coloring
        float sunAngle = dot(normalize(vWorldPosition), sunDir);
        vec3 sunsetColor = vec3(1.0, 0.4, 0.1) * max(0.0, -sunAngle) * 0.5;
        
        vec3 finalColor = inscattering + sunsetColor;
        
        // Calculate alpha based on atmospheric density and viewing angle
        float alpha = clamp((rayleighDensity + mieDensity) * 0.5, 0.0, 0.8);
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    // Register shaders
    Effect.ShadersStore['atmosphereVertexShader'] = vertexShader;
    Effect.ShadersStore['atmosphereFragmentShader'] = fragmentShader;
  }
}

/**
 * Atmospheric scattering configuration options
 */
export interface AtmosphereScatteringOptions {
  /** Rayleigh scattering coefficient (RGB) */
  rayleighCoefficient?: Vector3;
  /** Mie scattering coefficient */
  mieCoefficient?: number;
  /** Sun intensity */
  sunIntensity?: number;
  /** Atmospheric scale height */
  scaleHeight?: number;
}

/**
 * Atmosphere configuration options
 */
export interface AtmosphereOptions {
  /** Atmosphere height in meters */
  atmosphereHeight?: number;
  /** Sun direction vector */
  sunDirection?: Vector3;
  /** Rayleigh scattering coefficient (RGB) */
  rayleighCoefficient?: Vector3;
  /** Mie scattering coefficient */
  mieCoefficient?: number;
  /** Sun intensity */
  sunIntensity?: number;
  /** Rayleigh scale height in meters */
  scaleHeight?: number;
  /** Mie scale height in meters */
  mieScaleHeight?: number;
  /** Mie phase function asymmetry parameter */
  g?: number;
}