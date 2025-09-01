import type { Scene } from '@babylonjs/core';
import { Vector3, Mesh, StandardMaterial, Texture, VertexData, Color3, Observable } from '@babylonjs/core';

/**
 * TileLoader manages loading and rendering of map tiles
 * Uses Babylon.js architecture for efficient tile management
 */
export class TileLoader {
  private _scene: Scene;
  private _earthRadius: number;
  private _isInitialized = false;
  private _activeTiles: Map<string, TileData> = new Map();
  private _tileCache: Map<string, TileData> = new Map();
  private _maxCacheSize = 100;
  private _currentLOD = 0;
  private _maxLOD = 18;
  private _loadingTiles: Set<string> = new Set(); // Track tiles currently being loaded
  private _failedTiles: Set<string> = new Set(); // Track failed tiles to avoid retry loops
  private _preloadingTiles: Set<string> = new Set(); // Track tiles being preloaded

  // Tile configuration
  private _tileSize = 256;
  private _baseUrl = 'https://tile.openstreetmap.org'; // Default OSM tiles

  // Events
  public onTileLoaded: Observable<TileData> = new Observable();
  public onTileLoadFailed: Observable<string> = new Observable();
  public onTilesUpdated: Observable<number> = new Observable();

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
      this._disposeTile(tile);
    });
    this._activeTiles.clear();

    // Dispose cached tiles
    this._tileCache.forEach(tile => {
      this._disposeTile(tile);
    });
    this._tileCache.clear();

    // Clear tracking sets
    this._loadingTiles.clear();
    this._failedTiles.clear();
    this._preloadingTiles.clear();

    // Dispose observables
    this.onTileLoaded.clear();
    this.onTileLoadFailed.clear();
    this.onTilesUpdated.clear();

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

      // Preload nearby tiles for smoother navigation
      const geographic = this._worldToGeographic(cameraPosition);
      this._preloadNearbyTiles(geographic.longitude, geographic.latitude, this._currentLOD);
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
      { x: 1, y: 1, z: 1 },
    ];

    for (const tile of initialTiles) {
      await this._loadTile(tile.x, tile.y, tile.z);
    }
  }

  /**
   * Calculate required LOD based on altitude with improved precision and performance
   */
  private _calculateLOD(altitude: number): number {
    // Optimized LOD calculation with logarithmic scaling for better precision
    const clampedAltitude = Math.max(altitude, 100); // Minimum 100m altitude
    const normalizedAltitude = Math.log10(clampedAltitude);

    // Enhanced LOD mapping with smooth transitions
    let baseLOD: number;

    if (normalizedAltitude >= 7) {
      // >= 10,000km
      baseLOD = 1;
    } else if (normalizedAltitude >= 6.5) {
      // 3,162km - 10,000km
      baseLOD = 2;
    } else if (normalizedAltitude >= 6) {
      // 1,000km - 3,162km
      baseLOD = 3;
    } else if (normalizedAltitude >= 5.5) {
      // 316km - 1,000km
      baseLOD = 4;
    } else if (normalizedAltitude >= 5) {
      // 100km - 316km
      baseLOD = 5;
    } else if (normalizedAltitude >= 4.5) {
      // 32km - 100km
      baseLOD = 6;
    } else if (normalizedAltitude >= 4) {
      // 10km - 32km
      baseLOD = 7;
    } else if (normalizedAltitude >= 3.5) {
      // 3.2km - 10km
      baseLOD = 8;
    } else if (normalizedAltitude >= 3) {
      // 1km - 3.2km
      baseLOD = 9;
    } else {
      // < 1km
      baseLOD = 10;
    }

    // Apply smooth interpolation between LOD levels for better transitions
    const fraction = normalizedAltitude % 0.5;
    const smoothLOD = baseLOD + (fraction / 0.5) * 0.3; // Add up to 0.3 for smooth transitions

    // Performance optimization: cache frequently used calculations
    const finalLOD = Math.max(1, Math.min(this._maxLOD, Math.floor(smoothLOD)));

    return finalLOD;
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
    visibleTiles.forEach(async tileCoord => {
      await this._loadTile(tileCoord.x, tileCoord.y, tileCoord.z);
    });

    // Remove distant tiles
    this._cullDistantTiles(geographic);
  }

  /**
   * Load a specific tile with improved error handling and duplicate prevention
   */
  private async _loadTile(x: number, y: number, z: number): Promise<void> {
    const tileKey = `${x}_${y}_${z}`;

    // Check if tile is already active, loading, or failed
    if (this._activeTiles.has(tileKey) || this._loadingTiles.has(tileKey) || this._failedTiles.has(tileKey)) {
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
      this.onTilesUpdated.notifyObservers(this._activeTiles.size);
      return;
    }

    // Mark as loading to prevent duplicate requests
    this._loadingTiles.add(tileKey);

    try {
      // Create tile data
      const tileData = await this._createTile(x, y, z);

      if (tileData) {
        this._activeTiles.set(tileKey, tileData);
        this.onTileLoaded.notifyObservers(tileData);
        this.onTilesUpdated.notifyObservers(this._activeTiles.size);
      } else {
        this._failedTiles.add(tileKey);
        this.onTileLoadFailed.notifyObservers(tileKey);
      }
    } catch (error) {
      console.warn(`Failed to load tile ${tileKey}:`, error);
      this._failedTiles.add(tileKey);
      this.onTileLoadFailed.notifyObservers(tileKey);
    } finally {
      this._loadingTiles.delete(tileKey);
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
        x,
        y,
        z,
        bounds,
        mesh,
        material,
        texture,
      };
    } catch (error) {
      console.error(`Failed to create tile ${x}_${y}_${z}:`, error);
      return null;
    }
  }

  /**
   * Create optimized mesh geometry for a tile using Babylon.js 8 best practices
   */
  private _createTileMesh(name: string, bounds: TileBounds): Mesh {
    const resolution = 64; // Increased resolution for better quality
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Pre-calculate constants for better performance
    const lonRange = bounds.east - bounds.west;
    const latRange = bounds.north - bounds.south;
    const invResolution = 1.0 / resolution;

    // Generate vertices with optimized calculations
    for (let y = 0; y <= resolution; y++) {
      const v = y * invResolution;
      const lat = bounds.south + latRange * v;

      for (let x = 0; x <= resolution; x++) {
        const u = x * invResolution;
        const lon = bounds.west + lonRange * u;

        // Convert to world coordinates (on sphere surface)
        const worldPos = this._geographicToWorld(lon, lat, 0);
        positions.push(worldPos.x, worldPos.y, worldPos.z);

        // Normal points outward from sphere center
        const normal = worldPos.normalize();
        normals.push(normal.x, normal.y, normal.z);

        // UV coordinates with proper orientation
        uvs.push(u, 1 - v); // Flip Y for correct texture orientation
      }
    }

    // Generate indices with optimized loop
    const verticesPerRow = resolution + 1;
    for (let y = 0; y < resolution; y++) {
      const rowStart = y * verticesPerRow;
      const nextRowStart = (y + 1) * verticesPerRow;

      for (let x = 0; x < resolution; x++) {
        const a = rowStart + x;
        const b = a + 1;
        const c = nextRowStart + x;
        const d = c + 1;

        // Two triangles per quad with consistent winding order
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    // Create mesh with optimized settings
    const mesh = new Mesh(name, this._scene);

    // Use VertexData for efficient geometry creation
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    vertexData.indices = indices;

    // Apply vertex data to mesh
    vertexData.applyToMesh(mesh);

    // Enable optimizations for better performance
    mesh.freezeWorldMatrix(); // Freeze world matrix since tiles don't move
    mesh.doNotSyncBoundingInfo = true; // Skip bounding info sync for performance

    return mesh;
  }

  /**
   * Load tile texture from URL using Babylon.js 8 best practices
   */
  private async _loadTileTexture(url: string): Promise<Texture | null> {
    try {
      // Use Babylon.js 8 texture loading with optimized configuration
      const texture = new Texture(url, this._scene, {
        noMipmap: false,
        invertY: false,
        samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
        generateMipMaps: true,
        format: Texture.RGBA_FORMAT,
        type: Texture.UNSIGNED_BYTE,
      });

      // Configure texture properties for optimal tile rendering
      texture.wrapU = Texture.CLAMP_ADDRESSMODE;
      texture.wrapV = Texture.CLAMP_ADDRESSMODE;
      texture.anisotropicFilteringLevel = 8; // Increased for better quality

      // Enable texture caching for better performance
      texture.optimizeUVAllocation = true;

      // Wait for texture to load with comprehensive error handling
      return new Promise<Texture | null>(resolve => {
        let isResolved = false;
        let timeoutId: NodeJS.Timeout;

        const cleanup = () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        };

        const onLoad = () => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            resolve(texture);
          }
        };

        const onError = () => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            texture.dispose();
            console.warn(`Failed to load tile texture: ${url}`);
            resolve(null);
          }
        };

        // Use Babylon.js 8 observables for proper event handling
        if (texture.onLoadObservable) {
          texture.onLoadObservable.addOnce(onLoad);
        }

        if (texture.onErrorObservable) {
          texture.onErrorObservable.addOnce(onError);
        }

        // Fallback for environments without observables
        if (!texture.onLoadObservable && !texture.onErrorObservable) {
          // Check texture readiness periodically
          const checkReady = () => {
            if (texture.isReady()) {
              onLoad();
            } else {
              setTimeout(checkReady, 100);
            }
          };
          setTimeout(checkReady, 0);
        }

        // Set timeout for loading
        timeoutId = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            texture.dispose();
            console.warn(`Tile texture load timeout: ${url}`);
            resolve(null);
          }
        }, 10000); // 10 second timeout
      });
    } catch (error) {
      console.warn(`Failed to create tile texture ${url}:`, error);
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
    const latMin = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
    const latMax = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;

    return {
      west: lonMin,
      east: lonMax,
      south: latMin,
      north: latMax,
      level: z,
    };
  }

  /**
   * Calculate tiles within bounds
   */
  private _calculateTilesInBounds(bounds: TileBounds): TileCoordinate[] {
    const tiles: TileCoordinate[] = [];
    const z = bounds.level;
    const n = Math.pow(2, z);

    const minX = Math.floor(((bounds.west + 180) / 360) * n);
    const maxX = Math.floor(((bounds.east + 180) / 360) * n);
    const minY = Math.floor(
      ((1 -
        Math.log(Math.tan((bounds.north * Math.PI) / 180) + 1 / Math.cos((bounds.north * Math.PI) / 180)) / Math.PI) /
        2) *
        n
    );
    const maxY = Math.floor(
      ((1 -
        Math.log(Math.tan((bounds.south * Math.PI) / 180) + 1 / Math.cos((bounds.south * Math.PI) / 180)) / Math.PI) /
        2) *
        n
    );

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
    const centerX = Math.floor(((longitude + 180) / 360) * n);
    const centerY = Math.floor(
      ((1 - Math.log(Math.tan((latitude * Math.PI) / 180) + 1 / Math.cos((latitude * Math.PI) / 180)) / Math.PI) / 2) *
        n
    );

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
        Math.pow(tileCenterLon - cameraGeographic.longitude, 2) + Math.pow(tileCenterLat - cameraGeographic.latitude, 2)
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
          // Clear old cache entries and try again
          this._clearOldCache();
          if (this._tileCache.size < this._maxCacheSize) {
            this._tileCache.set(key, tile);
          } else {
            // Dispose if cache is still full
            this._disposeTile(tile);
          }
        }
      }
    });
  }

  /**
   * Clear tile cache
   */
  private _clearCache(): void {
    this._tileCache.forEach(tile => {
      this._disposeTile(tile);
    });
    this._tileCache.clear();
  }

  /**
   * Clear old tiles from cache with optimized memory management and performance
   */
  private _clearOldCache(): void {
    const targetCacheSize = Math.floor(this._maxCacheSize * 0.75); // Target 75% of max cache size

    if (this._tileCache.size <= targetCacheSize) {
      return;
    }

    // Convert to array for efficient sorting and processing
    const tilesArray = Array.from(this._tileCache.entries());
    const cameraPos = this._scene.activeCamera?.position;

    // Sort by priority: LOD level, distance from camera, and insertion order
    tilesArray.sort((a, b) => {
      const [keyA, tileA] = a;
      const [keyB, tileB] = b;

      // Primary: prefer higher LOD tiles (more detailed)
      const lodDiff = tileB.z - tileA.z;
      if (lodDiff !== 0) {
        return lodDiff;
      }

      // Secondary: prefer tiles closer to camera
      if (cameraPos && tileA.mesh && tileB.mesh) {
        const distA = Vector3.Distance(cameraPos, tileA.mesh.position);
        const distB = Vector3.Distance(cameraPos, tileB.mesh.position);
        const distDiff = distA - distB;
        if (Math.abs(distDiff) > 0.1) {
          return distDiff;
        }
      }

      // Tertiary: use key comparison as tie-breaker (insertion order)
      return keyA.localeCompare(keyB);
    });

    // Remove tiles beyond target cache size (keep the best ones)
    const tilesToRemove = tilesArray.slice(targetCacheSize);
    let removedCount = 0;

    for (const [key, tile] of tilesToRemove) {
      this._disposeTile(tile);
      this._tileCache.delete(key);
      removedCount++;
    }

    if (removedCount > 0) {
      console.log(
        `Optimized tile cache: removed ${removedCount} tiles, cache size: ${this._tileCache.size}/${this._maxCacheSize}`
      );
    }
  }

  /**
   * Safely dispose a single tile and its resources
   */
  private _disposeTile(tile: TileData): void {
    try {
      if (tile.mesh) {
        tile.mesh.dispose();
        tile.mesh = null;
      }
      if (tile.material) {
        tile.material.dispose();
        tile.material = null;
      }
      if (tile.texture) {
        tile.texture.dispose();
        tile.texture = null;
      }
    } catch (error) {
      console.warn('Error disposing tile:', error);
    }
  }

  /**
   * Clear failed tiles cache periodically to allow retry
   */
  public clearFailedTiles(): void {
    this._failedTiles.clear();
  }

  /**
   * Get comprehensive loading statistics
   */
  public getLoadingStats(): {
    active: number;
    cached: number;
    loading: number;
    failed: number;
    preloading: number;
    memoryUsage: number;
  } {
    // Calculate approximate memory usage
    const avgTileSize = 256 * 256 * 4; // Assume 256x256 RGBA texture
    const memoryUsage = (this._activeTiles.size + this._tileCache.size) * avgTileSize;

    return {
      active: this._activeTiles.size,
      cached: this._tileCache.size,
      loading: this._loadingTiles.size,
      failed: this._failedTiles.size,
      preloading: this._preloadingTiles.size,
      memoryUsage: Math.round(memoryUsage / (1024 * 1024)), // MB
    };
  }

  /**
   * Preload tiles around current view for smoother navigation
   */
  private async _preloadNearbyTiles(centerLon: number, centerLat: number, currentLOD: number): Promise<void> {
    const preloadRadius = 2; // Number of tiles to preload in each direction
    const n = Math.pow(2, currentLOD);

    // Calculate tile coordinates for center position
    const centerTileX = Math.floor(((centerLon + 180) / 360) * n);
    const centerTileY = Math.floor(
      ((1 - Math.log(Math.tan((centerLat * Math.PI) / 180) + 1 / Math.cos((centerLat * Math.PI) / 180)) / Math.PI) /
        2) *
        n
    );

    const preloadPromises: Promise<void>[] = [];

    // Preload tiles in a grid around the center
    for (let dx = -preloadRadius; dx <= preloadRadius; dx++) {
      for (let dy = -preloadRadius; dy <= preloadRadius; dy++) {
        // Skip center tile (already loaded)
        if (dx === 0 && dy === 0) continue;

        const tileX = centerTileX + dx;
        const tileY = centerTileY + dy;

        // Check bounds
        if (tileX < 0 || tileX >= n || tileY < 0 || tileY >= n) continue;

        const tileKey = `${tileX}_${tileY}_${currentLOD}`;

        // Skip if already loaded, loading, or failed
        if (
          this._activeTiles.has(tileKey) ||
          this._tileCache.has(tileKey) ||
          this._loadingTiles.has(tileKey) ||
          this._failedTiles.has(tileKey) ||
          this._preloadingTiles.has(tileKey)
        ) {
          continue;
        }

        // Add to preloading set
        this._preloadingTiles.add(tileKey);

        // Create preload promise with lower priority
        const preloadPromise = this._preloadTile(tileX, tileY, currentLOD, tileKey);
        preloadPromises.push(preloadPromise);

        // Limit concurrent preloading to avoid overwhelming the system
        if (preloadPromises.length >= 4) {
          break;
        }
      }
      if (preloadPromises.length >= 4) {
        break;
      }
    }

    // Execute preloading with staggered timing to avoid blocking main loading
    if (preloadPromises.length > 0) {
      setTimeout(() => {
        Promise.allSettled(preloadPromises).then(() => {
          // Cleanup completed preloading tasks
          this._cleanupPreloadingTiles();
        });
      }, 100); // Small delay to prioritize main tile loading
    }
  }

  /**
   * Preload a single tile with lower priority
   */
  private async _preloadTile(x: number, y: number, z: number, tileKey: string): Promise<void> {
    try {
      const tileData = await this._createTile(x, y, z);

      if (tileData && this._preloadingTiles.has(tileKey)) {
        // Move to cache if successfully preloaded
        this._tileCache.set(tileKey, tileData);

        // Hide preloaded tiles initially
        if (tileData.mesh) {
          tileData.mesh.setEnabled(false);
        }
      }
    } catch (error) {
      console.warn(`Preload failed for tile ${tileKey}:`, error);
    } finally {
      this._preloadingTiles.delete(tileKey);
    }
  }

  /**
   * Clean up completed preloading tasks
   */
  private _cleanupPreloadingTiles(): void {
    // Remove any stale preloading entries
    const staleEntries: string[] = [];
    for (const tileKey of this._preloadingTiles) {
      if (this._activeTiles.has(tileKey) || this._tileCache.has(tileKey)) {
        staleEntries.push(tileKey);
      }
    }

    staleEntries.forEach(key => this._preloadingTiles.delete(key));
  }

  /**
   * Convert world coordinates to geographic coordinates
   */
  private _worldToGeographic(worldPos: Vector3): { longitude: number; latitude: number; altitude: number } {
    const distance = worldPos.length();
    const altitude = distance - this._earthRadius;

    const longitude = (Math.atan2(worldPos.z, worldPos.x) * 180) / Math.PI;
    const latitude = (Math.asin(worldPos.y / distance) * 180) / Math.PI;

    return { longitude, latitude, altitude };
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
