import { App } from '@capacitor/app';
import './style.css';
const fileInput = document.querySelector<HTMLInputElement>('#media-file');
const audio = document.querySelector<HTMLAudioElement>('#audio-player');
const selected = document.querySelector<HTMLParagraphElement>('#selected-file');
let mediaUrl: string | undefined;

App.addListener('pause', () => { console.log('[APP] pause'); });
App.addListener('resume', () => { console.log('[APP] resume'); });
setInterval(() => { console.log('[KEEPALIVE]', new Date().toISOString()); }, 1000);

fileInput?.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file || !audio) return;
  if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  mediaUrl = URL.createObjectURL(file);
  audio.src = mediaUrl;
  if (selected) selected.textContent = file.name;
  console.log('[AUDIO] selected', file.name);
});
audio?.addEventListener('play', () => console.log('[AUDIO] play'));
audio?.addEventListener('pause', () => console.log('[AUDIO] pause'));
audio?.addEventListener('error', () => console.error('[AUDIO] decode error'));
