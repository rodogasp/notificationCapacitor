import './style.css';

const fileInput = document.querySelector<HTMLInputElement>('#media-file');
const player = document.querySelector<HTMLVideoElement>('#video-player');
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
  if (status) status.textContent = 'Video selected. Use the video controls to play.';
});

player?.addEventListener('error', () => {
  if (status) status.textContent = 'This browser cannot decode this video format.';
});
