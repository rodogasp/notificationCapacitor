import { App } from '@capacitor/app';
import { registerPlugin } from '@capacitor/core';
import './style.css';

interface ForegroundService { startForegroundService(): Promise<{ status: string }>; stopForegroundService(): Promise<{ status: string }>; }
const service = registerPlugin<ForegroundService>('MediaPlayback');
const fileInput = document.querySelector<HTMLInputElement>('#media-file');
const audio = document.querySelector<HTMLAudioElement>('#audio-player');
const selected = document.querySelector<HTMLParagraphElement>('#selected-file');
const status = document.querySelector<HTMLParagraphElement>('#status');
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
  if (status) status.textContent = 'Audio selected. Use the browser audio controls.';
});
audio?.addEventListener('play', () => console.log('[AUDIO] play'));
audio?.addEventListener('pause', () => console.log('[AUDIO] pause'));
audio?.addEventListener('error', () => { if (status) status.textContent = 'Browser cannot decode this file.'; });

function run(action: 'startForegroundService' | 'stopForegroundService') {
  void service[action]().then((result) => { if (status) status.textContent = result.status; }).catch((error) => { if (status) status.textContent = String(error); });
}
document.querySelector('#start-service')?.addEventListener('click', () => run('startForegroundService'));
document.querySelector('#stop-service')?.addEventListener('click', () => run('stopForegroundService'));
