import { ArcRotateCamera, Vector3, Animation, EasingFunction, CircleEase } from '@babylonjs/core';

/**
 * 相机控制器配置
 */
export interface CameraControls {
  /** 允许拖拽平移 */
  dragPan?: boolean;
  /** 允许滚轮缩放 */
  scrollZoom?: boolean;
  /** 允许右键拖拽旋转 */
  dragRotate?: boolean;
  /** 允许框选缩放 */
  boxZoom?: boolean;
  /** 允许键盘控制 */
  keyboard?: boolean;
  /** 允许触摸控制 */
  touchZoomRotate?: boolean;
}

/**
 * 相机控制器 - 处理类似 maplibre 的交互控制
 */
export class CameraController {
  private _camera: ArcRotateCamera;
  private _controls: CameraControls;
  private _isAnimating: boolean = false;

  constructor(camera: ArcRotateCamera, controls?: CameraControls) {
    this._camera = camera;
    this._controls = {
      dragPan: true,
      scrollZoom: true,
      dragRotate: false,
      boxZoom: false,
      keyboard: false,
      touchZoomRotate: true,
      ...controls
    };

    this._setupControls();
  }

  /**
   * 飞行到指定位置
   */
  public flyTo(longitude: number, latitude: number, altitude: number): void {
    if (this._isAnimating) return;

    // 将地理坐标转换为球面坐标
    const targetPosition = this._geographicToSpherical(longitude, latitude, altitude);
    const targetTarget = this._geographicToSpherical(longitude, latitude, 0);

    // 创建动画
    this._createFlyAnimation(targetPosition, targetTarget);
  }

  /**
   * 设置相机位置（无动画）
   */
  public setPosition(longitude: number, latitude: number, altitude: number): void {
    const position = this._geographicToSpherical(longitude, latitude, altitude);
    const target = this._geographicToSpherical(longitude, latitude, 0);

    this._camera.setPosition(position);
    this._camera.setTarget(target);
  }

  /**
   * 获取当前相机位置
   */
  public getPosition(): { longitude: number; latitude: number; altitude: number } {
    const position = this._camera.position;
    const target = this._camera.target;

    // 计算相机到地球中心的距离
    const distance = Vector3.Distance(position, Vector3.Zero());

    // 计算经纬度
    const longitude = Math.atan2(position.z, position.x) * 180 / Math.PI;
    const latitude = Math.asin(position.y / distance) * 180 / Math.PI;

    return {
      longitude,
      latitude,
      altitude: distance - 6378137 // 减去地球半径
    };
  }

  /**
   * 设置交互控制
   */
  public setControls(controls: Partial<CameraControls>): void {
    this._controls = { ...this._controls, ...controls };
    this._setupControls();
  }

  /**
   * 获取当前交互控制配置
   */
  public getControls(): CameraControls {
    return { ...this._controls };
  }

  /**
   * 设置相机控制
   */
  private _setupControls(): void {
    // 设置拖拽控制
    this._camera.attachControl(true);

    // 配置拖拽行为
    if (this._controls.dragPan !== undefined) {
      this._camera.panningSensibility = this._controls.dragPan ? 1000 : 0;
    }

    if (this._controls.dragRotate !== undefined) {
      this._camera.angularSensibilityX = this._controls.dragRotate ? 1000 : 0;
      this._camera.angularSensibilityY = this._controls.dragRotate ? 1000 : 0;
    }

    // 配置滚轮缩放
    if (this._controls.scrollZoom !== undefined) {
      this._camera.wheelPrecision = this._controls.scrollZoom ? 50 : 0;
    }

    // 配置键盘控制
    if (this._controls.keyboard !== undefined) {
      this._camera.keysUp = this._controls.keyboard ? [87] : []; // W
      this._camera.keysDown = this._controls.keyboard ? [83] : []; // S
      this._camera.keysLeft = this._controls.keyboard ? [65] : []; // A
      this._camera.keysRight = this._controls.keyboard ? [68] : []; // D
    }

    // 配置触摸控制
    if (this._controls.touchZoomRotate !== undefined) {
      this._camera.pinchPrecision = this._controls.touchZoomRotate ? 1000 : 0;
    }
  }

  /**
   * 创建飞行动画
   */
  private _createFlyAnimation(targetPosition: Vector3, targetTarget: Vector3): void {
    this._isAnimating = true;

    // 创建位置动画
    const positionAnimation = new Animation(
      'positionAnimation',
      'position',
      30,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const keyFrames = [];
    keyFrames.push({
      frame: 0,
      value: this._camera.position.clone()
    });
    keyFrames.push({
      frame: 60,
      value: targetPosition
    });

    positionAnimation.setKeys(keyFrames);

    // 创建目标动画
    const targetAnimation = new Animation(
      'targetAnimation',
      'target',
      30,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const targetKeyFrames = [];
    targetKeyFrames.push({
      frame: 0,
      value: this._camera.target.clone()
    });
    targetKeyFrames.push({
      frame: 60,
      value: targetTarget
    });

    targetAnimation.setKeys(targetKeyFrames);

    // 设置缓动函数
    const easingFunction = new CircleEase();
    easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    positionAnimation.setEasingFunction(easingFunction);
    targetAnimation.setEasingFunction(easingFunction);

    // 开始动画
    this._camera.animations = [positionAnimation, targetAnimation];
    this._camera.beginAnimation(this._camera, 0, 60, false, 1.0, () => {
      this._isAnimating = false;
    });
  }

  /**
   * 将地理坐标转换为球面坐标
   */
  private _geographicToSpherical(longitude: number, latitude: number, altitude: number): Vector3 {
    const earthRadius = 6378137; // 地球半径（米）
    const radius = earthRadius + altitude;

    const lonRad = longitude * Math.PI / 180;
    const latRad = latitude * Math.PI / 180;

    const x = radius * Math.cos(latRad) * Math.cos(lonRad);
    const y = radius * Math.sin(latRad);
    const z = radius * Math.cos(latRad) * Math.sin(lonRad);

    return new Vector3(x, y, z);
  }

  /**
   * 检查是否正在动画中
   */
  public get isAnimating(): boolean {
    return this._isAnimating;
  }
}
