import { Scene, Mesh, ShaderMaterial, Vector3, Color3, Texture, Effect, BackFaceCulling } from '@babylonjs/core';

/**
 * Night light renderer for displaying city lights and night-time effects on Earth
 */
export class NightLightRenderer {
  private _scene: Scene;
  private _earthRadius: number;
  private _nightLightMesh: Mesh | null = null;
  private _nightLightMaterial: ShaderMaterial | null = null;
  private _nightTexture: Texture | null = null;
  
  // Night light parameters
  private _intensity: number = 1.0;
  private _brightness: number = 0.8;
  private _cityLightColor: Color3 = new Color3(1.0, 0.9, 0.6); // Warm city light color
  private _fadeDistance: number = 0.1; // Distance for light fade effect
  private _minLightThreshold: number = 0.1; // Minimum light threshold
  private _maxLightThreshold: number = 0.9; // Maximum light threshold
  
  constructor(scene: Scene, earthRadius: number, options?: {
    intensity?: number;
    brightness?: number;
    cityLightColor?: Color3;
    fadeDistance?: number;
    minLightThreshold?: number;
    maxLightThreshold?: number;
  }) {
    this._scene = scene;
    this._earthRadius = earthRadius;
    
    if (options) {
      this._intensity = options.intensity ?? this._intensity;
      this._brightness = options.brightness ?? this._brightness;
      this._cityLightColor = options.cityLightColor ?? this._cityLightColor;
      this._fadeDistance = options.fadeDistance ?? this._fadeDistance;
      this._minLightThreshold = options.minLightThreshold ?? this._minLightThreshold;
      this._maxLightThreshold = options.maxLightThreshold ?? this._maxLightThreshold;
    }
  }
  
  /**
   * Initialize the night light renderer
   */
  public async initialize(): Promise<void> {
    // Register night light shader
    this._registerNightLightShader();
    
    // Create night light mesh and material
    this._createNightLightMesh();
    this._createNightLightMaterial();
    
    // Load night texture (city lights)
    await this._loadNightTexture();
  }
  
  /**
   * Dispose of all resources
   */
  public dispose(): void {
    if (this._nightLightMesh) {
      this._nightLightMesh.dispose();
      this._nightLightMesh = null;
    }
    
    if (this._nightLightMaterial) {
      this._nightLightMaterial.dispose();
      this._nightLightMaterial = null;
    }
    
    if (this._nightTexture) {
      this._nightTexture.dispose();
      this._nightTexture = null;
    }
  }
  
  /**
   * Update night light rendering
   */
  public update(cameraPosition: Vector3, sunDirection: Vector3): void {
    if (!this._nightLightMaterial) {
      return;
    }
    
    // Calculate sun angle for day/night transition
    const sunAngle = Math.acos(Math.max(-1, Math.min(1, sunDirection.y)));
    const nightFactor = Math.max(0, Math.min(1, (sunAngle - Math.PI * 0.4) / (Math.PI * 0.2)));
    
    // Update shader uniforms
    this._nightLightMaterial.setVector3('cameraPosition', cameraPosition);
    this._nightLightMaterial.setVector3('sunDirection', sunDirection.normalize());
    this._nightLightMaterial.setFloat('nightFactor', nightFactor);
    this._nightLightMaterial.setFloat('intensity', this._intensity);
    this._nightLightMaterial.setFloat('brightness', this._brightness);
    this._nightLightMaterial.setColor3('cityLightColor', this._cityLightColor);
    this._nightLightMaterial.setFloat('fadeDistance', this._fadeDistance);
    this._nightLightMaterial.setFloat('minLightThreshold', this._minLightThreshold);
    this._nightLightMaterial.setFloat('maxLightThreshold', this._maxLightThreshold);
    this._nightLightMaterial.setFloat('earthRadius', this._earthRadius);
    
    // Set mesh visibility based on night factor
    if (this._nightLightMesh) {
      this._nightLightMesh.visibility = nightFactor;
    }
  }
  
  /**
   * Register the night light shader
   */
  private _registerNightLightShader(): void {
    const vertexShader = `
      precision highp float;
      
      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 uv;
      
      uniform mat4 worldViewProjection;
      uniform mat4 world;
      uniform vec3 cameraPosition;
      uniform vec3 sunDirection;
      uniform float earthRadius;
      
      varying vec2 vUV;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying float vSunDot;
      varying float vViewAngle;
      
      void main() {
        vec4 worldPos = world * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vNormal = normalize((world * vec4(normal, 0.0)).xyz);
        vUV = uv;
        
        // Calculate sun dot product for day/night transition
        vSunDot = dot(vNormal, -sunDirection);
        
        // Calculate view angle for atmospheric perspective
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vViewAngle = dot(vNormal, viewDir);
        
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;
    
    const fragmentShader = `
      precision highp float;
      
      uniform sampler2D nightTexture;
      uniform vec3 sunDirection;
      uniform float nightFactor;
      uniform float intensity;
      uniform float brightness;
      uniform vec3 cityLightColor;
      uniform float fadeDistance;
      uniform float minLightThreshold;
      uniform float maxLightThreshold;
      
      varying vec2 vUV;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying float vSunDot;
      varying float vViewAngle;
      
      void main() {
        // Sample night texture (city lights)
        vec4 nightColor = texture2D(nightTexture, vUV);
        
        // Calculate night intensity based on sun position
        float nightIntensity = smoothstep(minLightThreshold, maxLightThreshold, -vSunDot);
        
        // Apply atmospheric perspective
        float atmosphericFade = smoothstep(0.0, fadeDistance, vViewAngle);
        
        // Combine city light color with texture
        vec3 finalColor = nightColor.rgb * cityLightColor * intensity * brightness;
        
        // Apply night factor and atmospheric fade
        finalColor *= nightIntensity * atmosphericFade * nightFactor;
        
        // Add glow effect for brighter areas
        float glow = smoothstep(0.3, 1.0, nightColor.r);
        finalColor += glow * cityLightColor * 0.3 * nightFactor;
        
        gl_FragColor = vec4(finalColor, nightColor.a * nightIntensity * nightFactor);
      }
    `;
    
    Effect.ShadersStore['nightLightVertexShader'] = vertexShader;
    Effect.ShadersStore['nightLightFragmentShader'] = fragmentShader;
  }
  
  /**
   * Create the night light mesh
   */
  private _createNightLightMesh(): void {
    // Create a sphere slightly larger than Earth for night lights
    const diameter = (this._earthRadius + 0.01) * 2;
    this._nightLightMesh = Mesh.CreateSphere('nightLightMesh', 64, diameter, this._scene);
    
    // Set rendering properties
    this._nightLightMesh.renderingGroupId = 2; // Render after atmosphere
    this._nightLightMesh.material = null;
  }
  
  /**
   * Create the night light material
   */
  private _createNightLightMaterial(): void {
    this._nightLightMaterial = new ShaderMaterial(
      'nightLightMaterial',
      this._scene,
      'nightLight',
      {
        attributes: ['position', 'normal', 'uv'],
        uniforms: [
          'worldViewProjection', 'world',
          'cameraPosition', 'sunDirection', 'nightFactor',
          'intensity', 'brightness', 'cityLightColor',
          'fadeDistance', 'minLightThreshold', 'maxLightThreshold',
          'earthRadius', 'nightTexture'
        ]
      }
    );
    
    // Set material properties for proper blending
    this._nightLightMaterial.backFaceCulling = BackFaceCulling.Front;
    this._nightLightMaterial.transparencyMode = 2; // Alpha blend
    this._nightLightMaterial.alphaMode = 7; // Alpha blend
    
    // Apply material to mesh
    if (this._nightLightMesh) {
      this._nightLightMesh.material = this._nightLightMaterial;
    }
  }
  
  /**
   * Load night texture (city lights)
   */
  private async _loadNightTexture(): Promise<void> {
    try {
      // Try to load night texture from resources
      this._nightTexture = new Texture('res/night.png', this._scene);
      
      // Set texture to material when loaded
      this._nightTexture.onLoadObservable.add(() => {
        if (this._nightLightMaterial && this._nightTexture) {
          this._nightLightMaterial.setTexture('nightTexture', this._nightTexture);
        }
      });
      
    } catch (error) {
      console.warn('Failed to load night texture, using fallback:', error);
      
      // Create a simple procedural night texture as fallback
      this._createFallbackNightTexture();
    }
  }
  
  /**
   * Create a fallback night texture
   */
  private _createFallbackNightTexture(): void {
    // Create a simple procedural texture for city lights
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Fill with black background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, size, size);
    
    // Add random city lights
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const brightness = Math.random() * 0.8 + 0.2;
      const radius = Math.random() * 2 + 1;
      
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(255, 240, 180, ${brightness})`);
      gradient.addColorStop(1, 'rgba(255, 240, 180, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Create texture from canvas
    this._nightTexture = new Texture(canvas.toDataURL(), this._scene);
    
    if (this._nightLightMaterial) {
      this._nightLightMaterial.setTexture('nightTexture', this._nightTexture);
    }
  }
  
  // Public setters for runtime configuration
  
  /**
   * Set night light intensity
   */
  public setIntensity(intensity: number): void {
    this._intensity = Math.max(0, intensity);
  }
  
  /**
   * Set night light brightness
   */
  public setBrightness(brightness: number): void {
    this._brightness = Math.max(0, brightness);
  }
  
  /**
   * Set city light color
   */
  public setCityLightColor(color: Color3): void {
    this._cityLightColor = color;
  }
  
  /**
   * Set light thresholds
   */
  public setLightThresholds(min: number, max: number): void {
    this._minLightThreshold = Math.max(0, Math.min(1, min));
    this._maxLightThreshold = Math.max(0, Math.min(1, max));
  }
  
  // Getters
  
  /**
   * Get the night light mesh
   */
  public get nightLightMesh(): Mesh | null {
    return this._nightLightMesh;
  }
  
  /**
   * Get current intensity
   */
  public get intensity(): number {
    return this._intensity;
  }
  
  /**
   * Get current brightness
   */
  public get brightness(): number {
    return this._brightness;
  }
}