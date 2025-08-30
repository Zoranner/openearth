import { Scene, Mesh, VertexData, Material, StandardMaterial, Texture, Vector3, Color3 } from '@babylonjs/core';

/**
 * TerrainSystem manages terrain data loading, processing and rendering
 */
export class TerrainSystem {
  private _scene: Scene;
  private _isInitialized: boolean = false;
  private _terrainMeshes: Map<string, Mesh> = new Map();
  private _materials: Map<string, Material> = new Map();
  private _tileSize: number = 256;
  private _maxLOD: number = 18;
  private _planetRadius: number = 6378137; // Earth radius in meters

  // Terrain data providers
  private _elevationProvider: ElevationProvider | null = null;
  private _imageryProvider: ImageryProvider | null = null;

  constructor(scene: Scene, options: TerrainOptions = {}) {
    this._scene = scene;
    this._tileSize = options.tileSize ?? this._tileSize;
    this._maxLOD = options.maxLOD ?? this._maxLOD;
    this._planetRadius = options.planetRadius ?? this._planetRadius;
  }

  /**
   * Initialize the terrain system
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // Initialize default providers
      this._elevationProvider = new DefaultElevationProvider();
      this._imageryProvider = new DefaultImageryProvider();

      // Create base planet mesh
      await this._createBasePlanet();

      this._isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize TerrainSystem:', error);
      throw error;
    }
  }

  /**
   * Dispose of terrain system resources
   */
  public dispose(): void {
    // Dispose all terrain meshes
    this._terrainMeshes.forEach(mesh => {
      mesh.dispose();
    });
    this._terrainMeshes.clear();

    // Dispose all materials
    this._materials.forEach(material => {
      material.dispose();
    });
    this._materials.clear();

    this._elevationProvider?.dispose();
    this._imageryProvider?.dispose();
    
    this._isInitialized = false;
  }

  /**
   * Update terrain based on camera position
   */
  public update(cameraPosition: Vector3): void {
    if (!this._isInitialized) {
      return;
    }

    // Calculate required LOD based on camera distance
    const distanceFromCenter = cameraPosition.length();
    const altitude = distanceFromCenter - this._planetRadius;
    const requiredLOD = this._calculateLOD(altitude);

    // Update terrain tiles based on camera position and LOD
    this._updateTerrainTiles(cameraPosition, requiredLOD);
  }

  /**
   * Set elevation data provider
   */
  public setElevationProvider(provider: ElevationProvider): void {
    this._elevationProvider?.dispose();
    this._elevationProvider = provider;
  }

  /**
   * Set imagery data provider
   */
  public setImageryProvider(provider: ImageryProvider): void {
    this._imageryProvider?.dispose();
    this._imageryProvider = provider;
  }

  /**
   * Get terrain height at geographic coordinates
   */
  public async getHeightAt(longitude: number, latitude: number): Promise<number> {
    if (!this._elevationProvider) {
      return 0;
    }

    return this._elevationProvider.getElevation(longitude, latitude);
  }

  /**
   * Create terrain tile for specific coordinates and LOD
   */
  public async createTerrainTile(x: number, y: number, z: number): Promise<Mesh | null> {
    try {
      const tileKey = `${x}_${y}_${z}`;
      
      // Check if tile already exists
      if (this._terrainMeshes.has(tileKey)) {
        return this._terrainMeshes.get(tileKey)!;
      }

      // Generate tile bounds
      const bounds = this._calculateTileBounds(x, y, z);
      
      // Get elevation data
      const elevationData = await this._elevationProvider?.getElevationTile(bounds);
      
      // Get imagery data
      const imageryData = await this._imageryProvider?.getImageryTile(bounds);
      
      // Create mesh geometry
      const mesh = this._createTileMesh(tileKey, bounds, elevationData, imageryData);
      
      if (mesh) {
        this._terrainMeshes.set(tileKey, mesh);
      }
      
      return mesh;
    } catch (error) {
      console.error(`Failed to create terrain tile ${x}_${y}_${z}:`, error);
      return null;
    }
  }

  /**
   * Remove terrain tile
   */
  public removeTerrainTile(x: number, y: number, z: number): void {
    const tileKey = `${x}_${y}_${z}`;
    const mesh = this._terrainMeshes.get(tileKey);
    
    if (mesh) {
      mesh.dispose();
      this._terrainMeshes.delete(tileKey);
    }
  }

  /**
   * Get all active terrain tiles
   */
  public getActiveTiles(): Mesh[] {
    return Array.from(this._terrainMeshes.values());
  }

  /**
   * Create base planet mesh (low-resolution sphere)
   */
  private async _createBasePlanet(): Promise<void> {
    const sphere = Mesh.CreateSphere('basePlanet', 32, this._planetRadius * 2, this._scene);
    
    // Create basic material
    const material = new StandardMaterial('basePlanetMaterial', this._scene);
    material.diffuseColor = new Color3(0.3, 0.5, 0.8); // Ocean blue
    material.specularColor = new Color3(0.1, 0.1, 0.1);
    
    sphere.material = material;
    this._terrainMeshes.set('basePlanet', sphere);
    this._materials.set('basePlanetMaterial', material);
  }

  /**
   * Calculate required LOD based on altitude
   */
  private _calculateLOD(altitude: number): number {
    // Simple LOD calculation - closer = higher detail
    const normalizedAltitude = Math.log10(Math.max(altitude, 1000)) / Math.log10(20000000);
    const lod = Math.floor((1 - normalizedAltitude) * this._maxLOD);
    return Math.max(0, Math.min(this._maxLOD, lod));
  }

  /**
   * Update terrain tiles based on camera position and LOD
   */
  private _updateTerrainTiles(cameraPosition: Vector3, requiredLOD: number): void {
    // Convert camera position to geographic coordinates
    const geographic = this._worldToGeographic(cameraPosition);
    
    // Calculate visible tile range
    const tileRange = this._calculateVisibleTiles(geographic.longitude, geographic.latitude, requiredLOD);
    
    // Load required tiles
    for (let x = tileRange.minX; x <= tileRange.maxX; x++) {
      for (let y = tileRange.minY; y <= tileRange.maxY; y++) {
        this.createTerrainTile(x, y, requiredLOD);
      }
    }
    
    // Remove distant tiles to manage memory
    this._cullDistantTiles(geographic, requiredLOD);
  }

  /**
   * Calculate tile bounds for given tile coordinates
   */
  private _calculateTileBounds(x: number, y: number, z: number): TileBounds {
    const n = Math.pow(2, z);
    const lonMin = (x / n) * 360 - 180;
    const lonMax = ((x + 1) / n) * 360 - 180;
    const latMin = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
    const latMax = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
    
    return {
      west: lonMin,
      east: lonMax,
      south: latMin,
      north: latMax,
      level: z
    };
  }

  /**
   * Create mesh for terrain tile
   */
  private _createTileMesh(
    tileKey: string,
    bounds: TileBounds,
    elevationData?: ElevationTile,
    imageryData?: ImageryTile
  ): Mesh | null {
    try {
      // Create vertex data
      const vertexData = this._generateTileVertices(bounds, elevationData);
      
      // Create mesh
      const mesh = new Mesh(tileKey, this._scene);
      vertexData.applyToMesh(mesh);
      
      // Create and apply material
      const material = this._createTileMaterial(tileKey, imageryData);
      mesh.material = material;
      
      return mesh;
    } catch (error) {
      console.error(`Failed to create tile mesh ${tileKey}:`, error);
      return null;
    }
  }

  /**
   * Generate vertices for terrain tile
   */
  private _generateTileVertices(bounds: TileBounds, elevationData?: ElevationTile): VertexData {
    const resolution = this._tileSize;
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    
    // Generate vertices
    for (let y = 0; y <= resolution; y++) {
      for (let x = 0; x <= resolution; x++) {
        // Calculate geographic coordinates
        const lon = bounds.west + (bounds.east - bounds.west) * (x / resolution);
        const lat = bounds.south + (bounds.north - bounds.south) * (y / resolution);
        
        // Get elevation
        const elevation = elevationData?.getElevationAt(x, y) ?? 0;
        
        // Convert to world coordinates
        const worldPos = this._geographicToWorld(lon, lat, elevation);
        positions.push(worldPos.x, worldPos.y, worldPos.z);
        
        // Calculate normal (simplified - pointing outward from planet center)
        const normal = worldPos.normalize();
        normals.push(normal.x, normal.y, normal.z);
        
        // UV coordinates
        uvs.push(x / resolution, y / resolution);
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
    
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    vertexData.indices = indices;
    
    return vertexData;
  }

  /**
   * Create material for terrain tile
   */
  private _createTileMaterial(tileKey: string, imageryData?: ImageryTile): Material {
    const materialKey = `${tileKey}_material`;
    
    // Check if material already exists
    if (this._materials.has(materialKey)) {
      return this._materials.get(materialKey)!;
    }
    
    const material = new StandardMaterial(materialKey, this._scene);
    
    if (imageryData?.texture) {
      material.diffuseTexture = imageryData.texture;
    } else {
      // Default terrain color
      material.diffuseColor = new Color3(0.6, 0.4, 0.2); // Brown earth
    }
    
    this._materials.set(materialKey, material);
    return material;
  }

  /**
   * Convert world coordinates to geographic coordinates
   */
  private _worldToGeographic(worldPos: Vector3): { longitude: number; latitude: number; altitude: number } {
    const distance = worldPos.length();
    const altitude = distance - this._planetRadius;
    
    const longitude = Math.atan2(worldPos.z, worldPos.x) * 180 / Math.PI;
    const latitude = Math.asin(worldPos.y / distance) * 180 / Math.PI;
    
    return { longitude, latitude, altitude };
  }

  /**
   * Convert geographic coordinates to world coordinates
   */
  private _geographicToWorld(longitude: number, latitude: number, altitude: number): Vector3 {
    const lonRad = longitude * Math.PI / 180;
    const latRad = latitude * Math.PI / 180;
    const radius = this._planetRadius + altitude;
    
    const x = radius * Math.cos(latRad) * Math.cos(lonRad);
    const y = radius * Math.sin(latRad);
    const z = radius * Math.cos(latRad) * Math.sin(lonRad);
    
    return new Vector3(x, y, z);
  }

  /**
   * Calculate visible tiles for given position and LOD
   */
  private _calculateVisibleTiles(longitude: number, latitude: number, lod: number): TileRange {
    // Simple implementation - calculate tiles around camera position
    const tilesPerSide = Math.pow(2, lod);
    const tileX = Math.floor((longitude + 180) / 360 * tilesPerSide);
    const tileY = Math.floor((90 - latitude) / 180 * tilesPerSide);
    
    const range = Math.max(1, Math.floor(4 / Math.pow(2, Math.max(0, lod - 10))));
    
    return {
      minX: Math.max(0, tileX - range),
      maxX: Math.min(tilesPerSide - 1, tileX + range),
      minY: Math.max(0, tileY - range),
      maxY: Math.min(tilesPerSide - 1, tileY + range)
    };
  }

  /**
   * Remove tiles that are too far from camera
   */
  private _cullDistantTiles(cameraGeographic: { longitude: number; latitude: number }, currentLOD: number): void {
    const tilesToRemove: string[] = [];
    
    this._terrainMeshes.forEach((mesh, key) => {
      if (key === 'basePlanet') return; // Don't cull base planet
      
      // Parse tile coordinates from key
      const [x, y, z] = key.split('_').map(Number);
      
      // Check if tile is still needed
      if (z !== currentLOD) {
        tilesToRemove.push(key);
        return;
      }
      
      // Check distance from camera
      const tileBounds = this._calculateTileBounds(x, y, z);
      const tileCenterLon = (tileBounds.west + tileBounds.east) / 2;
      const tileCenterLat = (tileBounds.south + tileBounds.north) / 2;
      
      const distance = Math.sqrt(
        Math.pow(tileCenterLon - cameraGeographic.longitude, 2) +
        Math.pow(tileCenterLat - cameraGeographic.latitude, 2)
      );
      
      // Remove if too far (adjust threshold as needed)
      const maxDistance = 10 / Math.pow(2, Math.max(0, currentLOD - 8));
      if (distance > maxDistance) {
        tilesToRemove.push(key);
      }
    });
    
    // Remove distant tiles
    tilesToRemove.forEach(key => {
      const mesh = this._terrainMeshes.get(key);
      if (mesh) {
        mesh.dispose();
        this._terrainMeshes.delete(key);
      }
    });
  }
}

/**
 * Terrain system configuration options
 */
export interface TerrainOptions {
  /** Tile size in pixels */
  tileSize?: number;
  /** Maximum level of detail */
  maxLOD?: number;
  /** Planet radius in meters */
  planetRadius?: number;
}

/**
 * Tile bounds definition
 */
export interface TileBounds {
  west: number;
  east: number;
  south: number;
  north: number;
  level: number;
}

/**
 * Tile range definition
 */
export interface TileRange {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Elevation data provider interface
 */
export interface ElevationProvider {
  getElevation(longitude: number, latitude: number): Promise<number>;
  getElevationTile(bounds: TileBounds): Promise<ElevationTile | undefined>;
  dispose(): void;
}

/**
 * Imagery data provider interface
 */
export interface ImageryProvider {
  getImageryTile(bounds: TileBounds): Promise<ImageryTile | undefined>;
  dispose(): void;
}

/**
 * Elevation tile data
 */
export interface ElevationTile {
  data: Float32Array;
  width: number;
  height: number;
  getElevationAt(x: number, y: number): number;
}

/**
 * Imagery tile data
 */
export interface ImageryTile {
  texture: Texture;
  bounds: TileBounds;
}

/**
 * Default elevation provider (returns zero elevation)
 */
class DefaultElevationProvider implements ElevationProvider {
  async getElevation(): Promise<number> {
    return 0;
  }
  
  async getElevationTile(): Promise<ElevationTile | undefined> {
    return undefined;
  }
  
  dispose(): void {
    // Nothing to dispose
  }
}

/**
 * Default imagery provider (returns no texture)
 */
class DefaultImageryProvider implements ImageryProvider {
  async getImageryTile(): Promise<ImageryTile | undefined> {
    return undefined;
  }
  
  dispose(): void {
    // Nothing to dispose
  }
}