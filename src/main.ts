import { registerPlugin } from '@capacitor/core';
import './style.css';
interface MediaPlayback { selectMediaFile(): Promise<{ name: string }>; showNotification(): Promise<{ status: string }>; startPlayer(): Promise<{ status: string }>; stopPlayer(): Promise<{ status: string }>; startForegroundService(): Promise<{ status: string }>; stopForegroundService(): Promise<{ status: string }>; }
const media = registerPlugin<MediaPlayback>('MediaPlayback');
const status = document.querySelector<HTMLParagraphElement>('#status');
const selected = document.querySelector<HTMLParagraphElement>('#selected-file');
function run(method: keyof Omit<MediaPlayback, 'selectMediaFile'>) { void media[method]().then((result) => { if (status) status.textContent = result.status; }).catch((error) => { if (status) status.textContent = String(error); }); }
document.querySelector('#media-file')?.addEventListener('click', () => void media.selectMediaFile().then((file) => { if (selected) selected.textContent = file.name; }));
document.querySelector('#show-notification')?.addEventListener('click', () => run('showNotification'));
document.querySelector('#play-audio')?.addEventListener('click', () => run('startPlayer'));
document.querySelector('#stop-audio')?.addEventListener('click', () => run('stopPlayer'));
document.querySelector('#start-service')?.addEventListener('click', () => run('startForegroundService'));
document.querySelector('#stop-service')?.addEventListener('click', () => run('stopForegroundService'));
