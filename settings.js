export const defaults = {
  exposure: -0.40, contrast: 1.16, saturation: 0.42, cool: 0.40,
  grain: 0.20, scanlines: 0.26, softness: 0.32, bloom: 0.04, vignette: 0.16,
  lightingOn: true, colorOn: true, grainOn: true,
  scanlinesOn: true, bloomOn: true, vignetteOn: true,
  edgeWidth: 1.25, edgeThreshold: 0.16, edgeGain: 1.65, edgeBreakup: 0.42,
  edgeDetail: 0.45, edgeBrightness: 0.68, edgeTint: 0.38, edgeBlur: 1.8,
  lightExposure: -0.25, lightGlow: 0.65, lightSpread: 9, lightBlur: 2.5,
  lightTrails: 0.32, lightScanlines: 0.35, lightColor: 0.55,
  lightGhost: 0.4,
  lightStreak: 0, lightAngle: 0, lightSlices: 0, lightSuppress: 0, lightCeiling: 1,
  flashStrength: 0.72, flashRate: 0.65, flashThreshold: 0.28,
  cubeSpeed: 0.06, cubeAngle: -28, cubeScale: 1.05, cubeDepth: 1,
  longExposureOn: true, tealThreshold: 0.18, tealDispersion: 0.55,
  rasterDensity: 150, rasterThreshold: 0.16, rasterGain: 1.4, rasterPink: 0.65,
  rasterSparkle: 0.85, rasterSparkSize: 1.2, rasterSparkSpeed: 0.7,
};
export const effects = [
  { id: 'cinematic', title: '1 · 银红重曝', shaderIndex: 0 },
  { id: 'contour', title: '2 · 冷白轮廓', shaderIndex: 1 },
  { id: 'red', title: '3 · 红白泛光', shaderIndex: 2 },
  { id: 'teal', title: '4 · 青绿散射', shaderIndex: 3 },
  { id: 'blue', title: '5 · 电蓝残影', shaderIndex: 4 },
  { id: 'flash', title: '6 · 白色闪光', shaderIndex: 5 },
  { id: 'cube', title: '7 · 蓝色旋屏', shaderIndex: 6 },
  { id: 'raster', title: '8 · 荧光线栅', shaderIndex: 7 },
];
export function getDefaults(id) {
  const overrides = {
    cinematic: { exposure: -0.18, contrast: 1.22, saturation: 0.36, softness: 0.45, bloom: 0.12, lightStreak: 0.65, lightAngle: -42, lightTrails: 0.4, lightGhost: 0.38 },
    red: { lightExposure: -0.25, lightGlow: 0.35, lightSpread: 12, lightBlur: 2.6, lightTrails: 0.68, lightColor: 0.34, lightScanlines: 0.48, lightStreak: 0.65, lightAngle: -42, lightSlices: 0.28, lightGhost: 0.62, lightCeiling: 0.92 },
    teal: { lightExposure: -0.1, lightGlow: 0.65, lightSpread: 19, lightBlur: 2.8, lightTrails: 0.32, lightColor: 0.12, lightScanlines: 0.18 },
    blue: { lightExposure: -0.55, lightGlow: 0.25, lightSpread: 14, lightBlur: 4.2, lightTrails: 0.84, lightColor: 0.92, lightScanlines: 0.38, lightGhost: 0.70, lightStreak: 0.48, lightAngle: -12, lightSlices: 0, lightSuppress: 0.86, lightCeiling: 0.72 },
    flash: { lightExposure: -0.4, lightGlow: 0.48, lightSpread: 15, lightBlur: 1.2, lightTrails: 0.22, lightStreak: 0.48, lightGhost: 0.22, lightScanlines: 0.25, flashRate: 1.1 },
    cube: { lightExposure: 0.1, lightGlow: 0.3, lightSpread: 12, lightBlur: 1.2, lightTrails: 0.12, lightColor: 0.68, lightScanlines: 0.24 },
    raster: { lightExposure: 0, lightGlow: 0.78, lightSpread: 12, lightBlur: 0.85, lightTrails: 0.1, rasterPink: 0.8 },
  };
  return { ...defaults, ...overrides[id] };
}
const lightControls = [
  ['lightExposure', '画面曝光', -2, 1, 0.01, 'EV'],
  ['lightGlow', '泛光强度', 0, 1, 0.01], ['lightSpread', '光晕扩散', 1, 30, 0.5, 'px'],
  ['lightBlur', '画面模糊', 0, 10, 0.1, 'px'], ['lightTrails', '拖影留存', 0, 0.92, 0.01],
  ['lightScanlines', '屏幕横纹', 0, 1, 0.01],
];
const streakControls = [
  ['lightStreak', '方向长影', 0, 1, 0.01], ['lightAngle', '长影角度', -90, 90, 1, '°'],
  ['lightGhost', '残影偏移', 0, 1, 0.01], ['lightSlices', '切片错位', 0, 1, 0.01],
];
export const stageControls = {
  red: [...lightControls, ...streakControls, ['lightColor', '红色染色', 0, 1, 0.01]],
  teal: [...lightControls, ['tealThreshold', '暗部截止', 0, 0.65, 0.01], ['tealDispersion', '亮部色散', 0, 1, 0.01], ['lightColor', '绿 → 青 → 深蓝', 0, 1, 0.01]],
  blue: [...lightControls, ...streakControls.filter(control=>control[0]!=='lightSlices'), ['lightColor', '电蓝色深', 0, 1, 0.01], ['lightSuppress', '平坦亮部抑制', 0, 1, 0.01], ['lightCeiling', '高光上限', 0.3, 1, 0.01]],
  flash: [
    ['flashStrength', '闪光强度', 0, 1, 0.01], ['flashRate', '闪光频率', 0, 2, 0.05, 'Hz'],
    ['flashThreshold', '高光阈值', 0.05, 0.85, 0.01], ['lightStreak', '竖向拉光', 0, 1, 0.01],
    ...lightControls, ['lightGhost', '残影偏移', 0, 1, 0.01],
  ],
  cube: [
    ['cubeSpeed', '旋转速度', -0.2, 0.2, 0.005, '圈/秒'], ['cubeAngle', '起始角度', -180, 180, 1, '°'],
    ['cubeScale', '屏幕大小', 0.55, 1.4, 0.01], ['cubeDepth', '立体深度', 0.2, 1.2, 0.01],
    ...lightControls, ['lightColor', '冷蓝染色', 0, 1, 0.01],
  ],
  raster: [
    ['rasterSparkle', '闪光亮点', 0, 1, 0.01], ['rasterSparkSize', '光点大小', 0.5, 2, 0.05, '×'],
    ['rasterSparkSpeed', '闪烁速度', 0, 2, 0.05, 'Hz'],
    ['rasterDensity', '线栅密度', 50, 260, 1, '线'], ['rasterThreshold', '显影阈值', 0.03, 0.65, 0.01],
    ['rasterGain', '轮廓亮度', 0.5, 2.5, 0.01], ['rasterPink', '粉白亮点', 0, 1, 0.01],
    ...lightControls.filter(control=>control[0]!=='lightScanlines'),
  ],
};
export const contourControls = [
  ['edgeWidth', '线条宽度', 0.5, 3, 0.05, 'px'],
  ['edgeThreshold', '边缘阈值', 0.02, 0.5, 0.01],
  ['edgeGain', '轮廓强度', 0.3, 3, 0.01],
  ['edgeBreakup', '线条破碎', 0, 1, 0.01],
  ['edgeDetail', '细节颗粒', 0, 1, 0.01],
  ['edgeBrightness', '线条亮度', 0.1, 1, 0.01],
  ['edgeTint', '冷蓝色调', 0, 1, 0.01],
  ['edgeBlur', '轮廓模糊', 0, 10, 0.1, 'px'],
];
export const groups = [
  { title: '明暗', toggle: 'lightingOn', controls: [
    ['exposure', '曝光', -2, 1, 0.01, 'EV'], ['contrast', '明暗反差', 0.5, 2, 0.01],
  ] },
  { title: '色彩', toggle: 'colorOn', controls: [
    ['saturation', '饱和度', 0, 1.5, 0.01], ['cool', '暗部冷色', 0, 1, 0.01],
  ] },
  { title: '颗粒', toggle: 'grainOn', controls: [['grain', '颗粒强度', 0, 1, 0.01]] },
  { title: '屏幕质感', toggle: 'scanlinesOn', controls: [['scanlines', '横向纹理', 0, 1, 0.01], ['softness', '屏幕柔化', 0, 1, 0.01]] },
  { title: '泛光', toggle: 'bloomOn', controls: [['bloom', '高光泛光', 0, 1, 0.01]] },
  { title: '暗角', toggle: 'vignetteOn', controls: [['vignette', '边缘压暗', 0, 1, 0.01]] },
  { title: '长曝光', toggle: 'longExposureOn', controls: [
    ['lightStreak', '斜向拖光', 0, 1, 0.01], ['lightAngle', '拖光角度', -90, 90, 1, '°'],
    ['lightTrails', '重曝留存', 0, 0.85, 0.01], ['lightGhost', '重曝偏移', 0, 1, 0.01],
  ] },
];
export const timecode = (s) => `${Math.floor((s || 0) / 60).toString().padStart(2, '0')}:${Math.floor((s || 0) % 60).toString().padStart(2, '0')}`;
