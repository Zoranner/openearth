import { Scene, Vector3, Mesh, StandardMaterial, Texture, VertexData, Color3 } from '@babylonjs/core';

/**
 * TileLoader manages loading and rendering of map tiles
 * Uses Babylon.js architecture for efficient tile management
 */
export class TileLoader {
  private _scene: Scene;
  private _earthRadius: number;
  private _isInitialized: boolean = false;
  private _activeTiles: Map<string, TileData> = new Map();
  private _tileCache: Map<string, TileData> = new Map();
  private _maxCacheSize: number = 100;
  private _currentLOD: number = 0;
  private _maxLOD: number = 18;

  // Tile configuration
  private _tileSize: number = 256;
  private _baseUrl: string = 'https://tile.openstreetmap.org'; // Default OSM tiles

  constructor(scene: Scene, earthRadius: number, options: TileLoaderOptions = {}) {
    this._scene = scene;
    this._earthRadius = earthRadius;
    this._maxCacheSize = options.maxCacheSize ?? this._maxCacheSize;
    this._maxLOD = options.maxLOD ?? this._maxLOD;
    this._tileSize = options.tileSize ?? this._tileSize;
    this._baseUrl = options.baseUrl ?? this._baseUrl;
  }

  /**
   * Initialize the tile loader
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // Load initial tiles (world view)
      await this._loadInitialTiles();
      
      this._isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize TileLoader:', error);
      throw error;
    }
  }

  /**
   * Dispose of tile loader resources
   */
  public dispose(): void {
    // Dispose all active tiles
    this._activeTiles.forEach(tile => {
      tile.mesh?.dispose();
      tile.material?.dispose();
      tile.texture?.dispose();
    });
    this._activeTiles.clear();

    // Dispose cached tiles
    this._tileCache.forEach(tile => {
      tile.mesh?.dispose();
      tile.material?.dispose();
      tile.texture?.dispose();
    });
    this._tileCache.clear();

    this._isInitialized = false;
  }

  /**
   * Update tiles based on camera position
   */
  public update(cameraPosition: Vector3): void {
    if (!this._isInitialized) {
      return;
    }

    // Calculate required LOD based on camera distance
    const distanceFromCenter = cameraPosition.length();
    const altitude = distanceFromCenter - this._earthRadius;
    const requiredLOD = this._calculateLOD(altitude);

    // Update tiles if LOD changed significantly
    if (Math.abs(requiredLOD - this._currentLOD) >= 1) {
      this._currentLOD = requiredLOD;
      this._updateVisibleTiles(cameraPosition);
    }
  }

  /**
   * Load tiles within specific bounds
   */
  public async loadTilesInBounds(bounds: TileBounds): Promise<void> {
    const tiles = this._calculateTilesInBounds(bounds);
    
    for (const tileCoord of tiles) {
      await this._loadTile(tileCoord.x, tileCoord.y, tileCoord.z);
    }
  }

  /**
   * Set tile provider URL
   */
  public setTileProvider(baseUrl: string): void {
    this._baseUrl = baseUrl;
    // Clear cache when provider changes
    this._clearCache();
  }

  /**
   * Get active tile count
   */
  public get activeTileCount(): number {
    return this._activeTiles.size;
  }

  /**
   * Get cached tile count
   */
  public get cachedTileCount(): number {
    return this._tileCache.size;
  }

  /**
   * Load initial tiles for world view
   */
  private async _loadInitialTiles(): Promise<void> {
    // Load level 0 tiles (4 tiles covering the world)
    const initialTiles = [
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 1 },
      { x: 0, y: 1, z: 1 },
      { x: 1, y: 1, z: 1 }
    ];

    for (const tile of initialTiles) {
      await this._loadTile(tile.x, tile.y, tile.z);
    }
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
   * Update visible tiles based on camera position
   */
  private _updateVisibleTiles(cameraPosition: Vector3): void {
    // Convert camera position to geographic coordinates
    const geographic = this._worldToGeographic(cameraPosition);
    
    // Calculate visible tile range
    const visibleTiles = this._calculateVisibleTiles(geographic.longitude, geographic.latitude, this._currentLOD);
    
    // Load new tiles
    visibleTiles.forEach(async (tileCoord) => {
      await this._loadTile(tileCoord.x, tileCoord.y, tileCoord.z);
    });
    
    // Remove distant tiles
    this._cullDistantTiles(geographic);
  }

  /**
   * Load a specific tile
   */
  private async _loadTile(x: number, y: number, z: number): Promise<void> {
    const tileKey = `${x}_${y}_${z}`;
    
    // Check if tile is already active
    if (this._activeTiles.has(tileKey)) {
      return;
    }
    
    // Check cache first
    if (this._tileCache.has(tileKey)) {
      const cachedTile = this._tileCache.get(tileKey)!;
      this._activeTiles.set(tileKey, cachedTile);
      this._tileCache.delete(tileKey);
      
      // Show the mesh
      if (cachedTile.mesh) {
        cachedTile.mesh.setEnabled(true);
      }
      return;
    }
    
    try {
      // Create tile data
      const tileData = await this._createTile(x, y, z);
      
      if (tileData) {
        this._activeTiles.set(tileKey, tileData);
      }
    } catch (error) {
      console.warn(`Failed to load tile ${tileKey}:`, error);
    }
  }

  /**
   * Create a tile mesh and load its texture
   */
  private async _createTile(x: number, y: number, z: number): Promise<TileData | null> {
    try {
      // Calculate tile bounds
      const bounds = this._calculateTileBounds(x, y, z);
      
      // Create tile mesh
      const mesh = this._createTileMesh(`tile_${x}_${y}_${z}`, bounds);
      
      // Create material
      const material = new StandardMaterial(`tileMaterial_${x}_${y}_${z}`, this._scene);
      
      // Load tile texture
      const textureUrl = this._getTileUrl(x, y, z);
      const texture = await this._loadTileTexture(textureUrl);
      
      if (texture) {
        material.diffuseTexture = texture;
      } else {
        // Use default color if texture fails to load
        material.diffuseColor = new Color3(0.6, 0.4, 0.2);
      }
      
      mesh.material = material;
      
      return {
        x, y, z,
        bounds,
        mesh,
        material,
        texture
      };
    } catch (error) {
      console.error(`Failed to create tile ${x}_${y}_${z}:`, error);
      return null;
    }
  }

  /**
   * Create mesh geometry for a tile
   */
  private _createTileMesh(name: string, bounds: TileBounds): Mesh {
    const resolution = 32; // Vertices per side
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
        
        // Convert to world coordinates (on sphere surface)
        const worldPos = this._geographicToWorld(lon, lat, 0);
        positions.push(worldPos.x, worldPos.y, worldPos.z);
        
        // Normal points outward from sphere center
        const normal = worldPos.normalize();
        normals.push(normal.x, normal.y, normal.z);
        
        // UV coordinates
        uvs.push(x / resolution, 1 - y / resolution); // Flip Y for correct texture orientation
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
    
    return mesh;
  }

  /**
   * Load tile texture from URL
   */
  private async _loadTileTexture(url: string): Promise<Texture | null> {
    try {
      const texture = new Texture(url, this._scene);
      
      // Wait for texture to load
      await new Promise<void>((resolve, reject) => {
        texture.onLoadObservable.add(() => resolve());
        texture.onErrorObservable.add(() => reject(new Error(`Failed to load texture: ${url}`)));
        
        // Set a timeout to avoid hanging
        setTimeout(() => reject(new Error('Texture load timeout')), 10000);
      });
      
      return texture;
    } catch (error) {
      console.warn(`Failed to load tile texture ${url}:`, error);
      return null;
    }
  }

  /**
   * Get tile URL for given coordinates
   */
  private _getTileUrl(x: number, y: number, z: number): string {
    return `${this._baseUrl}/${z}/${x}/${y}.png`;
  }

  /**
   * Calculate tile bounds for given coordinates
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
   * Calculate tiles within bounds
   */
  private _calculateTilesInBounds(bounds: TileBounds): TileCoordinate[] {
    const tiles: TileCoordinate[] = [];
    const z = bounds.level;
    const n = Math.pow(2, z);
    
    const minX = Math.floor((bounds.west + 180) / 360 * n);
    const maxX = Math.floor((bounds.east + 180) / 360 * n);
    const minY = Math.floor((1 - Math.log(Math.tan(bounds.north * Math.PI / 180) + 1 / Math.cos(bounds.north * Math.PI / 180)) / Math.PI) / 2 * n);
    const maxY = Math.floor((1 - Math.log(Math.tan(bounds.south * Math.PI / 180) + 1 / Math.cos(bounds.south * Math.PI / 180)) / Math.PI) / 2 * n);
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ x, y, z });
      }
    }
    
    return tiles;
  }

  /**
   * Calculate visible tiles around a geographic point
   */
  private _calculateVisibleTiles(longitude: number, latitude: number, lod: number): TileCoordinate[] {
    const tiles: TileCoordinate[] = [];
    const n = Math.pow(2, lod);
    
    // Calculate center tile
    const centerX = Math.floor((longitude + 180) / 360 * n);
    const centerY = Math.floor((1 - Math.log(Math.tan(latitude * Math.PI / 180) + 1 / Math.cos(latitude * Math.PI / 180)) / Math.PI) / 2 * n);
    
    // Calculate range based on LOD
    const range = Math.max(1, Math.floor(8 / Math.pow(2, Math.max(0, lod - 8))));
    
    for (let x = centerX - range; x <= centerX + range; x++) {
      for (let y = centerY - range; y <= centerY + range; y++) {
        if (x >= 0 && x < n && y >= 0 && y < n) {
          tiles.push({ x, y, z: lod });
        }
      }
    }
    
    return tiles;
  }

  /**
   * Remove tiles that are too far from camera
   */
  private _cullDistantTiles(cameraGeographic: { longitude: number; latitude: number }): void {
    const tilesToRemove: string[] = [];
    
    this._activeTiles.forEach((tile, key) => {
      // Calculate distance from camera to tile center
      const tileCenterLon = (tile.bounds.west + tile.bounds.east) / 2;
      const tileCenterLat = (tile.bounds.south + tile.bounds.north) / 2;
      
      const distance = Math.sqrt(
        Math.pow(tileCenterLon - cameraGeographic.longitude, 2) +
        Math.pow(tileCenterLat - cameraGeographic.latitude, 2)
      );
      
      // Remove if too far or wrong LOD
      const maxDistance = 20 / Math.pow(2, Math.max(0, this._currentLOD - 6));
      if (distance > maxDistance || tile.z !== this._currentLOD) {
        tilesToRemove.push(key);
      }
    });
    
    // Move distant tiles to cache or dispose
    tilesToRemove.forEach(key => {
      const tile = this._activeTiles.get(key);
      if (tile) {
        this._activeTiles.delete(key);
        
        // Hide the mesh
        if (tile.mesh) {
          tile.mesh.setEnabled(false);
        }
        
        // Add to cache if there's space
        if (this._tileCache.size < this._maxCacheSize) {
          this._tileCache.set(key, tile);
        } else {
          // Dispose if cache is full
          tile.mesh?.dispose();
          tile.material?.dispose();
          tile.texture?.dispose();
        }
      }
    });
  }

  /**
   * Clear tile cache
   */
  private _clearCache(): void {
    this._tileCache.forEach(tile => {
      tile.mesh?.dispose();
      tile.material?.dispose();
      tile.texture?.dispose();
    });
    this._tileCache.clear();
  }

  /**
   * Convert world coordinates to geographic coordinates
   */
  private _worldToGeographic(worldPos: Vector3): { longitude: number; latitude: number; altitude: number } {
    const distance = worldPos.length();
    const altitude = distance - this._earthRadius;
    
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
    const radius = this._earthRadius + altitude;
    
    const x = radius * Math.cos(latRad) * Math.cos(lonRad);
    const y = radius * Math.sin(latRad);
    const z = radius * Math.cos(latRad) * Math.sin(lonRad);
    
    return new Vector3(x, y, z);
  }
}

/**
 * Tile loader configuration options
 */
export interface TileLoaderOptions {
  /** Maximum number of tiles to cache */
  maxCacheSize?: number;
  /** Maximum level of detail */
  maxLOD?: number;
  /** Tile size in pixels */
  tileSize?: number;
  /** Base URL for tile provider */
  baseUrl?: string;
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
 * Tile coordinate definition
 */
export interface TileCoordinate {
  x: number;
  y: number;
  z: number;
}

/**
 * Tile data structure
 */
interface TileData {
  x: number;
  y: number;
  z: number;
  bounds: TileBounds;
  mesh: Mesh | null;
  material: StandardMaterial | null;
  texture: Texture | null;
}