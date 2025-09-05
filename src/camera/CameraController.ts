/**
 * 相机控制模块
 * 提供直观、流畅的3D地球浏览体验
 */

import {
  Vector3,
  Animation,
  EasingFunction,
  CircleEase,
  PointerEventTypes,
  type ArcRotateCamera,
  type Scene,
} from '@babylonjs/core';
import { CameraPositionUtils, type CameraPosition } from '../types';
import { MathUtils, CoordinateUtils } from '../utils/MathUtils';
import { logger } from '../utils/Logger';

export interface CameraControllerConfig {
  enableMouse?: boolean;
  enableWheel?: boolean;
  sensitivity?: number;
  constraints?: ConstraintConfig;
  collision?: CollisionConfig;
  animation?: AnimationConfig;
}

export interface InputConfig {
  sensitivity?: number;
  enableDrag?: boolean;
  enableWheel?: boolean;
}

export interface ConstraintConfig {
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
}

export interface CollisionConfig {
  earthRadius?: number;
  minAltitude?: number;
  maxAltitude?: number;
}

export interface AnimationConfig {
  defaultDuration?: number;
  easingFunction?: string;
}

export interface ConstraintResult {
  position: Vector3;
  rotation: Vector3;
  isConstrained: boolean;
  constraintType: string;
}

/**
 * 输入处理器
 */
class InputHandler {
  private _canvas: HTMLCanvasElement;
  private _scene: Scene;
  private _isEnabled: boolean;
  private _config: InputConfig;
  private _isDragging = false;
  private _lastPointerPosition: { x: number; y: number } | null = null;
  private _onPointerMove: ((deltaX: number, deltaY: number) => void) | undefined;
  private _onWheel: ((delta: number) => void) | undefined;

  constructor(scene: Scene, canvas: HTMLCanvasElement, config: InputConfig) {
    this._scene = scene;
    this._canvas = canvas;
    this._config = {
      sensitivity: 1.0,
      enableDrag: true,
      enableWheel: true,
      ...config,
    };
    this._isEnabled = false;
  }

  initialize(): void {
    if (this._config.enableDrag) {
      this._setupPointerEvents();
    }
    if (this._config.enableWheel) {
      this._setupWheelEvents();
    }

    logger.debug('InputHandler initialized', 'InputHandler', { config: this._config });
  }

  dispose(): void {
    // Babylon.js会自动清理事件监听器
    this._isEnabled = false;
    logger.debug('InputHandler disposed', 'InputHandler');
  }

  enable(): void {
    this._isEnabled = true;
  }

  disable(): void {
    this._isEnabled = false;
    this._isDragging = false;
    this._lastPointerPosition = null;
  }

  setCallbacks(callbacks: {
    onPointerMove?: (deltaX: number, deltaY: number) => void;
    onWheel?: (delta: number) => void;
  }): void {
    this._onPointerMove = callbacks.onPointerMove ?? undefined;
    this._onWheel = callbacks.onWheel ?? undefined;
  }

  private _setupPointerEvents(): void {
    this._scene.onPointerObservable.add(pointerInfo => {
      if (!this._isEnabled) return;

      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN:
          if (pointerInfo.event.button === 0) {
            // 左键 - 用于旋转
            this._isDragging = true;
            this._lastPointerPosition = {
              x: pointerInfo.event.clientX,
              y: pointerInfo.event.clientY,
            };
          }
          // 中键和右键暂时留空，不处理任何操作
          break;

        case PointerEventTypes.POINTERUP:
          this._isDragging = false;
          this._lastPointerPosition = null;
          break;

        case PointerEventTypes.POINTERMOVE:
          if (this._isDragging && this._lastPointerPosition && this._onPointerMove) {
            const sensitivity = this._config.sensitivity ?? 1.0;
            const deltaX = (pointerInfo.event.clientX - this._lastPointerPosition.x) * sensitivity;
            const deltaY = (pointerInfo.event.clientY - this._lastPointerPosition.y) * sensitivity;

            this._onPointerMove(deltaX, deltaY);

            this._lastPointerPosition = {
              x: pointerInfo.event.clientX,
              y: pointerInfo.event.clientY,
            };
          }
          break;
      }
    });
  }

  private _setupWheelEvents(): void {
    this._canvas.addEventListener(
      'wheel',
      event => {
        if (!this._isEnabled || !this._onWheel) return;

        event.preventDefault();
        const sensitivity = this._config.sensitivity ?? 1.0;
        const delta = event.deltaY * sensitivity * 0.001;
        this._onWheel(delta);
      },
      { passive: false }
    );
  }

}

/**
 * 动画管理器
 */
class AnimationManager {
  private _activeAnimation: Animation | null = null;
  private _scene: Scene;
  private _camera: ArcRotateCamera;
  private _isAnimating = false;

  constructor(scene: Scene, camera: ArcRotateCamera) {
    this._scene = scene;
    this._camera = camera;
  }

  createFlyToAnimation(target: CameraPosition, duration: number): void {
    if (this._isAnimating) {
      this.stopAnimation();
    }

    const startPosition = CameraPositionUtils.fromVector3(this._camera.position);
    const targetVector = CameraPositionUtils.toVector3(target);

    // 创建位置动画
    const positionAnimation = new Animation(
      'flyToAnimation',
      'position',
      30,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const keyFrames = [
      { frame: 0, value: this._camera.position.clone() },
      { frame: duration, value: targetVector },
    ];

    positionAnimation.setKeys(keyFrames);

    // 设置缓动函数
    const easingFunction = new CircleEase();
    easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    positionAnimation.setEasingFunction(easingFunction);

    this._camera.animations = [positionAnimation];
    this._activeAnimation = positionAnimation;
    this._isAnimating = true;

    this._scene.beginAnimation(this._camera, 0, duration, false, 1.0, () => {
      this._isAnimating = false;
      this._activeAnimation = null;
      logger.debug('Fly-to animation completed', 'AnimationManager');
    });

    logger.debug('Fly-to animation started', 'AnimationManager', {
      from: startPosition,
      to: target,
      duration,
    });
  }

  stopAnimation(): void {
    if (this._activeAnimation) {
      this._scene.stopAnimation(this._camera);
      this._isAnimating = false;
      this._activeAnimation = null;
      logger.debug('Animation stopped', 'AnimationManager');
    }
  }

  isAnimating(): boolean {
    return this._isAnimating;
  }

  update(): void {
    // 动画更新由Babylon.js自动处理
  }
}

/**
 * 碰撞检测器
 */
class CollisionDetector {
  private _earthRadius: number;
  private _minAltitude: number;
  private _maxAltitude: number;

  constructor(config: CollisionConfig) {
    this._earthRadius = config.earthRadius ?? 6378137;
    this._minAltitude = config.minAltitude ?? 1.2;
    this._maxAltitude = config.maxAltitude ?? 10.0;
  }

  checkCollision(position: Vector3): boolean {
    const distance = position.length();
    return distance < this._earthRadius * this._minAltitude;
  }

  getClosestValidPosition(position: Vector3): Vector3 {
    const distance = position.length();
    const minDistance = this._earthRadius * this._minAltitude;
    const maxDistance = this._earthRadius * this._maxAltitude;

    if (distance < minDistance) {
      return position.normalize().scale(minDistance);
    } else if (distance > maxDistance) {
      return position.normalize().scale(maxDistance);
    }

    return position.clone();
  }

  setEarthRadius(radius: number): void {
    this._earthRadius = radius;
  }

  setAltitudeLimits(min: number, max: number): void {
    this._minAltitude = min;
    this._maxAltitude = max;
  }
}

/**
 * 约束管理器
 */
class ConstraintManager {
  private _minDistance: number;
  private _maxDistance: number;
  private _minPolarAngle: number;
  private _maxPolarAngle: number;

  constructor(config: ConstraintConfig) {
    this._minDistance = config.minDistance ?? 1.2;
    this._maxDistance = config.maxDistance ?? 10.0;
    this._minPolarAngle = config.minPolarAngle ?? 0.1;
    this._maxPolarAngle = config.maxPolarAngle ?? 3.04;
  }

  applyConstraints(position: Vector3, rotation: Vector3): ConstraintResult {
    let constrainedPosition = position.clone();
    const constrainedRotation = rotation.clone();
    let isConstrained = false;
    let constraintType = '';

    // 距离约束
    const distance = position.length();
    if (distance < this._minDistance) {
      constrainedPosition = position.normalize().scale(this._minDistance);
      isConstrained = true;
      constraintType = 'minDistance';
    } else if (distance > this._maxDistance) {
      constrainedPosition = position.normalize().scale(this._maxDistance);
      isConstrained = true;
      constraintType = 'maxDistance';
    }

    // 极角约束
    const polarAngle = Math.acos(MathUtils.clamp(position.y / distance, -1, 1));
    if (polarAngle < this._minPolarAngle) {
      constrainedRotation.x = this._minPolarAngle;
      isConstrained = true;
      constraintType = 'minPolarAngle';
    } else if (polarAngle > this._maxPolarAngle) {
      constrainedRotation.x = this._maxPolarAngle;
      isConstrained = true;
      constraintType = 'maxPolarAngle';
    }

    return {
      position: constrainedPosition,
      rotation: constrainedRotation,
      isConstrained,
      constraintType,
    };
  }

  setDistanceLimits(min: number, max: number): void {
    this._minDistance = min;
    this._maxDistance = max;
  }

  setPolarAngleLimits(min: number, max: number): void {
    this._minPolarAngle = min;
    this._maxPolarAngle = max;
  }

  isWithinConstraints(position: Vector3): boolean {
    const distance = position.length();
    const polarAngle = Math.acos(MathUtils.clamp(position.y / distance, -1, 1));

    return (
      distance >= this._minDistance &&
      distance <= this._maxDistance &&
      polarAngle >= this._minPolarAngle &&
      polarAngle <= this._maxPolarAngle
    );
  }
}

/**
 * 相机控制器
 */
export class CameraController {
  private _camera: ArcRotateCamera;
  private _inputHandler: InputHandler;
  private _animationManager: AnimationManager;
  private _collisionDetector: CollisionDetector;
  private _constraintManager: ConstraintManager;
  private _isInitialized: boolean;
  private _config: Required<CameraControllerConfig>;

  constructor(scene: Scene, camera: ArcRotateCamera, config: CameraControllerConfig = {}) {
    this._camera = camera;
    this._config = {
      enableMouse: config.enableMouse !== false,
      enableWheel: config.enableWheel !== false,
      sensitivity: config.sensitivity ?? 1.0,
      constraints: {
        minDistance: 1.2,
        maxDistance: 10.0,
        minPolarAngle: 0.1,
        maxPolarAngle: 3.04,
        ...config.constraints,
      },
      collision: {
        earthRadius: 6378137,
        minAltitude: 1.2,
        maxAltitude: 10.0,
        ...config.collision,
      },
      animation: {
        defaultDuration: 60, // frames
        easingFunction: 'ease',
        ...config.animation,
      },
    };

    const canvas = scene.getEngine().getRenderingCanvas();
    if (!canvas) {
      throw new Error('Canvas not found');
    }

    this._inputHandler = new InputHandler(scene, canvas, {
      sensitivity: this._config.sensitivity,
      enableDrag: this._config.enableMouse,
      enableWheel: this._config.enableWheel,
    });

    this._animationManager = new AnimationManager(scene, camera);
    this._collisionDetector = new CollisionDetector(this._config.collision);
    this._constraintManager = new ConstraintManager(this._config.constraints);
    this._isInitialized = false;

    logger.debug('CameraController created', 'CameraController', { config: this._config });
  }

  /**
   * 初始化相机控制器
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) {
      logger.warn('CameraController already initialized', 'CameraController');
      return;
    }

    try {
      // 初始化输入处理器
      this._inputHandler.initialize();

      // 设置输入回调
      this._inputHandler.setCallbacks({
        onPointerMove: (deltaX, deltaY) => this._handlePointerMove(deltaX, deltaY),
        onWheel: delta => this._handleWheel(delta),
      });

      // 启用输入处理
      this._inputHandler.enable();

      this._isInitialized = true;
      logger.info('CameraController initialized successfully', 'CameraController');
    } catch (error) {
      logger.error('Failed to initialize CameraController', 'CameraController', error);
      throw error;
    }
  }

  /**
   * 销毁相机控制器
   */
  dispose(): void {
    if (!this._isInitialized) {
      return;
    }

    this._inputHandler.dispose();
    this._animationManager.stopAnimation();

    this._isInitialized = false;
    logger.info('CameraController disposed', 'CameraController');
  }

  /**
   * 飞行到指定位置
   */
  async flyTo(longitude: number, latitude: number, altitude?: number): Promise<void> {
    const targetAltitude = altitude ?? 1000000; // 默认1000km
    const targetPosition: CameraPosition = {
      longitude,
      latitude,
      altitude: targetAltitude,
      heading: 0,
      pitch: 0,
      roll: 0,
    };

    const defaultDuration = this._config.animation?.defaultDuration ?? 2000;
    this._animationManager.createFlyToAnimation(targetPosition, defaultDuration);

    // 等待动画完成
    return new Promise(resolve => {
      const checkComplete = () => {
        if (!this._animationManager.isAnimating()) {
          resolve();
        } else {
          setTimeout(checkComplete, 16); // ~60fps
        }
      };
      checkComplete();
    });
  }

  /**
   * 设置相机位置
   */
  setPosition(longitude: number, latitude: number, altitude: number): void {
    const position = CoordinateUtils.lonLatToCartesian(longitude, latitude, altitude);

    // 应用约束和碰撞检测
    const validPosition = this._collisionDetector.getClosestValidPosition(position);
    const constraintResult = this._constraintManager.applyConstraints(validPosition, Vector3.Zero());

    this._camera.setPosition(constraintResult.position);

    logger.debug('Camera position set', 'CameraController', {
      longitude,
      latitude,
      altitude,
      isConstrained: constraintResult.isConstrained,
    });
  }

  /**
   * 获取相机位置
   */
  getPosition(): CameraPosition {
    return CameraPositionUtils.fromVector3(this._camera.position);
  }

  /**
   * 启用控制
   */
  enableControls(): void {
    this._inputHandler.enable();
    logger.debug('Camera controls enabled', 'CameraController');
  }

  /**
   * 禁用控制
   */
  disableControls(): void {
    this._inputHandler.disable();
    logger.debug('Camera controls disabled', 'CameraController');
  }

  /**
   * 更新相机控制器
   */
  update(): void {
    if (!this._isInitialized) {
      return;
    }

    this._animationManager.update();
  }

  /**
   * 处理鼠标移动
   */
  private _handlePointerMove(deltaX: number, deltaY: number): void {
    // 简化的相机旋转控制
    this._camera.alpha -= deltaX * 0.01;
    const minPolarAngle = this._config.constraints?.minPolarAngle ?? 0.1;
    const maxPolarAngle = this._config.constraints?.maxPolarAngle ?? Math.PI - 0.1;
    this._camera.beta = MathUtils.clamp(this._camera.beta - deltaY * 0.01, minPolarAngle, maxPolarAngle);
  }

  /**
   * 处理滚轮事件
   */
  private _handleWheel(delta: number): void {
    const newRadius = this._camera.radius * (1 + delta);
    const minDistance = this._config.constraints?.minDistance ?? 1;
    const maxDistance = this._config.constraints?.maxDistance ?? 1000000;
    const clampedRadius = MathUtils.clamp(newRadius, minDistance, maxDistance);

    this._camera.radius = clampedRadius;
  }


  /**
   * 获取系统状态
   */
  getStatus(): {
    isInitialized: boolean;
    isAnimating: boolean;
    currentPosition: CameraPosition;
  } {
    return {
      isInitialized: this._isInitialized,
      isAnimating: this._animationManager.isAnimating(),
      currentPosition: this.getPosition(),
    };
  }
}
