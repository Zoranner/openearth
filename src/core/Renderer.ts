import { Engine, Scene, RenderTargetTexture, PostProcess, Effect } from '@babylonjs/core';
import { AdvancedDynamicTexture } from '@babylonjs/gui';

/**
 * Renderer manages the Babylon.js rendering pipeline and post-processing effects
 */
export class Renderer {
  private _engine: Engine;
  private _scene: Scene;
  private _gui: AdvancedDynamicTexture | null = null;
  private _postProcesses: PostProcess[] = [];
  private _renderTargets: RenderTargetTexture[] = [];
  private _isInitialized: boolean = false;

  constructor(engine: Engine, scene: Scene) {
    this._engine = engine;
    this._scene = scene;
  }

  /**
   * Initialize the renderer and setup rendering pipeline
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // Setup GUI
      this._gui = AdvancedDynamicTexture.CreateFullscreenUI('UI', true, this._scene);
      
      // Setup render pipeline
      this._setupRenderPipeline();
      
      // Setup post-processing effects
      this._setupPostProcessing();

      this._isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Renderer:', error);
      throw error;
    }
  }

  /**
   * Dispose of all rendering resources
   */
  public dispose(): void {
    // Dispose post-processes
    this._postProcesses.forEach(pp => pp.dispose());
    this._postProcesses = [];

    // Dispose render targets
    this._renderTargets.forEach(rt => rt.dispose());
    this._renderTargets = [];

    // Dispose GUI
    this._gui?.dispose();
    this._gui = null;

    this._isInitialized = false;
  }

  /**
   * Get the GUI texture for UI elements
   */
  public get gui(): AdvancedDynamicTexture | null {
    return this._gui;
  }

  /**
   * Get the engine instance
   */
  public get engine(): Engine {
    return this._engine;
  }

  /**
   * Get the scene instance
   */
  public get scene(): Scene {
    return this._scene;
  }

  /**
   * Add a post-process effect to the rendering pipeline
   */
  public addPostProcess(postProcess: PostProcess): void {
    this._postProcesses.push(postProcess);
  }

  /**
   * Remove a post-process effect from the rendering pipeline
   */
  public removePostProcess(postProcess: PostProcess): void {
    const index = this._postProcesses.indexOf(postProcess);
    if (index !== -1) {
      this._postProcesses.splice(index, 1);
      postProcess.dispose();
    }
  }

  /**
   * Create a render target texture
   */
  public createRenderTarget(name: string, size: number): RenderTargetTexture {
    const renderTarget = new RenderTargetTexture(name, size, this._scene);
    this._renderTargets.push(renderTarget);
    return renderTarget;
  }

  /**
   * Get rendering statistics
   */
  public getStats(): RenderStats {
    return {
      fps: this._engine.getFps(),
      drawCalls: this._scene.getActiveMeshes().length,
      triangles: this._scene.getTotalVertices() / 3,
      vertices: this._scene.getTotalVertices(),
      materials: this._scene.materials.length,
      textures: this._scene.textures.length,
      lights: this._scene.lights.length,
      cameras: this._scene.cameras.length
    };
  }

  /**
   * Enable or disable wireframe mode
   */
  public setWireframeMode(enabled: boolean): void {
    this._scene.materials.forEach(material => {
      if (material.wireframe !== undefined) {
        material.wireframe = enabled;
      }
    });
  }

  /**
   * Setup the rendering pipeline
   */
  private _setupRenderPipeline(): void {
    // Configure scene rendering options
    this._scene.autoClear = true;
    this._scene.autoClearDepthAndStencil = true;
    
    // Enable hardware scaling for better performance
    this._engine.setHardwareScalingLevel(1.0);
    
    // Setup render groups for proper rendering order
    this._scene.setRenderingOrder(0, 1, 2, 3);
  }

  /**
   * Setup post-processing effects
   */
  private _setupPostProcessing(): void {
    // Basic post-processing effects can be added here
    // For example: FXAA, tone mapping, etc.
    
    // Note: Specific post-processing effects will be added based on requirements
  }
}

/**
 * Rendering statistics interface
 */
export interface RenderStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  vertices: number;
  materials: number;
  textures: number;
  lights: number;
  cameras: number;
}