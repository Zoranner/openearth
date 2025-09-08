// 地球网格片段着色器 - 重新设计
// 支持标准经纬度网格显示，0度线高亮，自适应细分

precision highp float;

// 数学常量
#define PI 3.14159265359

// 从顶点着色器传入的变量
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vCameraPosition;
varying float vDistanceToEarthCenter;

// Uniform 变量
uniform vec3 baseColor;
uniform vec3 gridColor;
uniform vec3 zeroLineColor;
uniform float gridOpacity;
uniform float lineWidth;
uniform sampler2D diffuseMap;
uniform float diffuseOpacity; // 0..1, 0表示禁用纹理
uniform float gridEnabled;    // 0或1，控制是否显示网格
uniform vec2 atlasOrigin;     // 合成纹理在Mercator归一化空间的原点（0..1）
uniform vec2 atlasScale;      // 合成纹理覆盖范围尺寸（0..1）

// 将3D世界坐标转换为经纬度（度数）
vec2 worldToLatLon(vec3 worldPos) {
    // 标准化位置向量
    vec3 normalized = normalize(worldPos);

    // 计算纬度：y坐标直接对应纬度
    // asin返回-π/2到π/2，转换为-90°到90°
    float latitude = asin(normalized.y) * 180.0 / PI;

    // // 计算经度：确保0°在-z方向
    // // 使用atan2(x, -z)，这样-z方向为0°，+x方向为90°
    // float longitude = atan(normalized.x, -normalized.z) * 180.0 / PI;
    // 计算经度：使用标准球坐标系约定
    // atan2(z, x) - 0°经度对应+x轴方向，90°经度对应+z轴方向
    float longitude = atan(normalized.z, normalized.x) * 180.0 / PI;

    return vec2(longitude, latitude);
}

// 计算网格线强度（无缝周期法）
// 使用正弦周期函数替代 fract，避免±180° 经度缝合处导数异常
// 并基于信号自身的一阶导数做抗锯齿，保证屏幕空间线宽一致
float calculateGridLine(float coordinate, float gridStepDeg) {
    // 角度转弧度
    float coordRad = coordinate * PI / 180.0;
    float stepRad = max(gridStepDeg, 0.0001) * PI / 180.0;

    // 构造周期信号：当 coordRad 为 stepRad 的整数倍时为 0
    // 使用 sin(PI * coord/step) 确保无缝且在所有区间连续
    float s = sin((PI * coordRad) / stepRad);
    float dist = abs(s);

    // 基于信号自身的屏幕空间导数做自适应抗锯齿
    // 采用 0.7071 * |∇s| 近似 fwidth
    float aa = 0.7071 * length(vec2(dFdx(s), dFdy(s)));
    float width = max(aa, 1e-5) * lineWidth * 1.5; // 增加线宽系数，让网格线更粗

    // 转换为线条强度（越靠近线越亮）
    return 1.0 - smoothstep(0.0, width, dist);
}

void main() {
    // 将世界坐标转换为经纬度
    vec2 latlon = worldToLatLon(vWorldPosition);
    float longitude = latlon.x;  // -180° 到 180°
    float latitude = latlon.y;   // -90° 到 90°

    // 根据相机距离选择网格细分级别
    float distance = vDistanceToEarthCenter;
    float gridStep;

    if (distance < 0.5) {
        gridStep = 1.0;   // 1度网格
    } else if (distance < 1.0) {
        gridStep = 2.0;   // 2度网格
    } else if (distance < 2.5) {
        gridStep = 5.0;   // 5度网格
    } else if (distance < 5.0) {
        gridStep = 10.0;  // 10度网格
    } else if (distance < 7.5) {
        gridStep = 15.0;  // 15度网格
    } else if (distance < 15.0) {
        gridStep = 30.0;  // 30度网格
    } else {
        gridStep = 60.0;  // 60度网格
    }

    // 计算经线和纬线的强度
    float meridianStrength = 0.0;
    float parallelStrength = 0.0;

    // 只在低纬度区域计算经线，避免极地性能问题
    float latitudeAbs = abs(latitude);
    if (latitudeAbs < min(90.0 - gridStep, 80.0)) {
        meridianStrength = calculateGridLine(longitude, gridStep);  // 经线
        parallelStrength = calculateGridLine(latitude, gridStep);  // 纬线
    }

    // 合并网格线强度
    float totalGridStrength = max(meridianStrength, parallelStrength);

    // 视角依赖的强度调整（避免边缘网格线过细）
    float viewAngle = abs(dot(normalize(vCameraPosition - vWorldPosition), vNormal));
    float angleMultiplier = smoothstep(0.1, 0.5, viewAngle);
    totalGridStrength *= angleMultiplier;

    // 检测0度线并选择颜色（仅改变颜色，不改变线宽/强度）
    // 直接从经纬度判断：0°经线（本初子午线）和0°纬线（赤道）
    bool isZero = (abs(longitude) < 0.5) || (abs(latitude) < 0.5);
    vec3 finalGridColor = isZero ? zeroLineColor : gridColor;

    // 采样底图纹理（Web Mercator），与基础色混合
    vec3 baseCol = baseColor;
    if (diffuseOpacity > 0.0) {
        float phi = latitude * PI / 180.0;
        float mercX = (longitude + 180.0) / 360.0;
        float mercY = (1.0 - log(tan(phi) + 1.0 / cos(phi)) / PI) * 0.5;
        vec2 uvMerc = vec2(clamp(mercX, 0.0, 1.0), clamp(mercY, 0.0, 1.0));
        // 将全局Mercator坐标映射到合成纹理的局部坐标
        vec2 uvLocal = (uvMerc - atlasOrigin) / max(atlasScale, vec2(1e-6));
        if (uvLocal.x >= 0.0 && uvLocal.x <= 1.0 && uvLocal.y >= 0.0 && uvLocal.y <= 1.0) {
            vec3 texCol = texture2D(diffuseMap, uvLocal).rgb;
            baseCol = mix(baseCol, texCol, clamp(diffuseOpacity, 0.0, 1.0));
        }
    }

    // 先得到底色，再将网格覆盖在上层
    float gridMix = totalGridStrength * gridOpacity * gridEnabled;
    vec3 finalColor = mix(baseCol, finalGridColor, clamp(gridMix, 0.0, 1.0));

    gl_FragColor = vec4(finalColor, 1.0);
}
