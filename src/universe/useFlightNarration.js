import { onBeforeUnmount, ref } from 'vue';

export function useFlightNarration() {
  const enabled = ref(false), speaking = ref(false), message = ref('');
  const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let current = null, generation = 0;
  function stop() {
    generation++; if (supported) window.speechSynthesis.cancel();
    current = null; speaking.value = false;
  }
  function speak(item) {
    stop(); message.value = '';
    if (!supported) { message.value = '当前浏览器没有语音引擎，可以阅读文字介绍。'; return; }
    const text = item?.voice || `${item?.name || ''}。${item?.description || ''}`;
    if (!text.trim()) return;
    const ticket = generation;
    current = new SpeechSynthesisUtterance(text);
    current.lang = 'zh-CN'; current.rate = .93;
    current.voice = window.speechSynthesis.getVoices().find(voice => /^zh/i.test(voice.lang)) || null;
    current.onstart = () => { if (ticket === generation) speaking.value = true; };
    current.onend = () => { if (ticket === generation) speaking.value = false; };
    current.onerror = event => {
      if (ticket !== generation) return;
      speaking.value = false;
      if (!['canceled', 'interrupted'].includes(event.error)) message.value = '语音未能播放，请重试或阅读文字介绍。';
    };
    window.speechSynthesis.speak(current);
  }
  function arrive(item) { if (enabled.value) speak(item); else stop(); }
  function toggle(item) {
    enabled.value = !enabled.value;
    if (enabled.value) speak(item); else stop();
  }
  onBeforeUnmount(stop);
  return { enabled, speaking, message, supported, speak, stop, arrive, toggle };
}
