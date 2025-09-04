// 地球网格片段着色器

precision highp float;

// 数学常量
#define PI 3.14159265359
#define GRID_MAJOR_LINES 18.0
#define GRID_MINOR_LINES 36.0

// 从顶点着色器传入的变量
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vCameraPosition;
varying float vDistanceToCamera;

// Uniform 变量
uniform vec3 baseColor;
uniform vec3 gridColor;
uniform float gridOpacity;
uniform float majorLineWidth;
uniform float minorLineWidth;
uniform float fadeDistance;
uniform float maxViewDistance;

// 球面坐标转换
vec2 cartesianToSpherical(vec3 position) {
    float longitude = atan(position.z, position.x);
    float latitude = asin(position.y / length(position));
    return vec2(longitude, latitude);
}

// 弧度转角度
float rad2deg(float radians) {
    return radians * 180.0 / PI;
}

// 计算网格线强度
float gridLine(float coord, float gridSize, float lineWidth) {
    float grid = abs(fract(coord * gridSize) - 0.5) / fwidth(coord * gridSize);
    return 1.0 - min(grid / lineWidth, 1.0);
}

// 基于距离的淡出
float distanceFade(float distance, float fadeStart, float fadeEnd) {
    return 1.0 - smoothstep(fadeStart, fadeEnd, distance);
}

void main() {
    // 将世界坐标转换为球面坐标 (经纬度)
    vec3 normalizedPos = normalize(vWorldPosition);
    vec2 spherical = cartesianToSpherical(normalizedPos);

    // 转换为度数并调整范围
    float longitude = rad2deg(spherical.x);
    float latitude = rad2deg(spherical.y);

    // 调整坐标范围到 0-1
    float lon = (longitude + 180.0) / 360.0;
    float lat = (latitude + 90.0) / 180.0;

    // 计算网格线
    float majorGridLon = gridLine(lon, GRID_MAJOR_LINES, majorLineWidth);
    float majorGridLat = gridLine(lat, GRID_MAJOR_LINES, majorLineWidth);
    float minorGridLon = gridLine(lon, GRID_MINOR_LINES, minorLineWidth);
    float minorGridLat = gridLine(lat, GRID_MINOR_LINES, minorLineWidth);

    // 合并网格线
    float majorGrid = max(majorGridLon, majorGridLat);
    float minorGrid = max(minorGridLon, minorGridLat);
    float totalGrid = max(majorGrid * 1.0, minorGrid * 0.6);

    // 基于距离的淡出
    float fadeout = distanceFade(vDistanceToCamera, fadeDistance, maxViewDistance);
    totalGrid *= fadeout;

    // 视角依赖的强度调整
    float viewAngle = dot(normalize(vCameraPosition - vWorldPosition), vNormal);
    float angleMultiplier = smoothstep(0.0, 0.3, abs(viewAngle));
    totalGrid *= angleMultiplier;

    // 基于缩放级别的自适应显示
    float zoomLevel = vDistanceToCamera / 3.0;

    if (zoomLevel > 2.0) {
        // 远距离：只显示主要经纬线
        totalGrid = majorGrid * fadeout * angleMultiplier;
    } else if (zoomLevel > 1.0) {
        // 中距离：显示主要和次要网格
        totalGrid = max(majorGrid, minorGrid * 0.5) * fadeout * angleMultiplier;
    }

    // 混合基础颜色和网格
    vec3 finalColor = mix(baseColor, gridColor, totalGrid * gridOpacity);

    gl_FragColor = vec4(finalColor, 1.0);
}
