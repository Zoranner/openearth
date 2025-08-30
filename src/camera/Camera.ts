import { Scene, ArcRotateCamera, Vector3, Tools, Animation, Animatable, EasingFunction, CubicEase } from '@babylonjs/core';

/**
 * Camera manages the 3D camera control and interaction for the globe
 * Provides smooth navigation, positioning, and animation capabilities using Babylon.js ArcRotateCamera
 */
export class Camera {
  private _scene: Scene;
  private _canvas: HTMLCanvasElement;
  private _camera: ArcRotateCamera;
  private _isInitialized: boolean = false;
  private _planetRadius: number = 6378137; // Earth radius in meters
  private _minDistance: number;
  private _maxDistance: number;
  private _currentAnimation: Animatable | null = null;

  // Camera constraints
  private _minAltitude: number = 100; // 100 meters above surface
  private _maxAltitude: number = 20000000; // 20,000 km
  
  // Animation properties
  private _animationGroup: Animation[] = [];
  private _isAnimating: boolean = false;
  
  // Camera state
  private _lastUpdateTime: number = 0;
  private _smoothingFactor: number = 0.1;
  
  // Interaction state
  private _isUserInteracting: boolean = false;
  private _autoRotateSpeed: number = 0;

  constructor(scene: Scene, canvas: HTMLCanvasElement, options: CameraOptions = {}) {
    this._scene = scene;
    this._canvas = canvas;
    this._planetRadius = options.planetRadius ?? this._planetRadius;
    this._minAltitude = options.minAltitude ?? this._minAltitude;
    this._maxAltitude = options.maxAltitude ?? this._maxAltitude;
    
    this._minDistance = this._planetRadius + this._minAltitude;
    this._maxDistance = this._planetRadius + this._maxAltitude;
    
    // Auto-rotation settings
    this._autoRotateSpeed = options.autoRotateSpeed ?? 0;

    this._createCamera(options);
    this._setupInteractionDetection();
  }

  /**
   * Initialize the camera system
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // Set camera as active camera
      this._scene.activeCamera = this._camera;
      
      // Attach camera controls
      this._camera.attachToCanvas(this._canvas, true);
      
      // Setup camera constraints and behaviors
      this._setupConstraints();
      this._setupBehaviors();
      
      // Set initial position (view of Earth from space)
      this.setPosition(0, 0, this._planetRadius * 3);

      this._isInitialized = true;
      console.log('Camera initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Camera:', error);
      throw error;
    }
  }

  /**
   * Dispose of camera resources
   */
  public dispose(): void {
    // Stop any running animations
    if (this._currentAnimation) {
      this._currentAnimation.stop();
      this._currentAnimation = null;
    }
    
    // Detach controls and dispose camera
    if (this._camera) {
      this._camera.detachFromCanvas();
      this._camera.dispose();
    }
    
    this._isInitialized = false;
  }

  /**
   * Update camera (called each frame)
   */
  public update(): void {
    if (!this._isInitialized) {
      return;
    }
    
    const currentTime = performance.now();
    const deltaTime = currentTime - this._lastUpdateTime;
    this._lastUpdateTime = currentTime;
    
    // Auto-rotation when not interacting
    if (this._autoRotateSpeed > 0 && !this._isUserInteracting && !this._isAnimating) {
      this._camera.alpha += this._autoRotateSpeed * deltaTime * 0.001;
    }
  }
  
  /**
   * Set auto-rotation speed (radians per second)
   */
  public setAutoRotateSpeed(speed: number): void {
    this._autoRotateSpeed = speed;
  }
  
  /**
   * Enable/disable auto-rotation
   */
  public setAutoRotate(enabled: boolean, speed: number = 0.1): void {
    this._autoRotateSpeed = enabled ? speed : 0;
  }

  /**
   * Get the Babylon.js camera instance
   */
  public get babylonCamera(): ArcRotateCamera {
    return this._camera;
  }

  /**
   * Get current camera position
   */
  public get position(): Vector3 {
    return this._camera.position.clone();
  }

  /**
   * Get current camera target
   */
  public get target(): Vector3 {
    return this._camera.target.clone();
  }

  /**
   * Get current altitude above planet surface
   */
  public get altitude(): number {
    return this._camera.radius - this._planetRadius;
  }
  
  /**
   * Get current spherical coordinates
   */
  public get alpha(): number {
    return this._camera.alpha;
  }
  
  public get beta(): number {
    return this._camera.beta;
  }
  
  public get radius(): number {
    return this._camera.radius;
  }
  
  /**
   * Check if camera is currently animating
   */
  public get isAnimating(): boolean {
    return this._isAnimating;
  }

  /**
   * Attach camera controls to canvas
   */
  public attachToCanvas(canvas: HTMLCanvasElement): void {
    this._camera.attachToCanvas(canvas, true);
  }
  
  /**
   * Detach camera controls from canvas
   */
  public detachFromCanvas(): void {
    this._camera.detachFromCanvas();
  }

  /**
   * Set camera position in world coordinates
   */
  public setPosition(x: number, y: number, z: number): void {
    this._camera.setPosition(new Vector3(x, y, z));
  }

  /**
   * Set camera target point
   */
  public setTarget(x: number, y: number, z: number): void {
    this._camera.setTarget(new Vector3(x, y, z));
  }

  /**
   * Fly to a specific geographic location
   */
  public async flyTo(longitude: number, latitude: number, altitude: number, duration: number = 2000): Promise<void> {
    // Convert geographic coordinates to world position
    const targetPosition = this._geographicToWorld(longitude, latitude, altitude);
    const targetLookAt = this._geographicToWorld(longitude, latitude, 0);

    return this._animateToPosition(targetPosition, targetLookAt, duration);
  }

  /**
   * Animate camera to a specific position
   */
  public async animateToPosition(position: Vector3, target: Vector3, duration: number = 2000): Promise<void> {
    return this._animateToPosition(position, target, duration);
  }
  
  /**
   * Animate camera to spherical coordinates
   */
  public animateTo(alpha: number, beta: number, radius: number, duration: number = 2000): void {
    if (duration <= 0) {
      this.setSphericalCoordinates(alpha, beta, radius);
      return;
    }
    
    this._isAnimating = true;
    const frameRate = 60;
    const totalFrames = Math.floor(frameRate * duration / 1000);
    
    // Create alpha animation
    const alphaAnimation = new Animation(
      'cameraAlpha',
      'alpha',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    // Handle alpha wrapping for shortest path
    let targetAlpha = alpha;
    const currentAlpha = this._camera.alpha;
    const diff = targetAlpha - currentAlpha;
    
    if (Math.abs(diff) > Math.PI) {
      if (diff > 0) {
        targetAlpha -= 2 * Math.PI;
      } else {
        targetAlpha += 2 * Math.PI;
      }
    }
    
    alphaAnimation.setKeys([
      { frame: 0, value: currentAlpha },
      { frame: totalFrames, value: targetAlpha }
    ]);
    
    // Create beta animation
    const betaAnimation = new Animation(
      'cameraBeta',
      'beta',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    betaAnimation.setKeys([
      { frame: 0, value: this._camera.beta },
      { frame: totalFrames, value: Math.max(this._camera.lowerBetaLimit, Math.min(this._camera.upperBetaLimit, beta)) }
    ]);
    
    // Create radius animation
    const radiusAnimation = new Animation(
      'cameraRadius',
      'radius',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    radiusAnimation.setKeys([
      { frame: 0, value: this._camera.radius },
      { frame: totalFrames, value: Math.max(this._camera.lowerRadiusLimit, Math.min(this._camera.upperRadiusLimit, radius)) }
    ]);
    
    // Add easing to all animations
    const easingFunction = new CubicEase();
    easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    
    alphaAnimation.setEasingFunction(easingFunction);
    betaAnimation.setEasingFunction(easingFunction);
    radiusAnimation.setEasingFunction(easingFunction);
    
    // Start animations
    const animatable = this._scene.beginAnimation(this._camera, 0, totalFrames, false);
    animatable.onAnimationEnd = () => {
      this._isAnimating = false;
    };
  }

  /**
   * Set camera altitude above surface
   */
  public setAltitude(altitude: number): void {
    const clampedAltitude = Math.max(this._minAltitude, Math.min(this._maxAltitude, altitude));
    this._camera.radius = this._planetRadius + clampedAltitude;
  }
  
  /**
   * Get current altitude above surface
   */
  public getAltitude(): number {
    return this._camera.radius - this._planetRadius;
  }
  
  /**
   * Set camera spherical coordinates
   */
  public setSphericalCoordinates(alpha: number, beta: number, radius: number): void {
    this._camera.alpha = alpha;
    this._camera.beta = beta;
    this._camera.radius = Math.max(this._camera.lowerRadiusLimit, Math.min(this._camera.upperRadiusLimit, radius));
  }

  /**
   * Zoom in by a factor
   */
  public zoomIn(factor: number = 0.5): void {
    const newRadius = this._camera.radius * factor;
    this._camera.radius = Math.max(this._minDistance, newRadius);
  }

  /**
   * Zoom out by a factor
   */
  public zoomOut(factor: number = 2.0): void {
    const newRadius = this._camera.radius * factor;
    this._camera.radius = Math.min(this._maxDistance, newRadius);
  }
  
  /**
   * Zoom to specific distance with animation
   */
  public zoomTo(distance: number, duration: number = 1000): void {
    const clampedDistance = Math.max(this._camera.lowerRadiusLimit, Math.min(this._camera.upperRadiusLimit, distance));
    
    if (duration <= 0) {
      this._camera.radius = clampedDistance;
      return;
    }
    
    // Create smooth zoom animation
    const startRadius = this._camera.radius;
    const frameRate = 60;
    const totalFrames = Math.floor(frameRate * duration / 1000);
    
    const animation = new Animation(
      'cameraZoom',
      'radius',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    const keys = [
      { frame: 0, value: startRadius },
      { frame: totalFrames, value: clampedDistance }
    ];
    
    animation.setKeys(keys);
    
    // Add easing for smooth animation
    const easingFunction = new CubicEase();
    easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    animation.setEasingFunction(easingFunction);
    
    this._scene.beginAnimation(this._camera, 0, totalFrames, false);
  }

  /**
   * Reset camera to default position
   */
  public reset(): void {
    this._camera.alpha = 0;
    this._camera.beta = Math.PI / 2;
    this._camera.radius = this._planetRadius * 3;
    this._camera.setTarget(Vector3.Zero());
  }

  /**
   * Enable or disable camera controls
   */
  public setControlsEnabled(enabled: boolean): void {
    if (enabled) {
      this._camera.attachToCanvas(this._canvas, true);
    } else {
      this._camera.detachFromCanvas();
    }
  }

  /**
   * Get camera view matrix
   */
  public getViewMatrix(): Float32Array {
    return this._camera.getViewMatrix().asArray();
  }

  /**
   * Get camera projection matrix
   */
  public getProjectionMatrix(): Float32Array {
    return this._camera.getProjectionMatrix().asArray();
  }

  /**
   * Create the camera instance
   */
  private _createCamera(options: CameraOptions): void {
    // Create arc rotate camera (orbital camera)
    this._camera = new ArcRotateCamera(
      'camera',
      0, // alpha (horizontal rotation)
      Math.PI / 2, // beta (vertical rotation)
      this._planetRadius * 3, // radius (distance from target)
      Vector3.Zero(), // target
      this._scene
    );

    // Set camera properties
    this._camera.minZ = 0.1;
    this._camera.maxZ = this._maxDistance * 2;
    this._camera.fov = options.fov ?? Tools.ToRadians(45);
    this._camera.wheelPrecision = 50;
    this._camera.pinchPrecision = 200;
  }

  /**
   * Setup camera movement constraints
   */
  private _setupConstraints(): void {
    // Set distance limits
    this._camera.lowerRadiusLimit = this._minDistance;
    this._camera.upperRadiusLimit = this._maxDistance;
    
    // Set vertical angle limits (prevent going below ground)
    this._camera.lowerBetaLimit = 0.1;
    this._camera.upperBetaLimit = Math.PI - 0.1;
  }

  /**
   * Setup camera behaviors and interactions
   */
  private _setupBehaviors(): void {
    // Enable smooth camera movements
    this._camera.useNaturalPinchZoom = true;
    this._camera.panningInertia = 0.9;
    this._camera.angularSensibilityX = 1000;
    this._camera.angularSensibilityY = 1000;
    
    // Setup wheel zoom behavior
    this._camera.wheelDeltaPercentage = 0.01;
  }

  /**
   * Convert geographic coordinates to world position
   */
  private _geographicToWorld(longitude: number, latitude: number, altitude: number): Vector3 {
    const lonRad = Tools.ToRadians(longitude);
    const latRad = Tools.ToRadians(latitude);
    const radius = this._planetRadius + altitude;

    const x = radius * Math.cos(latRad) * Math.cos(lonRad);
    const y = radius * Math.sin(latRad);
    const z = radius * Math.cos(latRad) * Math.sin(lonRad);

    return new Vector3(x, y, z);
  }

  /**
   * Animate camera to a specific position and target
   */
  private async _animateToPosition(position: Vector3, target: Vector3, duration: number): Promise<void> {
    return new Promise((resolve) => {
      // Stop any current animation
      if (this._currentAnimation) {
        this._currentAnimation.stop();
      }

      // Calculate target camera parameters
      const direction = position.subtract(target);
      const distance = direction.length();
      const alpha = Math.atan2(direction.x, direction.z);
      const beta = Math.acos(direction.y / distance);

      // Create animations
      const alphaAnimation = Animation.CreateAndStartAnimation(
        'cameraAlpha',
        this._camera,
        'alpha',
        60,
        duration / 1000 * 60,
        this._camera.alpha,
        alpha,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );

      const betaAnimation = Animation.CreateAndStartAnimation(
        'cameraBeta',
        this._camera,
        'beta',
        60,
        duration / 1000 * 60,
        this._camera.beta,
        beta,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );

      const radiusAnimation = Animation.CreateAndStartAnimation(
        'cameraRadius',
        this._camera,
        'radius',
        60,
        duration / 1000 * 60,
        this._camera.radius,
        distance,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );

      const targetAnimation = Animation.CreateAndStartAnimation(
        'cameraTarget',
        this._camera,
        'target',
        60,
        duration / 1000 * 60,
        this._camera.target,
        target,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );

      // Wait for animation to complete
      if (radiusAnimation) {
        this._currentAnimation = radiusAnimation;
        radiusAnimation.onAnimationEndObservable.add(() => {
          this._currentAnimation = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

  /**
   * Setup interaction detection for auto-rotation
   */
  private _setupInteractionDetection(): void {
    // Detect when user starts interacting
    this._camera.onViewMatrixChangedObservable.add(() => {
      if (!this._isAnimating) {
        this._isUserInteracting = true;
        
        // Reset interaction flag after a delay
        setTimeout(() => {
          this._isUserInteracting = false;
        }, 2000); // 2 seconds of inactivity before auto-rotation resumes
      }
    });
  }
  
  /**
   * Stop all running animations
   */
  private _stopAllAnimations(): void {
    this._scene.stopAnimation(this._camera);
    this._isAnimating = false;
  }
}

/**
 * Camera configuration options
 */
export interface CameraOptions {
  /** Planet radius in meters */
  planetRadius?: number;
  /** Minimum altitude above surface */
  minAltitude?: number;
  /** Maximum altitude above surface */
  maxAltitude?: number;
  /** Field of view in radians */
  fov?: number;
  /** Initial camera position */
  initialPosition?: Vector3;
  /** Initial camera target */
  initialTarget?: Vector3;
  /** Camera inertia (0-1) */
  inertia?: number;
  /** Angular sensitivity X */
  angularSensibilityX?: number;
  /** Angular sensitivity Y */
  angularSensibilityY?: number;
  /** Auto-rotation speed (radians per second) */
  autoRotateSpeed?: number;
}