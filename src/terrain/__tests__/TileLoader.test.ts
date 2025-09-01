import { Engine, Scene, NullEngine } from '@babylonjs/core';
import { TileLoader, TileLoaderOptions } from '../TileLoader';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Unit tests for TileLoader
 * Tests basic functionality and Babylon.js integration
 */
describe('TileLoader', () => {
  let engine: Engine;
  let scene: Scene;
  let tileLoader: TileLoader;

  beforeEach(() => {
    // Use NullEngine for headless testing
    engine = new NullEngine({
      renderWidth: 512,
      renderHeight: 512,
      textureSize: 512,
      deterministicLockstep: false,
      lockstepMaxSteps: 1
    });
    scene = new Scene(engine);

    const options: TileLoaderOptions = {
      maxCacheSize: 10,
      maxLOD: 5,
      tileSize: 256,
      baseUrl: 'https://tile.openstreetmap.org'
    };

    tileLoader = new TileLoader(scene, 6371000, options);
  });

  afterEach(() => {
    if (tileLoader) {
      tileLoader.dispose();
    }
    if (scene) {
      scene.dispose();
    }
    if (engine) {
      engine.dispose();
    }
  });

  describe('Constructor', () => {
    it('should create TileLoader with default options', () => {
      const defaultLoader = new TileLoader(scene, 6371000);
      expect(defaultLoader).toBeDefined();
      expect(defaultLoader.activeTileCount).toBe(0);
      expect(defaultLoader.cachedTileCount).toBe(0);
      defaultLoader.dispose();
    });

    it('should create TileLoader with custom options', () => {
      expect(tileLoader).toBeDefined();
      expect(tileLoader.activeTileCount).toBe(0);
      expect(tileLoader.cachedTileCount).toBe(0);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      // Mock the _loadInitialTiles method to avoid network requests
      const originalLoadInitialTiles = (tileLoader as any)._loadInitialTiles;
      (tileLoader as any)._loadInitialTiles = vi.fn().mockResolvedValue(undefined);

      // Test initialization directly
      await tileLoader.initialize();
      expect((tileLoader as any)._isInitialized).toBe(true);
      expect((tileLoader as any)._loadInitialTiles).toHaveBeenCalledTimes(1);

      // Restore original method
      (tileLoader as any)._loadInitialTiles = originalLoadInitialTiles;
    });

    it('should not initialize twice', async () => {
      // Mock the _loadInitialTiles method to avoid network requests
      const originalLoadInitialTiles = (tileLoader as any)._loadInitialTiles;
      (tileLoader as any)._loadInitialTiles = vi.fn().mockResolvedValue(undefined);

      await tileLoader.initialize();
      expect((tileLoader as any)._isInitialized).toBe(true);

      // Second initialization should not call _loadInitialTiles again
      await tileLoader.initialize();
      expect((tileLoader as any)._loadInitialTiles).toHaveBeenCalledTimes(1);

      // Restore original method
      (tileLoader as any)._loadInitialTiles = originalLoadInitialTiles;
    });
  });

  describe('Tile Management', () => {
    beforeEach(async () => {
      await tileLoader.initialize();
    });

    it('should provide loading statistics', () => {
      const stats = tileLoader.getLoadingStats();
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('cached');
      expect(stats).toHaveProperty('loading');
      expect(stats).toHaveProperty('failed');
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.cached).toBe('number');
      expect(typeof stats.loading).toBe('number');
      expect(typeof stats.failed).toBe('number');
    });

    it('should clear failed tiles', () => {
      tileLoader.clearFailedTiles();
      const stats = tileLoader.getLoadingStats();
      expect(stats.failed).toBe(0);
    });

    it('should set tile provider URL', () => {
      const newUrl = 'https://example.com/tiles';
      expect(() => tileLoader.setTileProvider(newUrl)).not.toThrow();
    });
  });

  describe('Events', () => {
    beforeEach(async () => {
      await tileLoader.initialize();
    });

    it('should have observable events', () => {
      expect(tileLoader.onTileLoaded).toBeDefined();
      expect(tileLoader.onTileLoadFailed).toBeDefined();
      expect(tileLoader.onTilesUpdated).toBeDefined();
    });

    it('should allow event subscription', () => {
      let tileLoadedCalled = false;
      let tileFailedCalled = false;
      let tilesUpdatedCalled = false;

      tileLoader.onTileLoaded.add(() => {
        tileLoadedCalled = true;
      });

      tileLoader.onTileLoadFailed.add(() => {
        tileFailedCalled = true;
      });

      tileLoader.onTilesUpdated.add(() => {
        tilesUpdatedCalled = true;
      });

      // Events should be subscribable without errors
      expect(tileLoadedCalled).toBe(false);
      expect(tileFailedCalled).toBe(false);
      expect(tilesUpdatedCalled).toBe(false);
    });
  });

  describe('Disposal', () => {
    it('should dispose cleanly', async () => {
      await tileLoader.initialize();
      expect(() => tileLoader.dispose()).not.toThrow();

      const stats = tileLoader.getLoadingStats();
      expect(stats.active).toBe(0);
      expect(stats.cached).toBe(0);
      expect(stats.loading).toBe(0);
      expect(stats.failed).toBe(0);
    });

    it('should handle multiple dispose calls', async () => {
      await tileLoader.initialize();
      tileLoader.dispose();
      expect(() => tileLoader.dispose()).not.toThrow();
    });
  });
});
