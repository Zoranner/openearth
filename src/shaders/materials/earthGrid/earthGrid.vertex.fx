// 地球网格顶点着色器

precision highp float;

// 输入属性
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

// Uniform 变量
uniform mat4 worldViewProjection;
uniform mat4 world;
uniform vec3 cameraPosition;

// 输出到片段着色器
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vCameraPosition;
varying float vDistanceToCamera;

void main() {
    // 计算世界坐标
    vec4 worldPosition = world * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;

    // 传递法线
    vNormal = normalize((world * vec4(normal, 0.0)).xyz);

    // 传递UV坐标
    vUV = uv;

    // 传递相机位置
    vCameraPosition = cameraPosition;

    // 计算到相机的距离
    vDistanceToCamera = length(worldPosition.xyz - cameraPosition);

    // 输出最终位置
    gl_Position = worldViewProjection * vec4(position, 1.0);
}
