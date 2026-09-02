import './style.css';

const fileInput = document.querySelector<HTMLInputElement>('#media-file');
const player = document.querySelector<HTMLAudioElement>('#audio-player');
const selectedFile = document.querySelector<HTMLParagraphElement>('#selected-file');
const status = document.querySelector<HTMLParagraphElement>('#status');
let mediaUrl: string | undefined;

fileInput?.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file || !player) return;
  if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  mediaUrl = URL.createObjectURL(file);
  player.src = mediaUrl;
  if (selectedFile) selectedFile.textContent = file.name;
  if (status) status.textContent = player.canPlayType(file.type || 'video/x-matroska')
    ? 'Media file selected.'
    : 'Media file selected, but this browser may not decode MKV audio.';
});

document.querySelector('#play-audio')?.addEventListener('click', () => {
  if (!player?.src) {
    if (status) status.textContent = 'Select an audio file first.';
    return;
  }
  void player.play();
  if (status) status.textContent = 'Playing.';
});

document.querySelector('#stop-audio')?.addEventListener('click', () => {
  if (!player) return;
  player.pause();
  player.currentTime = 0;
  if (status) status.textContent = 'Stopped.';
});
