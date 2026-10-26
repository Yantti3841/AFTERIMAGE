import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownToLine, ArrowUpFromLine, Camera, Check, Circle, Columns2, Expand, LoaderCircle, Pause, Play, RotateCcw, Square, Volume2, VolumeX, X } from 'lucide-react';
import { createEngine } from './engine';
import { createAudioController } from './audio';
import { downloadFile, shareFile, makePoster } from './share';
import { concertDates, ticketDefaults, ticketFields, drawTicket, saveTicket, creator, formatTicketDate } from './ticket';
import { getDefaults, groups, effects, contourControls, stageControls, timecode } from './settings';
import './style.css';

function Toggle({ label, checked, onChange }) {
  return <button type="button" className={`toggle ${checked ? 'on' : ''}`} role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)}><span /></button>;
}
function Slider({ control, settings, update, disabled }) {
  const [key, label, min, max, step, unit] = control;
  const value = settings[key];
  return <label className={`slider-row ${disabled ? 'disabled' : ''}`}>
    <span>{label}<output>{unit ? `${unit==='EV'&&value>0?'+':''}${value.toFixed(unit==='圈/秒'?3:2)} ${unit}` : `${Math.round(value * 100)}%`}</output></span>
    <input aria-label={label} type="range" min={min} max={max} step={step} value={value} disabled={disabled} style={{ '--fill': `${(value - min) / (max - min) * 100}%` }} onChange={e => update(key, +e.target.value)} />
  </label>;
}
function EffectSection({ title, toggle, controls, settings, update }) {
  return <section className="effect-section"><div className="section-heading"><h3>{title}</h3><Toggle label={`开启${title}`} checked={settings[toggle]} onChange={v => update(toggle, v)} /></div>
    <div className={!settings[toggle] ? 'effect-body inactive' : 'effect-body'}>{controls.map(c => <Slider key={c[0]} control={c} settings={settings} update={update} disabled={!settings[toggle]} />)}</div>
  </section>;
}

function App() {
  const [settings, setSettings] = useState(() => getDefaults('cinematic'));
  const [effectMode, setEffectMode] = useState('cinematic');
  const [mode, setMode] = useState('upload');
  const [source, setSource] = useState('empty');
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState('未载入视频');
  const [error, setError] = useState('');
  const [compare, setCompare] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [busy, setBusy] = useState(false);
  const [fps, setFps] = useState(0);
  const [resolution, setResolution] = useState(() => matchMedia('(max-width: 760px)').matches ? 720 : 1080);
  const [progress, setProgress] = useState({ time: 0, duration: 0 });
  const [download, setDownload] = useState(null);
  const [format, setFormat] = useState('');
  const [ticketOn, setTicketOn] = useState(false);
  const [mobilePanel, setMobilePanel] = useState('source');
  const [expanded, setExpanded] = useState(false);
  const [imageExport, setImageExport] = useState(null);
  const [ticketDetails, setTicketDetails] = useState({ ...ticketDefaults });
  const ticketCanvas = useRef(null);
  const photoInput = useRef(null);
  const ticketState = useRef(null); ticketState.current = { enabled: ticketOn, details: ticketDetails, hasMedia: source !== 'empty' };
  const canvas = useRef(null), engine = useRef(null), video = useRef(null), fileInput = useRef(null), preview = useRef(null);
  const cameraStream = useRef(null), uploadUrl = useRef(null), recorder = useRef(null), audio = useRef(null), requestId = useRef(0), mounted = useRef(true), emptyFrame = useRef(null);
  const activeSource = useRef(source); activeSource.current = source;
  const lastDownload = useRef(null);
  const imageUrl = useRef(null), snapshotRequest = useRef(null);
  const savedSettings = useRef(Object.fromEntries(effects.map(effect=>[effect.id,getDefaults(effect.id)])));
  const update = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  useEffect(() => {
    mounted.current = true;
    const media = document.createElement('video');
    media.playsInline = true; media.muted = true; media.preload = 'auto'; video.current = media;
    audio.current = createAudioController(media);
    try {
      engine.current = createEngine(canvas.current, setFps, setError, frame => {
        const ticket = ticketState.current;
        if (ticket.enabled) drawTicket(ticketCanvas.current, frame, ticket.details, ticket.hasMedia);
        if (snapshotRequest.current) {
          const copy = document.createElement('canvas'), input = ticket.enabled ? ticketCanvas.current : frame;
          copy.width = input.width; copy.height = input.height; copy.getContext('2d').drawImage(input, 0, 0);
          snapshotRequest.current(copy); snapshotRequest.current = null;
        }
      });
      const blank = document.createElement('canvas');
      blank.width = 16; blank.height = 9;
      blank.getContext('2d').fillRect(0, 0, 16, 9);
      emptyFrame.current = blank; engine.current.setSource(blank);
    } catch { setError('无法启动 WebGL，请启用浏览器硬件加速后重试。'); }
    const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    setFormat(typeof MediaRecorder === 'undefined' || !canvas.current.captureStream ? '' : types.find(t => MediaRecorder.isTypeSupported(t)) || '');
    const onTime = () => setProgress({ time: media.currentTime, duration: Number.isFinite(media.duration) ? media.duration : 0 });
    const onEnded = () => { setPlaying(false); engine.current?.freeze(true); if (recorder.current?.state === 'recording') recorder.current.stop(); };
    const onError = () => { setError('无法解码这个视频。MOV/MP4 是容器格式，请尝试 H.264 MP4 或 VP8/VP9 WebM。'); setBusy(false); };
    media.addEventListener('seeked', () => engine.current?.resetHistory());
    media.addEventListener('timeupdate', onTime); media.addEventListener('loadedmetadata', onTime); media.addEventListener('ended', onEnded); media.addEventListener('error', onError);
    const onVisibility = () => { if(document.hidden && recorder.current?.state === 'recording') { recorder.current.stop(); setStatus('页面进入后台，已停止录制并保存已录部分'); } };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mounted.current = false; requestId.current++;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      cameraStream.current?.getTracks().forEach(t => t.stop());
      media.pause(); media.removeAttribute('src'); media.srcObject = null; media.load();
      if(uploadUrl.current) URL.revokeObjectURL(uploadUrl.current);
      if(lastDownload.current) URL.revokeObjectURL(lastDownload.current);
      if(imageUrl.current) URL.revokeObjectURL(imageUrl.current);
      audio.current?.dispose(); engine.current?.dispose();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  useEffect(() => { engine.current?.update(settings, compare, effectMode); }, [settings, compare, effectMode]);
  useEffect(() => { engine.current?.setSize(resolution); }, [resolution]);
  useEffect(() => {
    ticketCanvas.current.width = resolution * 16 / 9;
    ticketCanvas.current.height = resolution;
  }, [resolution]);
  useEffect(() => {
    if (!recording) return;
    const start = performance.now();
    const id = setInterval(() => setRecordTime((performance.now() - start) / 1000), 250);
    return () => clearInterval(id);
  }, [recording]);

  function releaseSource() {
    audio.current.setMuted(true);
    video.current.pause(); cameraStream.current?.getTracks().forEach(t => t.stop()); cameraStream.current = null;
    video.current.srcObject = null; video.current.removeAttribute('src'); video.current.load();
    if (uploadUrl.current) URL.revokeObjectURL(uploadUrl.current); uploadUrl.current = null;
  }
  function switchEffect(id) {
    if (id === effectMode) return;
    savedSettings.current[effectMode] = { ...settings };
    setEffectMode(id); setSettings({ ...savedSettings.current[id] });
  }
  function resetPlayback() { setCompare(false); setPlaying(true); engine.current?.freeze(false); setProgress({ time: 0, duration: 0 }); }
  function restoreEmpty() {
    engine.current?.setSource(emptyFrame.current);
    setSource('empty'); setFileName(''); setStatus('未载入视频'); resetPlayback();
    setPlaying(false); engine.current?.freeze(true);
  }
  function cameraAction() {
    if(source==='camera'){requestId.current++;releaseSource();restoreEmpty();}else startCamera();
  }
  async function startCamera() {
    if (recording || busy || !engine.current) return;
    setBusy(true); setError(''); const id = ++requestId.current;
    let stream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('摄像头需要 localhost 或 HTTPS 安全连接。');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false });
      if(id!==requestId.current || !mounted.current){stream.getTracks().forEach(t=>t.stop());return;}
      releaseSource(); cameraStream.current = stream; video.current.srcObject = stream; video.current.muted = true;
      await video.current.play();
      engine.current.setSource(video.current, true); setMode('camera'); setSource('camera'); setFileName('实时摄像头'); setStatus('摄像头已连接 · 镜像预览'); resetPlayback();
      stream.getVideoTracks()[0].addEventListener('ended', () => { if(activeSource.current==='camera'){setStatus('摄像头连接已断开');setError('摄像头已停止，请重新连接。');if(recorder.current?.state==='recording')recorder.current.stop();} });
    } catch (e) {
      if(stream && cameraStream.current!==stream) stream.getTracks().forEach(t=>t.stop());
      setError(e.name==='NotAllowedError' ? '摄像头权限被拒绝。请在地址栏允许摄像头访问后重试。' : e.name==='NotFoundError' ? '未检测到可用摄像头，可以先上传视频体验。' : e.message || '摄像头连接失败，请检查设备是否被其他程序占用。');
    } finally { if(mounted.current) setBusy(false); }
  }
  async function upload(file) {
    if(!file || recording || busy || !engine.current) return;
    if(!/\.(mp4|mov|webm)$/i.test(file.name)){setError('请选择 MP4、MOV 或 WebM 视频。');return;}
    setBusy(true); setError(''); requestId.current++; releaseSource();
    uploadUrl.current = URL.createObjectURL(file); video.current.src = uploadUrl.current;
    video.current.muted = true; setMuted(true);
    try {
      await audio.current.connectVideo(true);
      await video.current.play();
      engine.current.setSource(video.current); setSource('video'); setMode('upload'); setFileName(file.name); setStatus('视频已载入 · 本地 GPU 处理'); resetPlayback();
    } catch { releaseSource();restoreEmpty();setError('这个视频暂时无法播放，请尝试 H.264 编码 MP4 或 WebM。'); }
    finally {setBusy(false);if(fileInput.current)fileInput.current.value='';}
  }
  async function uploadPhoto(file) {
    if (!file || recording || busy || !engine.current) return;
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) { setError('请选择 JPG、PNG 或 WebP 照片。'); return; }
    setBusy(true); setError(''); const id = ++requestId.current;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (id !== requestId.current || !mounted.current) return;
      releaseSource(); uploadUrl.current = url; engine.current.setSource(image);
      setSource('photo'); setMode('upload'); setFileName(file.name); setTicketOn(true);
      setStatus('照片已载入 · 可保存票根或录制动效'); resetPlayback();
    } catch { setError('无法读取这张照片，请尝试 JPG、PNG 或 WebP。'); }
    finally {
      if (uploadUrl.current !== url) URL.revokeObjectURL(url);
      if (mounted.current) setBusy(false);
      if (photoInput.current) photoInput.current.value = '';
    }
  }
  async function togglePlay() {
    if(recording || busy) return;
    if(source==='empty') return;
    if(source==='photo'){engine.current?.freeze(playing);setPlaying(!playing);return;}
    if(playing) video.current.pause();
    else { try {await video.current.play();} catch {setError('播放失败，请重新载入视频。');return;} }
    engine.current?.freeze(playing);setPlaying(!playing);
  }
  function toggleMute() {
    const next=!muted;setMuted(next);
    audio.current.setMuted(next);
  }
  async function setupAudio() {
    return audio.current.connectVideo(muted);
  }
  async function startRecording() {
    if(!format || !engine.current || busy || source==='empty') return;
    setBusy(true);setError('');setCompare(false);engine.current.update(settings,false,effectMode);
    let stream;
    try {
      let audioTracks=[];
      if(source==='video') {
        audioTracks=await setupAudio(); video.current.pause(); video.current.currentTime=0;
        if(video.current.seeking) await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{video.current.removeEventListener('seeked',done);reject(new Error('视频定位超时，请重新载入后导出。'));},10000);const done=()=>{clearTimeout(timer);resolve();};video.current.addEventListener('seeked',done,{once:true});});
      }
      stream=(ticketOn?ticketCanvas.current:canvas.current).captureStream(30);
      audioTracks.forEach(track=>stream.addTrack(track.clone()));
      const rec=new MediaRecorder(stream,{mimeType:format,videoBitsPerSecond:12_000_000,audioBitsPerSecond:192_000});
      recorder.current=rec;const chunks=[];const exportSource=source;
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      rec.onerror=()=>{setError('录制中断，可能是内存或编码器资源不足。');if(rec.state!=='inactive')rec.stop();};
      rec.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());
        if(!mounted.current)return;
        setRecording(false);setBusy(false);
        if(exportSource==='video'){video.current.pause();setPlaying(false);engine.current?.freeze(true);}
        if(!chunks.length){setError('未产生视频数据，请重试。');return;}
        const type=rec.mimeType||format;const blob=new Blob(chunks,{type});
        if(lastDownload.current)URL.revokeObjectURL(lastDownload.current);
        const url=URL.createObjectURL(blob);lastDownload.current=url;
        const ext=type.includes('mp4')?'mp4':'webm';const name=`afterimage-${ticketOn?'ticket-':''}${new Date().toISOString().replace(/[:.]/g,'-')}.${ext}`;
        setDownload({url,name,blob,size:(blob.size/1024/1024).toFixed(1)});setStatus('处理完成 · 视频已生成');
        const a=document.createElement('a');a.href=url;a.download=name;a.click();
      };
      rec.start(1000);engine.current.freeze(false);setPlaying(true);setRecordTime(0);setRecording(true);
      if(source!=='photo')await video.current.play();
      setStatus(source==='video'?'正在完整导出 · 请保持本页在前台':source==='photo'?'正在录制照片动效':'正在录制摄像头画面');
    } catch(e) {
      if(recorder.current?.state==='recording')recorder.current.stop();else stream?.getTracks().forEach(t=>t.stop());
      setError(`无法开始录制：${e.message}`);setRecording(false);
    } finally {setBusy(false);}
  }
  function stopRecording(){if(recorder.current?.state==='recording'){setBusy(true);recorder.current.stop();}}
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(preview.current.requestFullscreen)await preview.current.requestFullscreen();else setExpanded(true);}catch{setExpanded(true);}}
  function showImage(blob, name) {
    if(imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    const url = URL.createObjectURL(blob); imageUrl.current = url; setImageExport({blob,name,url});
    downloadFile(blob, name);
  }
  async function exportPoster() {
    if (!engine.current || locked) return;
    try {
      const frame = await new Promise(resolve => { snapshotRequest.current = resolve; });
      showImage(await makePoster(frame, ticketOn, effects.find(e=>e.id===effectMode).title), 'afterimage-xhs-1080x1440.png');
    } catch(e) { setError(e.message); }
  }
  async function shareResult(result) {
    try { await shareFile(result.blob,result.name); } catch(e) { if(e.name!=='AbortError')setError('系统分享失败，可以使用下载按钮保存。'); }
  }
  const locked=recording||busy;

  return <div className="app-shell"><header className="brand-header"><h1 aria-label="AFTERIMAGE"><svg viewBox="0 0 1200 142" preserveAspectRatio="none" aria-hidden="true"><text x="0" y="132" textLength="1200" lengthAdjust="spacingAndGlyphs">AFTERIMAGE</text></svg></h1><span>余像</span></header><div className="workspace">
    <aside className={'sidebar panel-'+mobilePanel}>
      <nav className="mobile-nav" aria-label="手机工具导航">{[['source','素材'],['effects','效果'],['ticket','票根'],['parameters','参数']].map(([id,label])=><button key={id} aria-pressed={mobilePanel===id} onClick={()=>setMobilePanel(id)}>{label}</button>)}</nav>
      <section className="source-block">
        <h2>视频输入</h2>
        <div className="source-tabs" role="tablist" aria-label="输入模式">
          <button role="tab" aria-selected={mode==='upload'} disabled={locked} className={mode==='upload'?'selected':''} onClick={()=>setMode('upload')}>上传视频</button>
          <button role="tab" aria-selected={mode==='camera'} disabled={locked} className={mode==='camera'?'selected':''} onClick={()=>setMode('camera')}>摄像头</button>
        </div>
        <button className="source-action" disabled={locked} onClick={()=>mode==='camera'?cameraAction():fileInput.current.click()}>
          {busy?<LoaderCircle className="spin" size={15}/>:mode==='camera'?<Camera size={15}/>:<ArrowUpFromLine size={15}/>}
          {mode==='camera'?(source==='camera'?'关闭摄像头':'开启摄像头'):'选择视频文件'}
        </button>
        <p className="source-hint">{mode==='camera'?'优先使用 1080p / 30 fps':'MP4、MOV、WebM'}</p>
        <input ref={fileInput} hidden type="file" aria-label="上传视频文件" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={e=>upload(e.target.files[0])}/>
      </section>
      <section className="preset-block"><h2>视觉效果</h2><div className="effect-picker" role="group" aria-label="视觉效果">{effects.map(effect=><button key={effect.id} aria-pressed={effectMode===effect.id} className={effectMode===effect.id?'selected':''} onClick={()=>switchEffect(effect.id)}>{effect.title}</button>)}</div></section>
      <section className="effect-section ticket-controls">
        <div className="section-heading"><h3>香港站票根</h3><button type="button" className={`toggle ${ticketOn?'on':''}`} role="switch" aria-label="开启票根模式" aria-checked={ticketOn} disabled={locked} onClick={()=>{setTicketOn(!ticketOn);setCompare(false);}}><span/></button></div>
        {ticketOn&&<>
          <label className="ticket-date">演出日期<select aria-label="演出日期" value={ticketDetails.date} disabled={locked} onChange={e=>setTicketDetails(d=>({...d,date:e.target.value}))}>{concertDates.map(date=><option key={date} value={date}>{formatTicketDate(date)}</option>)}</select></label>
          <button className="ticket-photo" disabled={locked} onClick={()=>photoInput.current.click()}><ArrowUpFromLine size={13}/>{source==='photo'?'更换票根照片':'上传票根照片'}</button>
          <input ref={photoInput} hidden type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" aria-label="上传票根照片" onChange={e=>uploadPhoto(e.target.files[0])}/>
          <div className="ticket-fields">{ticketFields.map(label=><label key={label}>{label}<input aria-label={label} value={ticketDetails[label.toLowerCase()]} maxLength={12} placeholder="填写票面信息" disabled={locked} onChange={e=>setTicketDetails(d=>({...d,[label.toLowerCase()]:e.target.value}))}/></label>)}</div>
          <button className="ticket-save" disabled={locked} onClick={()=>saveTicket(ticketCanvas.current,ticketDetails.date,setError,showImage)}><ArrowDownToLine size={13}/>保存票根 PNG</button>
        </>}
      </section>
      <div className="parameter-scroll">
        {effectMode==='cinematic'?groups.map(g=><EffectSection key={g.toggle} {...g} settings={settings} update={update}/>):<>
          <section className="effect-section"><div className="section-heading"><h3>{effectMode==='contour'?'轮廓参数':'光影参数'}</h3></div>{(effectMode==='contour'?contourControls:stageControls[effectMode]).map(control=><Slider key={control[0]} control={control} settings={settings} update={update}/>)}</section>
        </>}
        <button className="reset-button" onClick={()=>setSettings(getDefaults(effectMode))}><RotateCcw size={13}/>恢复默认参数</button>
      </div>
      <p className="local-note">视频仅在本机处理</p>
    </aside>
    <main className="main-panel">
      <div className="preview-heading"><h2>{ticketOn?'票根预览':'预览'}</h2><span className="file-name" title={fileName}>{fileName||'未选择视频'}</span><div className="preview-actions"><button disabled={locked||source==='empty'||ticketOn} className={compare?'active':''} onClick={()=>setCompare(!compare)}><Columns2 size={14}/>前后对比</button><button aria-label="全屏预览" disabled={source==='empty'&&!ticketOn} onClick={fullscreen}><Expand size={15}/></button></div></div>
      <div className={'preview-stage '+(expanded?'expanded-preview':'')} ref={preview} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();upload(e.dataTransfer.files[0]);}}>
        {expanded&&<button className="close-expanded" aria-label="退出全屏预览" onClick={()=>setExpanded(false)}><X size={20}/></button>}
        <div className={'preview-area '+(source==='empty'&&!ticketOn?'is-empty':'')}>
          <canvas ref={canvas} aria-label="实时滤镜预览" className={ticketOn?'canvas-hidden':''}/>
          <canvas ref={ticketCanvas} aria-label="实时票根预览" className={ticketOn?'':'canvas-hidden'}/>
          {source==='empty'&&!ticketOn&&<div className="empty-state"><p>选择视频，生成你的现场余像</p><button disabled={locked} onClick={()=>fileInput.current.click()}>选择视频文件</button><span>也可以在素材面板开启摄像头</span></div>}
          {compare&&<><div className="compare-line"/><span className="before-label">原始画面</span><span className="after-label">处理后</span></>}
          {recording&&<div className="recording-indicator"><Circle size={7} fill="currentColor"/>{timecode(recordTime)}</div>}
        </div>
      </div>
      <div className="transport">
        <button className="play-button" aria-label={playing?'暂停':'播放'} disabled={locked||(source!=='video'&&source!=='photo')} onClick={togglePlay}>{playing?<Pause size={15}/>:<Play size={15}/>}</button>
        <span className="timecode">{source==='video'?timecode(progress.time)+' / '+timecode(progress.duration):source==='camera'?'实时':source==='photo'?'照片动效':'00:00 / 00:00'}</span>
        <input className="timeline" aria-label="视频进度" type="range" min="0" max={progress.duration||1} step="0.01" value={progress.time} disabled={source!=='video'||locked} onChange={e=>{video.current.currentTime=+e.target.value;setProgress(p=>({...p,time:+e.target.value}));}}/>
        <button className="audio-button" aria-label={muted?'开启原声监听':'关闭原声监听'} disabled={source!=='video'||locked} onClick={toggleMute}>{muted?<VolumeX size={15}/>:<Volume2 size={15}/>}</button>
      </div>
      {error&&<div className="message error" role="alert"><span>{error}</span><button aria-label="关闭提示" onClick={()=>setError('')}><X size={14}/></button></div>}
      <section className="export-panel"><h2>视频导出</h2><div className="export-options">
        <label>分辨率<select aria-label="导出分辨率" disabled={locked} value={resolution} onChange={e=>setResolution(+e.target.value)}><option value={1080}>1920 × 1080</option><option value={720}>1280 × 720</option></select></label>
        <label>帧率<span>30 fps</span></label><label>格式<span>{format?format.includes('mp4')?'MP4 / H.264':'WebM':'不支持录制'}</span></label>
        <button className={'export-button '+(recording?'is-recording':'')} disabled={busy||!format||source==='empty'} onClick={recording?stopRecording:startRecording}>{busy?<LoaderCircle className="spin" size={14}/>:recording?<Square size={12} fill="currentColor"/>:<ArrowDownToLine size={14}/>} {recording?'停止并保存 '+timecode(recordTime):source==='video'?'导出完整视频':source==='photo'?'录制照片动效':'开始录制'}</button>
      </div><p className="export-note">{source==='photo'?(recording?'照片动效录制中，停止后保存。':'照片使用当前滤镜，停止录制后保存视频。'):source==='empty'?'载入视频或开启摄像头后可导出。':recording?(source==='video'?'正在导出 '+Math.round(progress.time/(progress.duration||1)*100)+'% · 保持页面在前台':'录制中，停止后保存'):'按视频时长实时导出，保留上传视频的原声。'}</p></section>
      {download&&<a className="download-result" href={download.url} download={download.name}><Check size={14}/><span>已生成视频，{download.size} MB</span><span>再次下载</span></a>}
      {download&&<button className="share-result" onClick={()=>shareResult(download)}>分享／保存视频到手机</button>}
      <button className="poster-save" disabled={locked||(source==='empty'&&!ticketOn)} onClick={exportPoster}>导出小红书海报 · 3:4</button>
      {!format&&<p className="export-note">此浏览器缺少视频录制能力。可保存图片，或在最新版 Safari / Chrome 中打开后重试视频导出。</p>}
      {imageExport&&<div className="image-result"><img src={imageExport.url} alt="已生成的图片，手机可长按保存"/><div><a href={imageExport.url} download={imageExport.name}>下载图片</a><button onClick={()=>shareResult(imageExport)}>分享／保存到手机</button><button aria-label="关闭图片预览" onClick={()=>setImageExport(null)}><X size={16}/></button></div><p>也可以长按图片保存</p></div>}
      <footer><span role="status">{status}</span><a href={creator.url} target="_blank" rel="noopener noreferrer">小红书 @{creator.name}</a><span>{source==='empty'?'':resolution===1080?'1920 × 1080':'1280 × 720'}{source!=='empty'&&' / '+fps+' fps'}</span></footer>
    </main>
  </div></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
