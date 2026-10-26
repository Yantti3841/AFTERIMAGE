// Monitoring and export use separate branches so muted previews keep the source audio.
export function createAudioController(video) {
  let ctx, videoInput, destination, monitor;
  return {
    async connectVideo(muted) {
      if (!ctx) {
        ctx = new AudioContext(); destination = ctx.createMediaStreamDestination();
        monitor = ctx.createGain(); monitor.connect(ctx.destination);
        videoInput = ctx.createMediaElementSource(video);
        videoInput.connect(destination); videoInput.connect(monitor);
      }
      monitor.gain.value = muted ? 0 : 1; video.muted = false;
      await ctx.resume();
      return destination.stream.getAudioTracks();
    },
    setMuted(muted) { if (monitor) monitor.gain.value = muted ? 0 : 1; },
    dispose() { videoInput?.disconnect(); monitor?.disconnect(); ctx?.close(); },
  };
}
