import { Scene, Vector3, Mesh, Texture, VertexData, ShaderMaterial, Effect } from '@babylonjs/core';
import { TileCoordinate, TileBounds } from './TileLoader';

/**
 * TerrainDetailRenderer enhances terrain with height maps, normal maps, and detail textures
 * Provides realistic terrain rendering with elevation data and surface details
 */
export class TerrainDetailRenderer {
  private _scene: Scene;
  private _earthRadius: number;
  private _isInitialized = false;

  // Detail rendering configuration
  private _detailConfig: DetailConfiguration = {
    enableHeightMaps: true,
    enableNormalMaps: true,
    enableDetailTextures: true,
    heightScale: 10000, // Maximum elevation in meters
    detailScale: 16, // Detail texture tiling
    normalStrength: 1.0,
    blendDistance: 1000,
  };

  // Texture providers
  private _heightMapProvider = 'https://cloud.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.png';
  private _normalMapProvider = 'https://cloud.maptiler.com/tiles/terrain-normals/{z}/{x}/{y}.png';
  private _detailTextureProvider = 'https://cloud.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg';

  // Shader materials cache
  private _terrainShaders: Map<string, ShaderMaterial> = new Map();
  private _detailTextures: Map<string, Texture> = new Map();

  constructor(scene: Scene, earthRadius: number) {
    this._scene = scene;
    this._earthRadius = earthRadius;
  }

  /**
   * Initialize the detail renderer
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // Register custom shaders
      this._registerTerrainShaders();

      // Load default detail textures
      await this._loadDefaultTextures();

      this._isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize TerrainDetailRenderer:', error);
      throw error;
    }
  }

  /**
   * Dispose of detail renderer resources
   */
  public dispose(): void {
    // Dispose shader materials
    this._terrainShaders.forEach(shader => shader.dispose());
    this._terrainShaders.clear();

    // Dispose detail textures
    this._detailTextures.forEach(texture => texture.dispose());
    this._detailTextures.clear();

    this._isInitialized = false;
  }

  /**
   * Create enhanced terrain mesh with height data
   */
  public createDetailedTerrain(
    name: string,
    bounds: TileBounds,
    heightData?: Float32Array,
    resolution = 64
  ): Mesh {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Generate vertices with height data
    for (let y = 0; y <= resolution; y++) {
      for (let x = 0; x <= resolution; x++) {
        // Calculate geographic coordinates
        const lon = bounds.west + (bounds.east - bounds.west) * (x / resolution);
        const lat = bounds.south + (bounds.north - bounds.south) * (y / resolution);

        // Get height from height data or default to 0
        let height = 0;
        if (heightData) {
          const heightIndex = y * (resolution + 1) + x;
          height = heightData[heightIndex] * this._detailConfig.heightScale;
        }

        // Convert to world coordinates with elevation
        const worldPos = this._geographicToWorld(lon, lat, height);
        positions.push(worldPos.x, worldPos.y, worldPos.z);

        // Calculate normal (will be recalculated after mesh creation)
        const normal = worldPos.normalize();
        normals.push(normal.x, normal.y, normal.z);

        // UV coordinates
        uvs.push(x / resolution, 1 - y / resolution);
      }
    }

    // Generate indices
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const i = y * (resolution + 1) + x;

        // Two triangles per quad
        indices.push(i, i + 1, i + resolution + 1);
        indices.push(i + 1, i + resolution + 2, i + resolution + 1);
      }
    }

    // Create mesh
    const mesh = new Mesh(name, this._scene);
    const vertexData = new VertexData();

    vertexData.positions = positions;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    vertexData.indices = indices;

    vertexData.applyToMesh(mesh);

    // Recalculate normals for proper lighting
    if (heightData) {
      this._calculateSmoothNormals(mesh, resolution);
    }

    return mesh;
  }

  /**
   * Create enhanced material with detail textures
   */
  public createDetailedMaterial(name: string, tileCoord: TileCoordinate, diffuseTexture?: Texture): ShaderMaterial {
    const material = new ShaderMaterial(
      name,
      this._scene,
      {
        vertex: 'terrainDetail',
        fragment: 'terrainDetail',
      },
      {
        attributes: ['position', 'normal', 'uv'],
        uniforms: [
          'world',
          'worldView',
          'worldViewProjection',
          'view',
          'projection',
          'cameraPosition',
          'heightScale',
          'detailScale',
          'normalStrength',
          'blendDistance',
        ],
        samplers: ['diffuseSampler', 'heightSampler', 'normalSampler', 'detailSampler'],
      }
    );

    // Set uniforms
    material.setFloat('heightScale', this._detailConfig.heightScale);
    material.setFloat('detailScale', this._detailConfig.detailScale);
    material.setFloat('normalStrength', this._detailConfig.normalStrength);
    material.setFloat('blendDistance', this._detailConfig.blendDistance);

    // Set textures
    if (diffuseTexture) {
      material.setTexture('diffuseSampler', diffuseTexture);
    }

    // Load and set additional textures
    this._loadTileTextures(tileCoord).then(textures => {
      if (textures.heightMap) {
        material.setTexture('heightSampler', textures.heightMap);
      }
      if (textures.normalMap) {
        material.setTexture('normalSampler', textures.normalMap);
      }
      if (textures.detailTexture) {
        material.setTexture('detailSampler', textures.detailTexture);
      }
    });

    return material;
  }

  /**
   * Load height data for a tile
   */
  public async loadHeightData(tileCoord: TileCoordinate): Promise<Float32Array | null> {
    if (!this._detailConfig.enableHeightMaps) {
      return null;
    }

    try {
      const url = this._getHeightMapUrl(tileCoord);
      const heightData = await this._loadHeightMapFromUrl(url);
      return heightData;
    } catch (error) {
      console.warn('Failed to load height data:', error);
      return null;
    }
  }

  /**
   * Configure detail rendering settings
   */
  public configure(config: Partial<DetailConfiguration>): void {
    this._detailConfig = { ...this._detailConfig, ...config };
  }

  /**
   * Set texture providers
   */
  public setTextureProviders(providers: Partial<TextureProviders>): void {
    if (providers.heightMap) {
      this._heightMapProvider = providers.heightMap;
    }
    if (providers.normalMap) {
      this._normalMapProvider = providers.normalMap;
    }
    if (providers.detailTexture) {
      this._detailTextureProvider = providers.detailTexture;
    }
  }

  /**
   * Get detail configuration
   */
  public get configuration(): DetailConfiguration {
    return { ...this._detailConfig };
  }

  /**
   * Register terrain shaders
   */
  private _registerTerrainShaders(): void {
    // Vertex shader
    const vertexShader = `
      precision highp float;

      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 uv;

      uniform mat4 worldViewProjection;
      uniform mat4 world;
      uniform vec3 cameraPosition;
      uniform float heightScale;

      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec2 vUV;
      varying vec3 vViewDirection;
      varying float vDistance;

      void main() {
        vec4 worldPosition = world * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vNormal = normalize((world * vec4(normal, 0.0)).xyz);
        vUV = uv;
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        vDistance = length(cameraPosition - worldPosition.xyz);

        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;

    // Fragment shader
    const fragmentShader = `
      precision highp float;

      uniform sampler2D diffuseSampler;
      uniform sampler2D heightSampler;
      uniform sampler2D normalSampler;
      uniform sampler2D detailSampler;

      uniform float detailScale;
      uniform float normalStrength;
      uniform float blendDistance;

      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec2 vUV;
      varying vec3 vViewDirection;
      varying float vDistance;

      vec3 calculateNormal(vec2 uv) {
        vec3 normal = texture2D(normalSampler, uv).rgb * 2.0 - 1.0;
        normal.xy *= normalStrength;
        return normalize(normal);
      }

      void main() {
        // Base diffuse color
        vec4 diffuseColor = texture2D(diffuseSampler, vUV);

        // Detail texture
        vec4 detailColor = texture2D(detailSampler, vUV * detailScale);

        // Blend detail based on distance
        float detailBlend = clamp(1.0 - (vDistance / blendDistance), 0.0, 1.0);
        vec4 finalColor = mix(diffuseColor, diffuseColor * detailColor, detailBlend);

        // Normal mapping
        vec3 normal = vNormal;
        if (normalStrength > 0.0) {
          vec3 mappedNormal = calculateNormal(vUV);
          // Simple normal blending (could be improved with proper tangent space)
          normal = normalize(mix(vNormal, mappedNormal, normalStrength));
        }

        // Simple lighting
        float lightIntensity = max(dot(normal, normalize(vec3(1.0, 1.0, 1.0))), 0.3);
        finalColor.rgb *= lightIntensity;

        gl_FragColor = finalColor;
      }
    `;

    // Register shaders
    Effect.ShadersStore['terrainDetailVertexShader'] = vertexShader;
    Effect.ShadersStore['terrainDetailFragmentShader'] = fragmentShader;
  }

  /**
   * Load default textures
   */
  private async _loadDefaultTextures(): Promise<void> {
    // Load default detail texture (could be a procedural texture)
    const defaultDetailTexture = this._createDefaultDetailTexture();
    this._detailTextures.set('default_detail', defaultDetailTexture);
  }

  /**
   * Create default detail texture
   */
  private _createDefaultDetailTexture(): Texture {
    const size = 256;
    const texture = new Texture(null, this._scene, false, false);

    // Create procedural detail texture
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Generate noise pattern
    const imageData = ctx.createImageData(size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const noise = Math.random() * 0.2 + 0.8;
      imageData.data[i] = noise * 255; // R
      imageData.data[i + 1] = noise * 255; // G
      imageData.data[i + 2] = noise * 255; // B
      imageData.data[i + 3] = 255; // A
    }

    ctx.putImageData(imageData, 0, 0);

    // Convert to texture
    texture.updateURL(canvas.toDataURL());
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;

    return texture;
  }

  /**
   * Load textures for a specific tile
   */
  private async _loadTileTextures(tileCoord: TileCoordinate): Promise<TileTextures> {
    const textures: TileTextures = {};

    try {
      // Load height map
      if (this._detailConfig.enableHeightMaps) {
        const heightUrl = this._getHeightMapUrl(tileCoord);
        textures.heightMap = new Texture(heightUrl, this._scene);
      }

      // Load normal map
      if (this._detailConfig.enableNormalMaps) {
        const normalUrl = this._getNormalMapUrl(tileCoord);
        textures.normalMap = new Texture(normalUrl, this._scene);
      }

      // Load detail texture
      if (this._detailConfig.enableDetailTextures) {
        const detailUrl = this._getDetailTextureUrl(tileCoord);
        textures.detailTexture = new Texture(detailUrl, this._scene);
      }
    } catch (error) {
      console.warn('Failed to load tile textures:', error);
    }

    return textures;
  }

  /**
   * Get height map URL for tile
   */
  private _getHeightMapUrl(tileCoord: TileCoordinate): string {
    return this._heightMapProvider
      .replace('{z}', tileCoord.z.toString())
      .replace('{x}', tileCoord.x.toString())
      .replace('{y}', tileCoord.y.toString());
  }

  /**
   * Get normal map URL for tile
   */
  private _getNormalMapUrl(tileCoord: TileCoordinate): string {
    return this._normalMapProvider
      .replace('{z}', tileCoord.z.toString())
      .replace('{x}', tileCoord.x.toString())
      .replace('{y}', tileCoord.y.toString());
  }

  /**
   * Get detail texture URL for tile
   */
  private _getDetailTextureUrl(tileCoord: TileCoordinate): string {
    return this._detailTextureProvider
      .replace('{z}', tileCoord.z.toString())
      .replace('{x}', tileCoord.x.toString())
      .replace('{y}', tileCoord.y.toString());
  }

  /**
   * Load height map data from URL
   */
  private async _loadHeightMapFromUrl(url: string): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const heightData = new Float32Array(img.width * img.height);

        // Convert RGB to height (assuming terrain-rgb format)
        for (let i = 0; i < heightData.length; i++) {
          const r = imageData.data[i * 4];
          const g = imageData.data[i * 4 + 1];
          const b = imageData.data[i * 4 + 2];

          // Terrain-rgb format: height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
          const height = -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
          heightData[i] = height / this._detailConfig.heightScale; // Normalize
        }

        resolve(heightData);
      };

      img.onerror = () => reject(new Error('Failed to load height map'));
      img.src = url;
    });
  }

  /**
   * Calculate smooth normals for terrain mesh
   */
  private _calculateSmoothNormals(mesh: Mesh, resolution: number): void {
    const positionsData = mesh.getVerticesData('position')!;
    const positions = positionsData instanceof Float32Array ? positionsData : new Float32Array(positionsData);
    const normals = new Float32Array(positions.length);

    // Calculate normals using cross product of adjacent vertices
    for (let y = 0; y <= resolution; y++) {
      for (let x = 0; x <= resolution; x++) {
        const index = (y * (resolution + 1) + x) * 3;

        // Get neighboring vertices for normal calculation
        const neighbors = this._getNeighborPositions(positions, x, y, resolution);

        // Calculate normal using cross product
        const normal = this._calculateVertexNormal(neighbors);

        normals[index] = normal.x;
        normals[index + 1] = normal.y;
        normals[index + 2] = normal.z;
      }
    }

    mesh.setVerticesData('normal', normals);
  }

  /**
   * Get neighbor positions for normal calculation
   */
  private _getNeighborPositions(positions: Float32Array, x: number, y: number, resolution: number): Vector3[] {
    const neighbors: Vector3[] = [];

    // Get valid neighboring vertices
    const offsets = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    for (const [dx, dy] of offsets) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx <= resolution && ny >= 0 && ny <= resolution) {
        const index = (ny * (resolution + 1) + nx) * 3;
        neighbors.push(new Vector3(positions[index], positions[index + 1], positions[index + 2]));
      }
    }

    return neighbors;
  }

  /**
   * Calculate vertex normal from neighbors
   */
  private _calculateVertexNormal(neighbors: Vector3[]): Vector3 {
    if (neighbors.length < 2) {
      return Vector3.Up();
    }

    let normal = Vector3.Zero();

    // Average normals from triangles formed by neighbors
    for (let i = 0; i < neighbors.length - 1; i++) {
      const v1 = neighbors[i];
      const v2 = neighbors[i + 1];

      const cross = Vector3.Cross(v1, v2);
      normal.addInPlace(cross);
    }

    return normal.normalize();
  }

  /**
   * Convert geographic coordinates to world coordinates
   */
  private _geographicToWorld(longitude: number, latitude: number, altitude: number): Vector3 {
    const lonRad = (longitude * Math.PI) / 180;
    const latRad = (latitude * Math.PI) / 180;
    const radius = this._earthRadius + altitude;

    const x = radius * Math.cos(latRad) * Math.cos(lonRad);
    const y = radius * Math.sin(latRad);
    const z = radius * Math.cos(latRad) * Math.sin(lonRad);

    return new Vector3(x, y, z);
  }
}

/**
 * Detail configuration interface
 */
export interface DetailConfiguration {
  enableHeightMaps: boolean;
  enableNormalMaps: boolean;
  enableDetailTextures: boolean;
  heightScale: number;
  detailScale: number;
  normalStrength: number;
  blendDistance: number;
}

/**
 * Texture providers interface
 */
export interface TextureProviders {
  heightMap: string;
  normalMap: string;
  detailTexture: string;
}

/**
 * Tile textures interface
 */
interface TileTextures {
  heightMap?: Texture;
  normalMap?: Texture;
  detailTexture?: Texture;
}
