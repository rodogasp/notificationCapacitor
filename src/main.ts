import { registerPlugin } from '@capacitor/core';
import './style.css';

interface MediaPlayback {
  showNotification(): Promise<{ status: string }>;
  startPlayer(): Promise<{ status: string }>;
  stopPlayer(): Promise<{ status: string }>;
  startForegroundService(): Promise<{ status: string }>;
  stopForegroundService(): Promise<{ status: string }>;
}

const media = registerPlugin<MediaPlayback>('MediaPlayback');
const fileInput = document.querySelector<HTMLInputElement>('#media-file');
const player = document.querySelector<HTMLVideoElement>('#video-player');
const selected = document.querySelector<HTMLParagraphElement>('#selected-file');
const status = document.querySelector<HTMLParagraphElement>('#status');
let mediaUrl: string | undefined;

fileInput?.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file || !player) return;
  if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  mediaUrl = URL.createObjectURL(file);
  player.src = mediaUrl;
  if (selected) selected.textContent = file.name;
  if (status) status.textContent = 'Media selected. Press play on the video controls.';
});

player?.addEventListener('error', () => {
  if (status) status.textContent = 'This WebView cannot decode this media format.';
});

player?.addEventListener('play', () => {
  void media.showNotification()
    .then((result) => { if (status) status.textContent = result.status; })
    .catch((error) => { if (status) status.textContent = `Notification error: ${String(error)}`; });
});

function run(method: keyof MediaPlayback) {
  void media[method]().then((result) => { if (status) status.textContent = result.status; }).catch((error) => { if (status) status.textContent = String(error); });
}

document.querySelector('#show-notification')?.addEventListener('click', () => run('showNotification'));
document.querySelector('#play-audio')?.addEventListener('click', () => run('startPlayer'));
document.querySelector('#stop-audio')?.addEventListener('click', () => run('stopPlayer'));
document.querySelector('#start-service')?.addEventListener('click', () => run('startForegroundService'));
document.querySelector('#stop-service')?.addEventListener('click', () => run('stopForegroundService'));
