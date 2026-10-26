import * as THREE from 'three';
import { defaults, effects } from './settings';

const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uSize, uSourceSize;
uniform float uTime, uCompare, uMirror;
uniform float exposure, contrast, saturation, cool, grain, scanlines, softness, bloom, vignette;
uniform float lightingOn, colorOn, grainOn, scanlinesOn, bloomOn, vignetteOn;
uniform float uEffectMode, edgeWidth, edgeThreshold, edgeGain, edgeBreakup;
uniform float edgeDetail, edgeBrightness, edgeTint;
uniform float lightExposure, lightGlow, lightSpread, lightScanlines, lightColor;
uniform float lightSuppress, lightSlices;
uniform float flashStrength, flashRate, flashThreshold;
uniform float cubeSpeed, cubeAngle, cubeScale, cubeDepth;
uniform float tealThreshold, tealDispersion, rasterDensity, rasterThreshold, rasterGain, rasterPink;
uniform float rasterSparkle, rasterSparkSize, rasterSparkSpeed;
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float luminance(vec2 p) { return dot(texture2D(uSource,clamp(p,0.0,1.0)).rgb,vec3(0.2126,0.7152,0.0722)); }
float flashPulse() {
  if(flashRate<0.001)return 0.0;
  float cycle=floor(uTime*flashRate),phase=fract(uTime*flashRate);
  float first=exp(-phase*16.0);
  float echo=exp(-abs(phase-0.18)*55.0)*0.45*step(0.55,hash(vec2(cycle,3.7)));
  return max(first,echo)*(0.72+0.28*hash(vec2(cycle,1.9)));
}
vec3 whiteFlash(vec2 uv) {
  vec3 raw=texture2D(uSource,uv).rgb;
  float l=dot(raw,vec3(0.2126,0.7152,0.0722))*exp2(lightExposure);
  float pulse=flashPulse()*flashStrength;
  float highlight=smoothstep(flashThreshold,flashThreshold+0.25,l);
  float v=l*0.82+highlight*pulse*(0.8+l*1.7);
  vec3 c=mix(vec3(v),raw*exp2(lightExposure)*0.82,0.23);
  c*=smoothstep(0.0,0.07,l);
  c*=1.0-lightScanlines*0.23*(0.5+0.5*cos(uv.y*300.0*6.283185));
  return clamp(c,0.0,1.0);
}
vec3 fluorescentRaster(vec2 uv) {
  float l=luminance(uv)*exp2(lightExposure);
  vec2 d=vec2(1.5)/uSourceSize;
  float edge=length(vec2(luminance(uv+vec2(d.x,0))-luminance(uv-vec2(d.x,0)),
    luminance(uv+vec2(0,d.y))-luminance(uv-vec2(0,d.y))));
  float stripe=pow(0.5+0.5*cos(uv.y*rasterDensity*6.283185),5.0);
  float body=smoothstep(rasterThreshold,rasterThreshold+0.22,l);
  float outline=smoothstep(0.018,0.18,edge);
  float fleck=hash(floor(uv*uSourceSize/1.3));
  float sparks=outline*smoothstep(0.08,0.45,l)*mix(0.28,1.0,step(0.48,fleck));
  vec3 green=vec3(0.48,0.72,0.20)*body*stripe*0.25;
  vec3 pink=mix(vec3(0.85,1.0,0.82),vec3(1.0,0.68,0.93),rasterPink);
  // Soft, independently twinkling points follow source highlights and local detail.
  float spacing=max(2.0,uSourceSize.y/90.0*rasterSparkSize);
  vec2 grid=uv*uSourceSize/spacing,cell=floor(grid);
  float seed=hash(cell);
  vec2 center=vec2(0.5)+(vec2(seed,hash(cell+17.3))-0.5)*0.35;
  vec2 anchorUV=clamp((cell+center)*spacing/uSourceSize,0.0,1.0);
  float anchor=luminance(anchorUV)*exp2(lightExposure);
  vec2 radius=vec2(spacing*0.4)/uSourceSize;
  float surround=(luminance(anchorUV+vec2(radius.x,0))+luminance(anchorUV-vec2(radius.x,0))
    +luminance(anchorUV+vec2(0,radius.y))+luminance(anchorUV-vec2(0,radius.y)))*0.25*exp2(lightExposure);
  float detail=smoothstep(0.008,0.08,abs(anchor-surround));
  float mask=smoothstep(max(0.015,rasterThreshold*0.3),rasterThreshold+0.12,anchor)
    *max(detail,smoothstep(0.35,0.8,anchor)*0.7);
  vec2 q=(fract(grid)-center)*vec2(1.0,1.2);
  float point=1.0-smoothstep(0.12,0.34,length(q));
  float rays=max((1.0-smoothstep(0.015,0.045,abs(q.x)))*(1.0-smoothstep(0.08,0.46,abs(q.y))),
    (1.0-smoothstep(0.015,0.045,abs(q.y)))*(1.0-smoothstep(0.08,0.46,abs(q.x))));
  float twinkle=rasterSparkSpeed<0.001?1.0:0.12+0.88*pow(0.5+0.5*sin(uTime*rasterSparkSpeed*6.283185+seed*6.283185),3.0);
  float glow=(point+rays*step(0.93,seed)*0.4)*mask*twinkle*rasterSparkle*3.5;
  vec3 core=mix(pink,vec3(1.0,0.97,1.0),point*0.85);
  vec3 c=green*(1.0-min(sparks,1.0)*0.9)+pink*sparks*(0.55+stripe*0.85)+core*glow;
  return clamp(c*rasterGain*smoothstep(0.0,0.055,l),0.0,1.0);
}
mat3 turnY(float a) {
  float c=cos(a),s=sin(a);
  return mat3(c,0.0,-s,0.0,1.0,0.0,s,0.0,c);
}
vec3 rotatingScreen(vec2 uv) {
  // Intersect a camera ray with a rotated prism; each vertical face carries the live video.
  vec3 ray=normalize(vec3((uv-0.5)*vec2(uSize.x/uSize.y,1.0)*1.4,-1.6));
  float tilt=0.10;
  mat3 tip=mat3(1.0,0.0,0.0,0.0,cos(tilt),-sin(tilt),0.0,sin(tilt),cos(tilt));
  mat3 inverseTurn=turnY(-(cubeAngle*0.017453293+uTime*cubeSpeed*6.283185))*tip;
  vec3 origin=inverseTurn*vec3(0.0,0.12,4.8)/cubeScale;
  vec3 direction=inverseTurn*ray;
  vec3 bounds=vec3(0.65,1.05,0.65*cubeDepth);
  vec3 inverseRay=1.0/(mix(vec3(-1.0),vec3(1.0),step(vec3(0.0),direction))*max(abs(direction),vec3(0.00001)));
  vec3 a=(-bounds-origin)*inverseRay,b=(bounds-origin)*inverseRay;
  vec3 nearFace=min(a,b),farFace=max(a,b);
  float enter=max(max(nearFace.x,nearFace.y),nearFace.z);
  float leave=min(min(farFace.x,farFace.y),farFace.z);
  if(leave<max(enter,0.0))return vec3(0.0);
  vec3 hit=origin+direction*enter;
  vec2 face;
  float faceWidth,shade;
  if(nearFace.y>max(nearFace.x,nearFace.z))return vec3(0.015,0.025,0.07);
  if(nearFace.x>nearFace.z){
    face=vec2(hit.z/(2.0*bounds.z)+0.5,hit.y/(2.0*bounds.y)+0.5);
    if(hit.x>0.0)face.x=1.0-face.x;
    faceWidth=2.0*bounds.z;shade=0.78;
  }else{
    face=vec2(hit.x/(2.0*bounds.x)+0.5,hit.y/(2.0*bounds.y)+0.5);
    if(hit.z<0.0)face.x=1.0-face.x;
    faceWidth=2.0*bounds.x;shade=1.0;
  }
  float faceAspect=faceWidth/(2.0*bounds.y),sourceAspect=uSourceSize.x/uSourceSize.y;
  vec2 crop=vec2(min(1.0,faceAspect/sourceAspect),min(1.0,sourceAspect/faceAspect));
  vec2 sampleUV=(face-0.5)*crop+0.5;
  if(uMirror>0.5)sampleUV.x=1.0-sampleUV.x;
  vec3 raw=texture2D(uSource,clamp(sampleUV,0.0,1.0)).rgb*exp2(lightExposure);
  float l=dot(raw,vec3(0.2126,0.7152,0.0722));
  vec3 c=mix(raw,vec3(l),0.7);
  c=mix(c,c*vec3(0.5,0.62,1.25)+vec3(0.025,0.035,0.075)*smoothstep(0.02,0.2,l),lightColor);
  c=mix(c,vec3(l*0.90,l*0.93,l),smoothstep(0.65,1.0,l)*0.65);
  c*=shade*(1.0-lightScanlines*0.25*(0.5+0.5*cos(face.y*300.0*6.283185)));
  return clamp(c,0.0,1.0);
}
vec3 contour(vec2 uv) {
  vec2 p=uv;
  vec2 d=vec2(edgeWidth)/uSourceSize;
  float tl=luminance(p+vec2(-d.x,d.y)), tc=luminance(p+vec2(0,d.y)), tr=luminance(p+d);
  float ml=luminance(p-vec2(d.x,0)), mc=luminance(p), mr=luminance(p+vec2(d.x,0));
  float bl=luminance(p-d), bc=luminance(p-vec2(0,d.y)), br=luminance(p+vec2(d.x,-d.y));
  float gx=-tl-2.0*ml-bl+tr+2.0*mr+br;
  float gy=-bl-2.0*bc-br+tl+2.0*tc+tr;
  float gradient=length(vec2(gx,gy))*0.75;
  float threshold=edgeThreshold;
  float line=smoothstep(threshold*0.45,threshold*1.5,gradient);
  float detail=abs(mc-(tl+tc+tr+ml+mr+bl+bc+br)/8.0);
  float detailMask=smoothstep(threshold*0.06,threshold*0.45,detail)*edgeDetail;
  vec2 cell=floor(p*uSourceSize/1.4);
  float fleck=hash(cell);
  float broken=mix(1.0,smoothstep(edgeBreakup*0.8,0.95,fleck),edgeBreakup);
  float signal=max(line*broken,detailMask*step(0.56,fleck));
  signal=1.0-exp(-signal*edgeGain);
  signal*=edgeBrightness*0.8;
  vec3 cold=mix(vec3(0.78,0.80,0.80),vec3(0.50,0.72,0.78),edgeTint);
  return cold*signal*(0.76+0.24*fleck);
}
vec3 stageColor(vec3 raw, float structure) {
  float l=dot(raw,vec3(0.2126,0.7152,0.0722))*exp2(lightExposure);
  l=max(l-0.015,0.0)*smoothstep(0.0,0.055,l);
  if(uEffectMode<2.5) {
    vec3 neutral=mix(vec3(l),raw*exp2(lightExposure),0.16);
    vec3 red=vec3(l*1.22,l*0.26,l*0.34);
    return mix(neutral,red,lightColor*(1.0-smoothstep(0.28,0.82,l)));
  }
  if(uEffectMode<3.5) {
    vec3 hue=lightColor<0.5?mix(vec3(0.04,1.0,0.25),vec3(0.03,0.91,1.0),lightColor*2.0)
      :mix(vec3(0.03,0.91,1.0),vec3(0.08,0.20,1.0),(lightColor-0.5)*2.0);
    vec3 tint=mix(hue,vec3(0.86,1.0,0.91),smoothstep(0.38,0.85,l)*0.9);
    return tint*pow(l,1.3)*1.2*smoothstep(max(0.0,tealThreshold-0.07),tealThreshold+0.12,l);
  }
  // Bright, smooth walls stay navy. Cyan is reserved for local detail and highlights.
  float v=pow(l,1.18)*0.95;
  v*=mix(1.0,0.08+structure*0.92,lightSuppress);
  v+=structure*0.20*(1.0-smoothstep(0.25,0.65,l))*smoothstep(0.0,0.06,l);
  vec3 navy=mix(vec3(0.025,0.09,0.75),vec3(0.018,0.035,0.88),lightColor);
  float core=smoothstep(0.55,0.95,max(max(raw.r,raw.g),raw.b))*structure;
  vec3 tint=mix(navy,vec3(0.10,0.82,1.0),core*0.85);
  return tint*v;
}
vec3 stage(vec2 uv) {
  vec2 p=uv;
  if(uEffectMode<2.5) {
    float band=floor((p.y+p.x*0.25)*12.0);
    float lower=1.0-smoothstep(0.32,0.7,p.y);
    p.x+=(hash(vec2(band,2.7))-0.5)*lightSlices*0.07*lower;
  }

  vec3 base=texture2D(uSource,clamp(p,0.0,1.0)).rgb;
  float structure=1.0;
  if(uEffectMode>3.5){
    vec2 d=vec2(18.0)/uSourceSize;
    float center=dot(base,vec3(0.2126,0.7152,0.0722));
    float a=luminance(p+vec2(d.x,0)), b=luminance(p-vec2(d.x,0));
    float c=luminance(p+vec2(0,d.y)), e=luminance(p-vec2(0,d.y));
    float local=(a+b+c+e)*0.25;
    float contrast=abs(center-local)+0.22*(abs(a-b)+abs(c-e));
    structure=smoothstep(0.012,0.15,contrast);
  }
  vec3 c=stageColor(base,structure);
  if(uEffectMode>2.5&&uEffectMode<3.5){
    vec2 shift=vec2(2.0+tealDispersion*9.0,0.0)/uSourceSize;
    float center=luminance(p),left=luminance(p-shift),right=luminance(p+shift);
    c+=vec3(0.12,1.0,0.28)*max(left-center,0.0)*tealDispersion*0.65;
    c+=vec3(0.35,0.9,1.0)*max(right-center,0.0)*tealDispersion*0.35;
  }
  float row=p.y*300.0;
  c*=1.0-lightScanlines*0.32*(0.5+0.5*cos(row*6.283185));
  float l=dot(c,vec3(0.333));
  c+=(hash(gl_FragCoord.xy+fract(uTime)*279.0)-0.5)*0.016*smoothstep(0.0,0.03,l);
  return clamp(c,0.0,1.0);
}
vec3 grade(vec3 c) {
  vec3 sourceColor=c;
  if(lightingOn>0.5) {
    c*=exp2(exposure);
    c=(c-0.12)*contrast+0.12;
    c=max(c,vec3(0.0));
    c=c/(vec3(1.0)+c*0.42); // subdued LED highlights, without a lifted black floor
    float l=dot(c,vec3(0.2126,0.7152,0.0722));
    c*=smoothstep(0.0,0.035,l);
  }
  if(colorOn>0.5) {
    float l=dot(c,vec3(0.2126,0.7152,0.0722));
    float blueDetail=smoothstep(0.012,0.10,sourceColor.b-sourceColor.r);
    c=mix(vec3(l),c,mix(saturation,max(saturation,0.72),blueDetail*cool));
    // Charcoal backgrounds stay neutral; existing navy detail keeps its color.
    float midtones=smoothstep(0.015,0.12,l)*(1.0-smoothstep(0.45,0.75,l));
    c+=vec3(-0.004,-0.003,0.018)*cool*midtones*(1.0-smoothstep(0.10,0.30,l));
    // Only warm source detail receives the muted rose tint; blacks stay neutral.
    float warm=smoothstep(0.015,0.12,sourceColor.r-sourceColor.g)
      *smoothstep(-0.015,0.055,sourceColor.g-sourceColor.b)*midtones;
    c=mix(c,vec3(l*1.30,l*0.87,l*0.90),warm*0.50);
  }
  return c;
}
void main() {
  vec2 uv=vUv;
  float sourceAspect=uSourceSize.x/uSourceSize.y, frameAspect=uSize.x/uSize.y;
  vec2 fit=vec2(min(1.0,sourceAspect/frameAspect),min(1.0,frameAspect/sourceAspect));
  vec2 suv=(uv-0.5)/fit+0.5;
  if(uEffectMode>5.5&&uEffectMode<6.5 && (uCompare<0.5||uv.x>=0.5)){gl_FragColor=vec4(rotatingScreen(uv),1.0);return;}
  if(suv.x<0.0||suv.x>1.0||suv.y<0.0||suv.y>1.0){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}
  if(uMirror>0.5) suv.x=1.0-suv.x;
  vec3 original=texture2D(uSource,suv).rgb;
  if(uCompare>0.5 && uv.x<0.5){gl_FragColor=vec4(original,1.0);return;}
  if(uEffectMode>6.5){gl_FragColor=vec4(fluorescentRaster(suv),1.0);return;}
  if(uEffectMode>4.5&&uEffectMode<5.5){gl_FragColor=vec4(whiteFlash(suv),1.0);return;}
  if(uEffectMode>1.5){gl_FragColor=vec4(stage(suv),1.0);return;}
  if(uEffectMode>0.5){gl_FragColor=vec4(contour(suv),1.0);return;}
  vec3 screen=original;
  if(scanlinesOn>0.5 && softness>0.001) {
    vec2 d=vec2(1.4)/uSourceSize;
    vec3 neighbors=texture2D(uSource,clamp(suv+vec2(d.x,0),0.0,1.0)).rgb
      +texture2D(uSource,clamp(suv-vec2(d.x,0),0.0,1.0)).rgb
      +texture2D(uSource,clamp(suv+vec2(0,d.y),0.0,1.0)).rgb
      +texture2D(uSource,clamp(suv-vec2(0,d.y),0.0,1.0)).rgb;
    screen=mix(original,neighbors*0.25,softness*0.8);
  }
  vec3 c=grade(screen);
  if(bloomOn>0.5 && bloom>0.001) {
    vec3 b=vec3(0.0);
    for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) {
      vec3 s=texture2D(uSource,clamp(suv+vec2(float(x),float(y))*5.0/uSourceSize,0.0,1.0)).rgb;
      b+=max(s-0.55,0.0);
    }
    c+=b/9.0*bloom*0.65;
  }
  // Use source-space rows so LED texture keeps the same scale at 720p and 1080p.
  if(scanlinesOn>0.5) {
    float row=suv.y*270.0;
    float variation=0.65+0.35*hash(vec2(floor(row/6.0),0.0));
    c*=1.0-scanlines*0.38*variation*(0.5+0.5*cos(row*6.283185));
  }
  if(grainOn>0.5) {
    float n=hash(gl_FragCoord.xy+fract(uTime)*vec2(1234.3,789.1))-0.5;
    float l=max(dot(c,vec3(0.333)),0.0);
    c+=n*grain*0.09*smoothstep(0.0,0.035,l)*(0.4+sqrt(l));
  }
  if(vignetteOn>0.5) {
    vec2 q=(uv-0.5)*vec2(1.0,0.85);
    c*=1.0-vignette*smoothstep(0.12,0.65,length(q))*0.8;
  }
  gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
}`;

const postShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uCurrent, uPrevious, uBloom;
uniform vec2 uSize, uSourceSize;
uniform float uBlur, uPersistence, uGhost, uCompare;
uniform float uGlowGain, uSpread;
uniform float uStreak, uAngle, uCeiling, uStreakPixels, uEffectMode;
vec3 sampleCurrent(vec2 p){if(uCompare>0.5)p.x=max(p.x,0.5+0.5/uSize.x);return texture2D(uCurrent,clamp(p,0.0,1.0)).rgb;}
void main(){
  vec2 uv=vUv;
  float sa=uSourceSize.x/uSourceSize.y, fa=uSize.x/uSize.y;
  vec2 fit=vec2(min(1.0,sa/fa),min(1.0,fa/sa));
  if(uEffectMode>5.5&&uEffectMode<6.5)fit=vec2(1.0);
  vec2 sourceUV=(uv-0.5)/fit+0.5;
  if(sourceUV.x<0.0||sourceUV.x>1.0||sourceUV.y<0.0||sourceUV.y>1.0){gl_FragColor=vec4(0,0,0,1);return;}
  if(uCompare>0.5&&uv.x<0.5){gl_FragColor=texture2D(uCurrent,uv);return;}
  vec3 current=sampleCurrent(uv);
  if(uBlur>0.001){
    vec2 d=vec2(uBlur)/uSize;
    current*=0.24;
    current+=(sampleCurrent(uv+vec2(d.x,0))+sampleCurrent(uv-vec2(d.x,0))+sampleCurrent(uv+vec2(0,d.y))+sampleCurrent(uv-vec2(0,d.y)))*0.12;
    current+=(sampleCurrent(uv+d)+sampleCurrent(uv-d)+sampleCurrent(uv+vec2(d.x,-d.y))+sampleCurrent(uv+vec2(-d.x,d.y)))*0.07;
  }
  if(uGlowGain>0.001){
    vec2 d=vec2(0.0,uSpread*0.5/uSize.y);
    vec3 glow=texture2D(uBloom,uv).rgb*0.227027;
    glow+=(texture2D(uBloom,uv+d*1.384615).rgb+texture2D(uBloom,uv-d*1.384615).rgb)*0.316216;
    glow+=(texture2D(uBloom,uv+d*3.230769).rgb+texture2D(uBloom,uv-d*3.230769).rgb)*0.070270;
    current+=glow*uGlowGain;
  }
  vec2 direction=vec2(cos(uAngle),sin(uAngle));
  if(uStreak>0.001){
    vec3 streak=vec3(0.0);float weights=0.0;
    float pixels=uStreakPixels*(uEffectMode>4.5&&uEffectMode<5.5?uSize.y/1080.0:1.0);
    for(int i=1;i<=24;i++){
      float t=float(i)/24.0, w=exp(-t*2.5);
      vec2 p=uv-direction*uStreak*pixels*t/uSize;
      vec3 s=(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0)?vec3(0.0):sampleCurrent(p);
      float highlight=smoothstep(0.10,0.65,max(max(s.r,s.g),s.b));
      streak+=s*highlight*w;weights+=w;
    }
    current+=streak/weights*uStreak*0.9;
  }
  vec2 historyUV=uv-direction*uGhost*12.0/uSize;
  if(uCompare>0.5)historyUV.x=max(historyUV.x,0.5+0.5/uSize.x);
  vec2 historySourceUV=(historyUV-0.5)/fit+0.5;
  bool inside=all(greaterThanEqual(historySourceUV,vec2(0.0)))&&all(lessThanEqual(historySourceUV,vec2(1.0)));
  vec3 previous=inside?texture2D(uPrevious,historyUV).rgb:vec3(0.0);
  vec3 result=mix(current,previous,uPersistence);
  result*=min(1.0,uCeiling/max(max(max(result.r,result.g),result.b),0.00001));
  gl_FragColor=vec4(result,1.0);
}`;
const bloomShader=`
precision highp float;varying vec2 vUv;uniform sampler2D uFrame;uniform vec2 uSize;uniform float uSpread,uCompare;
vec3 bright(vec2 p){
  if(uCompare>0.5)p.x=max(p.x,0.5+0.5/uSize.x);
  vec3 c=texture2D(uFrame,clamp(p,0.0,1.0)).rgb;
  return c*smoothstep(0.18,0.75,max(max(c.r,c.g),c.b));
}
void main(){
  vec2 d=vec2(uSpread*0.5/uSize.x,0.0);
  vec3 c=bright(vUv)*0.227027;
  c+=(bright(vUv+d*1.384615)+bright(vUv-d*1.384615))*0.316216;
  c+=(bright(vUv+d*3.230769)+bright(vUv-d*3.230769))*0.070270;
  gl_FragColor=vec4(c,1.0);
}`;
const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';

export function createEngine(canvas, onStats, onError, onFrame) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(1920, 1080, false);
  const uniforms = {
    uSource: { value: new THREE.Texture() }, uSize: { value: new THREE.Vector2(1920, 1080) },
    uSourceSize: { value: new THREE.Vector2(1920, 1080) }, uTime: { value: 0 }, uCompare: { value: 0 }, uMirror: { value: 0 },
    uEffectMode: { value: 0 },
  };
  Object.entries(defaults).forEach(([key, value]) => { uniforms[key] = { value: typeof value === 'boolean' ? +value : value }; });
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false });
  const scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2, 2);
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.Camera();
  const postUniforms = {
    uCurrent:{value:null},uPrevious:{value:null},uSize:uniforms.uSize,uSourceSize:uniforms.uSourceSize,
    uBlur:{value:0},uPersistence:{value:0},uGhost:{value:0},uCompare:uniforms.uCompare,
    uBloom:{value:null},uGlowGain:{value:0},uSpread:uniforms.lightSpread,
    uStreak:{value:0},uAngle:{value:0},uCeiling:{value:1},
    uStreakPixels:{value:90},uEffectMode:uniforms.uEffectMode,
  };
  const postMaterial=new THREE.ShaderMaterial({uniforms:postUniforms,vertexShader,fragmentShader:postShader,depthTest:false,depthWrite:false});
  const displayMaterial=new THREE.ShaderMaterial({uniforms:{uFrame:{value:null}},vertexShader,fragmentShader:'precision highp float;varying vec2 vUv;uniform sampler2D uFrame;void main(){gl_FragColor=texture2D(uFrame,vUv);}',depthTest:false,depthWrite:false});
  const bloomMaterial=new THREE.ShaderMaterial({uniforms:{uFrame:{value:null},uSize:uniforms.uSize,uSpread:uniforms.lightSpread,uCompare:uniforms.uCompare},vertexShader,fragmentShader:bloomShader,depthTest:false,depthWrite:false});
  const postScene=new THREE.Scene(),displayScene=new THREE.Scene(),bloomScene=new THREE.Scene();
  postScene.add(new THREE.Mesh(geometry,postMaterial));displayScene.add(new THREE.Mesh(geometry,displayMaterial));
  bloomScene.add(new THREE.Mesh(geometry,bloomMaterial));
  let targets, historyIndex=0, historyValid=false, dirty=true, persistence=0, cinemaPost=false;
  function resetHistory(){historyValid=false;dirty=true;}
  function ensureTargets(){
    if(targets)return;
    const size=uniforms.uSize.value;
    targets=Array.from({length:3},()=>new THREE.WebGLRenderTarget(size.x,size.y,{depthBuffer:false,stencilBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter}));
    targets.push(new THREE.WebGLRenderTarget(Math.ceil(size.x/4),Math.ceil(size.y/4),{depthBuffer:false,stencilBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter}));
  }
  let disposed = false, raf, source, ready = false, frames = 0, lastStat = performance.now(), lastFrame = 0, start = performance.now(), frozen = false, frozenAt = 0, pausedTotal = 0;
  const render = (now) => {
    if (disposed) return;
    raf = requestAnimationFrame(render);
    if (now-lastFrame < 1000/30-1) return;
    lastFrame=now;
    if (source instanceof HTMLVideoElement && source.readyState>=2) {
      uniforms.uSourceSize.value.set(source.videoWidth,source.videoHeight); ready=true;
    }
    if (!ready) return;
    uniforms.uTime.value = ((frozen ? frozenAt : now)-start-pausedTotal)/1000;
    if(uniforms.uEffectMode.value<0.5&&!cinemaPost){renderer.setRenderTarget(null);renderer.render(scene,camera);}
    else {
      ensureTargets();
      if(!frozen||dirty){
        renderer.setRenderTarget(targets[0]);renderer.render(scene,camera);
        if(uniforms.uEffectMode.value>1.5){
          bloomMaterial.uniforms.uFrame.value=targets[0].texture;
          renderer.setRenderTarget(targets[3]);renderer.render(bloomScene,camera);
        }
        postUniforms.uBloom.value=targets[3].texture;
        const blue=uniforms.uEffectMode.value===4;
        postUniforms.uGlowGain.value=uniforms.uEffectMode.value>1.5?uniforms.lightGlow.value*(blue?0.6:1.4):0;
        const read=targets[1+historyIndex],write=targets[1+(1-historyIndex)];
        postUniforms.uCurrent.value=targets[0].texture;postUniforms.uPrevious.value=read.texture;
        postUniforms.uPersistence.value=historyValid?persistence:0;
        renderer.setRenderTarget(write);renderer.render(postScene,camera);
        historyIndex=1-historyIndex;historyValid=true;dirty=false;
      }
      displayMaterial.uniforms.uFrame.value=targets[1+historyIndex].texture;
      renderer.setRenderTarget(null);renderer.render(displayScene,camera);
    }
    onFrame?.(canvas);
    frames++;
    if(now-lastStat>1000){onStats(Math.round(frames*1000/(now-lastStat)));frames=0;lastStat=now;}
  };
  raf=requestAnimationFrame(render);
  const onLost=(event)=>{event.preventDefault();onError('GPU 上下文已中断，请刷新页面重新初始化。');};
  canvas.addEventListener('webglcontextlost',onLost);
  return {
    setSource(media, mirror=false) {
      resetHistory();
      source=media; ready=false;
      uniforms.uSource.value.dispose();
      const texture=media instanceof HTMLVideoElement ? new THREE.VideoTexture(media) : new THREE.Texture(media);
      texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
      uniforms.uSource.value=texture;uniforms.uMirror.value=+mirror;
      if(!(media instanceof HTMLVideoElement)){uniforms.uSourceSize.value.set(media.width,media.height);ready=true;}
    },
    update(settings, compare, effectMode = 'cinematic') {
      const mode=effects.find(effect=>effect.id===effectMode).shaderIndex;
      const nextCinemaPost=mode===0&&settings.longExposureOn;
      if(mode!==uniforms.uEffectMode.value || +compare!==uniforms.uCompare.value || frozen || nextCinemaPost!==cinemaPost)resetHistory();
      dirty=true;
      Object.entries(settings).forEach(([key,value])=>{uniforms[key].value=typeof value==='boolean'?+value:value;});
      uniforms.uCompare.value=+compare;
      uniforms.uEffectMode.value=mode;
      cinemaPost=nextCinemaPost;
      postUniforms.uBlur.value=mode===0?0:mode===1?settings.edgeBlur:settings.lightBlur;
      persistence=mode>1||cinemaPost?settings.lightTrails:0;
      const directional=cinemaPost||mode===2||mode===4||mode===5;
      postUniforms.uGhost.value=directional?settings.lightGhost:0;
      postUniforms.uStreak.value=directional?settings.lightStreak:0;
      postUniforms.uAngle.value=(mode===5?90:directional?settings.lightAngle:0)*Math.PI/180;
      postUniforms.uStreakPixels.value=mode===5?260:90;
      postUniforms.uCeiling.value=mode===2||mode===4?settings.lightCeiling:1;
    },
    resetHistory,
    setSize(height){renderer.setSize(height*16/9,height,false);uniforms.uSize.value.set(height*16/9,height);targets?.forEach((target,index)=>target.setSize(index===3?Math.ceil(height*16/9/4):height*16/9,index===3?Math.ceil(height/4):height));resetHistory();},
    freeze(value){if(value&&!frozen) frozenAt=performance.now();if(!value&&frozen) pausedTotal+=performance.now()-frozenAt;frozen=value;},
    dispose(){disposed=true;cancelAnimationFrame(raf);canvas.removeEventListener('webglcontextlost',onLost);uniforms.uSource.value.dispose();targets?.forEach(target=>target.dispose());geometry.dispose();material.dispose();postMaterial.dispose();displayMaterial.dispose();bloomMaterial.dispose();renderer.dispose();},
  };
}
