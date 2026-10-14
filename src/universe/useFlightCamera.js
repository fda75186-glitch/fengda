import { nextTick, onBeforeUnmount, ref } from 'vue';

export function useFlightCamera(video, changeScene) {
  const active = ref(false), pending = ref(false), message = ref('');
  let stream, request = 0;
  function stop(note = '') {
    request++; stream?.getTracks().forEach(track => track.stop()); stream = null;
    if (video.value) video.value.srcObject = null;
    active.value = false; pending.value = false; message.value = note;
    changeScene(false);
  }
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) { message.value = '当前浏览器无法开启相机，仍可继续 3D 航行。'; return; }
    const ticket = ++request; pending.value = true; message.value = '';
    try {
      const incoming = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (request !== ticket) { incoming.getTracks().forEach(track => track.stop()); return; }
      stream = incoming; active.value = true; await nextTick();
      video.value.srcObject = incoming; await video.value.play(); changeScene(true);
      message.value = '相机为本机科普叠加，不对应真实天空位置。';
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => stop(), { once: true }));
    } catch (error) {
      if (ticket !== request) return;
      stop(error.name === 'NotAllowedError' ? '相机权限未开启，可以继续 3D 航行。' : '相机暂时不可用，可以继续 3D 航行。');
    } finally { if (ticket === request) pending.value = false; }
  }
  function visibility() { if (document.hidden && (active.value || pending.value)) stop('页面进入后台，相机已关闭。'); }
  document.addEventListener('visibilitychange', visibility);
  onBeforeUnmount(() => { stop(); document.removeEventListener('visibilitychange', visibility); });
  return { active, pending, message, start, stop };
}
