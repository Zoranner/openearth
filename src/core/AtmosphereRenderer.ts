import { Scene, Mesh, ShaderMaterial, Vector3, Color3, Effect, MeshBuilder, StandardMaterial } from '@babylonjs/core';

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
  private _isEnabled = true;
  private _isInitialized = false;

  // Atmospheric scattering parameters
  private _atmosphereHeight = 100000; // 100km atmosphere height
  private _sunDirection: Vector3 = new Vector3(1, 0.5, 0.3).normalize();
  private _rayleighCoefficient: Vector3 = new Vector3(0.0058, 0.0135, 0.0331); // Enhanced blue scattering
  private _mieCoefficient = 0.0021; // Enhanced haze/pollution scattering
  private _sunIntensity = 22.0;
  private _scaleHeight = 8500; // Rayleigh scale height in meters
  private _mieScaleHeight = 1200; // Mie scale height in meters
  private _g = -0.758; // Optimized Mie phase function asymmetry parameter
  private _exposure = 2.0; // HDR exposure control
  private _turbidity = 2.0; // Atmospheric turbidity

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
    this._exposure = options.exposure ?? this._exposure;
    this._turbidity = options.turbidity ?? this._turbidity;
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

    this._glowMesh = MeshBuilder.CreateSphere(
      'atmosphereGlow',
      {
        diameter: glowRadius * 2,
        segments: 32,
      },
      this._scene
    );

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
    this._sunDirection = direction.normalize();
    if (this._atmosphereMaterial) {
      this._atmosphereMaterial.setVector3('sunDirection', this._sunDirection);
    }
  }

  /**
   * Set sun intensity
   */
  public setSunIntensity(intensity: number): void {
    this._sunIntensity = intensity;
    if (this._atmosphereMaterial) {
      this._atmosphereMaterial.setFloat('sunIntensity', this._sunIntensity);
    }
  }

  /**
   * Set atmosphere height
   */
  public setAtmosphereHeight(height: number): void {
    this._atmosphereHeight = height;
    this._atmosphereRadius = this._planetRadius + height;
    if (this._atmosphereMaterial) {
      this._atmosphereMaterial.setFloat('atmosphereRadius', this._atmosphereRadius);
    }
  }

  /**
   * Set HDR exposure control
   */
  public setExposure(exposure: number): void {
    this._exposure = exposure;
    if (this._atmosphereMaterial) {
      this._atmosphereMaterial.setFloat('exposure', this._exposure);
    }
  }

  /**
   * Set atmospheric turbidity
   */
  public setTurbidity(turbidity: number): void {
    this._turbidity = turbidity;
    if (this._atmosphereMaterial) {
      this._atmosphereMaterial.setFloat('turbidity', this._turbidity);
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
  public setRayleighCoefficient(coefficient: Vector3): void {
    this._rayleighCoefficient = coefficient;
    if (this._atmosphereMaterial) {
      this._atmosphereMaterial.setVector3('rayleighCoefficient', this._rayleighCoefficient);
    }
  }

  /**
   * Set Mie scattering coefficient (affects haze/pollution)
   */
  public setMieCoefficient(coefficient: number): void {
    this._mieCoefficient = coefficient;
    if (this._atmosphereMaterial) {
      this._atmosphereMaterial.setFloat('mieCoefficient', this._mieCoefficient);
    }
  }

  /**
   * Set atmosphere scale heights
   */
  public setScaleHeights(rayleigh: number, mie: number): void {
    this._scaleHeight = rayleigh;
    this._mieScaleHeight = mie;
    if (this._atmosphereMaterial) {
      this._atmosphereMaterial.setFloat('scaleHeight', this._scaleHeight);
      this._atmosphereMaterial.setFloat('mieScaleHeight', this._mieScaleHeight);
    }
  }

  /**
   * Set Mie phase function asymmetry parameter
   */
  public setMieAsymmetry(g: number): void {
    this._g = g;
    if (this._atmosphereMaterial) {
      this._atmosphereMaterial.setFloat('g', this._g);
    }
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

    this._atmosphereMesh = MeshBuilder.CreateSphere(
      'atmosphere',
      {
        diameter: atmosphereRadius * 2,
        segments: 64,
      },
      this._scene
    );

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
    this._atmosphereMaterial = new ShaderMaterial(
      'atmosphereMaterial',
      this._scene,
      {
        vertex: 'atmosphere',
        fragment: 'atmosphere',
      },
      {
        attributes: ['position', 'normal'],
        uniforms: [
          'world',
          'worldView',
          'worldViewProjection',
          'view',
          'projection',
          'cameraPosition',
          'cameraHeight',
          'cameraHeight2',
          'planetRadius',
          'atmosphereRadius',
          'rayleighCoefficient',
          'mieCoefficient',
          'sunDirection',
          'sunIntensity',
          'scaleHeight',
          'mieScaleHeight',
          'g',
          'exposure',
          'turbidity',
        ],
      }
    );

    // Set initial uniform values
    this._updateMaterialUniforms();

    // Set material properties for enhanced blending
    this._atmosphereMaterial.backFaceCulling = false;
    this._atmosphereMaterial.alphaMode = 2; // ALPHA_BLEND
    this._atmosphereMaterial.disableDepthWrite = true;
    this._atmosphereMaterial.needAlphaBlending = () => true;
    this._atmosphereMaterial.separateCullingPass = true; // Better depth sorting

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
    this._atmosphereMaterial.setFloat('mieScaleHeight', this._mieScaleHeight);
    this._atmosphereMaterial.setFloat('g', this._g);
    this._atmosphereMaterial.setFloat('exposure', this._exposure);
    this._atmosphereMaterial.setFloat('turbidity', this._turbidity);

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

    // Fragment shader with enhanced atmospheric scattering
    const fragmentShader = `
      precision highp float;

      // Uniforms
      uniform vec3 sunDirection;
      uniform vec3 cameraPosition;
      uniform vec3 rayleighCoefficient;
      uniform float mieCoefficient;
      uniform float sunIntensity;
      uniform float scaleHeight;
      uniform float mieScaleHeight;
      uniform float planetRadius;
      uniform float atmosphereRadius;
      uniform float g;
      uniform float exposure;
      uniform float turbidity;

      // Varyings
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying float vAltitude;

      // Constants
      const float PI = 3.14159265359;
      const int SAMPLE_COUNT = 16;
      const int LIGHT_SAMPLE_COUNT = 8;
      const float EARTH_RADIUS = 6371000.0;
      const float ATMOSPHERE_RADIUS = 6471000.0;

      // Rayleigh phase function
      float rayleighPhase(float cosTheta) {
        return (3.0 / (16.0 * PI)) * (1.0 + cosTheta * cosTheta);
      }

      // Enhanced Mie phase function (Henyey-Greenstein)
      float miePhase(float cosTheta, float g) {
        float g2 = g * g;
        float denom = 1.0 + g2 - 2.0 * g * cosTheta;
        return (1.0 - g2) / (4.0 * PI * pow(denom, 1.5));
      }

      // Improved optical depth calculation with better sampling
      vec2 opticalDepth(vec3 start, vec3 end) {
        vec3 step = (end - start) / float(SAMPLE_COUNT);
        float stepLength = length(step);
        vec2 depth = vec2(0.0);

        for (int i = 0; i < SAMPLE_COUNT; i++) {
          vec3 samplePoint = start + step * (float(i) + 0.5);
          float altitude = length(samplePoint) - planetRadius;

          if (altitude < 0.0) break;

          float rayleighDensity = exp(-altitude / scaleHeight);
          float mieDensity = exp(-altitude / mieScaleHeight);

          depth.x += rayleighDensity * stepLength;
          depth.y += mieDensity * stepLength;
        }

        return depth;
      }

      // Enhanced tone mapping
      vec3 toneMap(vec3 color, float exposure) {
        // Reinhard tone mapping with exposure
        color *= exposure;
        return color / (1.0 + color);
      }

      void main() {
        vec3 viewDir = normalize(vViewDirection);
        vec3 sunDir = normalize(sunDirection);

        float cosTheta = dot(viewDir, sunDir);

        // Enhanced atmospheric density calculation
        float altitude = max(0.0, vAltitude);
        float rayleighDensity = exp(-altitude / scaleHeight);
        float mieDensity = exp(-altitude / mieScaleHeight);

        // Calculate optical depth from camera to current position
        vec2 opticalDepths = opticalDepth(cameraPosition, vWorldPosition);
        float rayleighOpticalDepth = opticalDepths.x;
        float mieOpticalDepth = opticalDepths.y;

        // Enhanced scattering calculation
        vec3 rayleighScattering = rayleighCoefficient * rayleighPhase(cosTheta);
        float mieScattering = mieCoefficient * miePhase(cosTheta, g);

        // Improved extinction with turbidity
        vec3 rayleighExtinction = rayleighCoefficient * rayleighOpticalDepth;
        float mieExtinction = mieCoefficient * mieOpticalDepth * turbidity;
        vec3 totalExtinction = rayleighExtinction + vec3(mieExtinction);
        vec3 transmittance = exp(-totalExtinction);

        // Enhanced inscattering with better light integration
        vec3 inscattering = (rayleighScattering + vec3(mieScattering)) * sunIntensity;
        inscattering *= (1.0 - transmittance) / max(totalExtinction, 0.0001);

        // Improved sunset/sunrise coloring with atmospheric perspective
        float sunElevation = sunDir.y;
        float horizonFactor = 1.0 - abs(sunElevation);
        vec3 sunsetColor = vec3(1.0, 0.6, 0.2) * horizonFactor * max(0.0, cosTheta) * 0.3;

        // Add atmospheric glow near horizon
        float horizonGlow = pow(max(0.0, 1.0 - abs(viewDir.y)), 2.0) * 0.1;
        vec3 glowColor = vec3(0.8, 0.9, 1.0) * horizonGlow;

        vec3 finalColor = inscattering + sunsetColor + glowColor;

        // Apply tone mapping
        finalColor = toneMap(finalColor, exposure);

        // Enhanced alpha calculation with better falloff
        float viewAngle = dot(viewDir, normalize(vWorldPosition));
        float atmosphericThickness = (rayleighDensity + mieDensity * 0.1) * 0.6;
        float alpha = clamp(atmosphericThickness * (1.0 + viewAngle * 0.5), 0.0, 0.85);

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
