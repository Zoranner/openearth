import { Scene, DirectionalLight, Vector3, Color3, Animation, AnimationGroup, CubicEase } from '@babylonjs/core';

/**
 * SunSystem manages sun lighting, day/night cycles, and solar positioning
 * Provides realistic sun simulation with time-based positioning and lighting effects
 */
export class SunSystem {
  private _scene: Scene;
  private _sunLight: DirectionalLight | null = null;
  private _isInitialized: boolean = false;
  
  // Sun parameters
  private _sunIntensity: number = 3.0;
  private _sunColor: Color3 = new Color3(1.0, 0.95, 0.8); // Warm white
  private _sunPosition: Vector3 = new Vector3(1, 0.5, 0.3).normalize();
  
  // Day/night cycle
  private _timeOfDay: number = 12.0; // Hours (0-24)
  private _dayDuration: number = 120; // Seconds for full day cycle
  private _isAnimating: boolean = false;
  private _animationGroup: AnimationGroup | null = null;
  
  // Seasonal parameters
  private _dayOfYear: number = 80; // Day of year (1-365), default spring equinox
  private _latitude: number = 0; // Observer latitude in degrees
  
  // Light colors for different times
  private _dawnColor: Color3 = new Color3(1.0, 0.6, 0.3); // Orange
  private _noonColor: Color3 = new Color3(1.0, 0.95, 0.8); // Warm white
  private _duskColor: Color3 = new Color3(1.0, 0.4, 0.2); // Red-orange
  private _nightColor: Color3 = new Color3(0.1, 0.15, 0.3); // Deep blue
  
  constructor(scene: Scene, options: SunSystemOptions = {}) {
    this._scene = scene;
    this._sunIntensity = options.sunIntensity ?? this._sunIntensity;
    this._sunColor = options.sunColor ?? this._sunColor;
    this._timeOfDay = options.timeOfDay ?? this._timeOfDay;
    this._dayDuration = options.dayDuration ?? this._dayDuration;
    this._dayOfYear = options.dayOfYear ?? this._dayOfYear;
    this._latitude = options.latitude ?? this._latitude;
  }

  /**
   * Initialize the sun system
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // Create directional light for sun
      this._createSunLight();
      
      // Set initial sun position based on time
      this._updateSunPosition();
      
      this._isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize SunSystem:', error);
      throw error;
    }
  }

  /**
   * Dispose of sun system resources
   */
  dispose(): void {
    if (this._sunLight) {
      this._sunLight.dispose();
      this._sunLight = null;
    }
    
    if (this._animationGroup) {
      this._animationGroup.dispose();
      this._animationGroup = null;
    }

    this._isInitialized = false;
  }

  /**
   * Create the sun directional light
   */
  private _createSunLight(): void {
    this._sunLight = new DirectionalLight('sunLight', this._sunPosition.negate(), this._scene);
    this._sunLight.intensity = this._sunIntensity;
    this._sunLight.diffuse = this._sunColor;
    this._sunLight.specular = this._sunColor;
    
    // Enable shadows
    this._sunLight.shadowMinZ = 1;
    this._sunLight.shadowMaxZ = 10000;
  }

  /**
   * Update sun position based on time of day and date
   */
  private _updateSunPosition(): void {
    if (!this._sunLight) return;

    // Calculate solar angles
    const solarAngles = this._calculateSolarPosition(this._timeOfDay, this._dayOfYear, this._latitude);
    
    // Convert to Cartesian coordinates
    const elevation = solarAngles.elevation;
    const azimuth = solarAngles.azimuth;
    
    // Calculate sun direction vector
    const sunDirection = new Vector3(
      Math.cos(elevation) * Math.sin(azimuth),
      Math.sin(elevation),
      Math.cos(elevation) * Math.cos(azimuth)
    );
    
    this._sunPosition = sunDirection;
    this._sunLight.direction = sunDirection.negate();
    
    // Update light intensity and color based on sun elevation
    this._updateLightProperties(elevation);
  }

  /**
   * Calculate solar position (elevation and azimuth) for given time and location
   */
  private _calculateSolarPosition(timeOfDay: number, dayOfYear: number, latitude: number): { elevation: number; azimuth: number } {
    // Convert to radians
    const lat = latitude * Math.PI / 180;
    
    // Solar declination angle
    const declination = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365);
    
    // Hour angle
    const hourAngle = (timeOfDay - 12) * 15 * Math.PI / 180;
    
    // Solar elevation angle
    const elevation = Math.asin(
      Math.sin(declination) * Math.sin(lat) + 
      Math.cos(declination) * Math.cos(lat) * Math.cos(hourAngle)
    );
    
    // Solar azimuth angle
    const azimuth = Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat)
    );
    
    return { elevation, azimuth };
  }

  /**
   * Update light properties based on sun elevation
   */
  private _updateLightProperties(elevation: number): void {
    if (!this._sunLight) return;

    const elevationDegrees = elevation * 180 / Math.PI;
    
    // Calculate intensity based on elevation
    let intensity = 0;
    let color = this._nightColor;
    
    if (elevationDegrees > 0) {
      // Daytime
      intensity = Math.min(this._sunIntensity, this._sunIntensity * Math.sin(elevation));
      
      if (elevationDegrees < 10) {
        // Dawn/dusk
        const t = elevationDegrees / 10;
        color = Color3.Lerp(this._dawnColor, this._noonColor, t);
      } else {
        // Full daylight
        color = this._noonColor;
      }
    } else if (elevationDegrees > -10) {
      // Twilight
      const t = (elevationDegrees + 10) / 10;
      intensity = this._sunIntensity * 0.1 * t;
      color = Color3.Lerp(this._nightColor, this._duskColor, t);
    } else {
      // Night
      intensity = 0.05; // Minimal ambient light
      color = this._nightColor;
    }
    
    this._sunLight.intensity = intensity;
    this._sunLight.diffuse = color;
    this._sunLight.specular = color.scale(0.5);
  }

  /**
   * Update sun system
   */
  update(deltaTime: number): void {
    if (!this._isInitialized) {
      return;
    }

    // Auto-advance time if animating
    if (this._isAnimating) {
      this._timeOfDay += (deltaTime / 1000) * (24 / this._dayDuration);
      if (this._timeOfDay >= 24) {
        this._timeOfDay -= 24;
      }
      
      this._updateSunPosition();
    }
  }

  /**
   * Set time of day (0-24 hours)
   */
  setTimeOfDay(hours: number): void {
    this._timeOfDay = Math.max(0, Math.min(24, hours));
    this._updateSunPosition();
  }

  /**
   * Set day of year (1-365)
   */
  setDayOfYear(day: number): void {
    this._dayOfYear = Math.max(1, Math.min(365, day));
    this._updateSunPosition();
  }

  /**
   * Set observer latitude in degrees
   */
  setLatitude(latitude: number): void {
    this._latitude = Math.max(-90, Math.min(90, latitude));
    this._updateSunPosition();
  }

  /**
   * Start automatic day/night cycle animation
   */
  startDayNightCycle(): void {
    this._isAnimating = true;
  }

  /**
   * Stop automatic day/night cycle animation
   */
  stopDayNightCycle(): void {
    this._isAnimating = false;
  }

  /**
   * Animate to specific time of day
   */
  animateToTime(targetHours: number, duration: number = 2000): Promise<void> {
    return new Promise((resolve) => {
      if (!this._scene) {
        resolve();
        return;
      }

      const startTime = this._timeOfDay;
      const endTime = targetHours;
      
      // Handle day boundary crossing
      let actualEndTime = endTime;
      if (Math.abs(endTime - startTime) > 12) {
        if (endTime > startTime) {
          actualEndTime = endTime - 24;
        } else {
          actualEndTime = endTime + 24;
        }
      }

      // Create animation
      Animation.CreateAndStartAnimation(
        'sunTimeAnimation',
        this,
        '_timeOfDay',
        60, // 60 FPS
        Math.floor(duration / 1000 * 60), // Convert to frames
        startTime,
        actualEndTime,
        Animation.ANIMATIONLOOPMODE_CONSTANT,
        new CubicEase(),
        () => {
          // Normalize time after animation
          if (this._timeOfDay < 0) this._timeOfDay += 24;
          if (this._timeOfDay >= 24) this._timeOfDay -= 24;
          resolve();
        }
      );

      // Animation keys are already set by CreateAndStartAnimation

      this._scene.onBeforeRenderObservable.add(() => {
        this._updateSunPosition();
      });
    });
  }

  /**
   * Set sun intensity
   */
  setSunIntensity(intensity: number): void {
    this._sunIntensity = intensity;
    this._updateSunPosition();
  }

  /**
   * Get current sun direction
   */
  get sunDirection(): Vector3 {
    return this._sunPosition.clone();
  }

  /**
   * Get sun light instance
   */
  get sunLight(): DirectionalLight | null {
    return this._sunLight;
  }

  /**
   * Get current time of day
   */
  get timeOfDay(): number {
    return this._timeOfDay;
  }

  /**
   * Get whether day/night cycle is animating
   */
  get isAnimating(): boolean {
    return this._isAnimating;
  }

  /**
   * Check if it's currently daytime
   */
  get isDaytime(): boolean {
    const solarAngles = this._calculateSolarPosition(this._timeOfDay, this._dayOfYear, this._latitude);
    return solarAngles.elevation > 0;
  }

  /**
   * Get sun elevation in degrees
   */
  get sunElevation(): number {
    const solarAngles = this._calculateSolarPosition(this._timeOfDay, this._dayOfYear, this._latitude);
    return solarAngles.elevation * 180 / Math.PI;
  }
}

/**
 * Sun system configuration options
 */
export interface SunSystemOptions {
  /** Sun light intensity */
  sunIntensity?: number;
  /** Sun light color */
  sunColor?: Color3;
  /** Initial time of day (0-24 hours) */
  timeOfDay?: number;
  /** Duration of full day cycle in seconds */
  dayDuration?: number;
  /** Day of year (1-365) */
  dayOfYear?: number;
  /** Observer latitude in degrees */
  latitude?: number;
}