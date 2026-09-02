import './style.css';

import { registerPlugin } from '@capacitor/core';

interface MediaPlaybackPlugin {
	showNotification(): Promise<{ status: string }>;
	startPlayer(): Promise<{ status: string }>;
	stopPlayer(): Promise<{ status: string }>;
	startForegroundService(): Promise<{ status: string }>;
	stopForegroundService(): Promise<{ status: string }>;
	selectMediaFile(): Promise<{ name: string; uri: string }>;
}

const mediaPlayback = registerPlugin<MediaPlaybackPlugin>('MediaPlayback');
const status = document.querySelector<HTMLParagraphElement>('#status');
const selectedFile = document.querySelector<HTMLParagraphElement>('#selected-file');

function report(action: Promise<{ status: string }>) {
	void action.then((result) => {
		if (status) status.textContent = result.status;
	}).catch((error: unknown) => {
		if (status) status.textContent = error instanceof Error ? error.message : String(error);
	});
}

document.querySelector<HTMLInputElement>('#media-file')?.addEventListener('change', () => {
	report(mediaPlayback.selectMediaFile().then((file) => {
		if (selectedFile) selectedFile.textContent = file.name;
		return { status: `Selected ${file.name}` };
	}));
});
document.querySelector('#show-notification')?.addEventListener('click', () => report(mediaPlayback.showNotification()));
document.querySelector('#play-audio')?.addEventListener('click', () => report(mediaPlayback.startPlayer()));
document.querySelector('#stop-audio')?.addEventListener('click', () => report(mediaPlayback.stopPlayer()));
document.querySelector('#start-service')?.addEventListener('click', () => report(mediaPlayback.startForegroundService()));
document.querySelector('#stop-service')?.addEventListener('click', () => report(mediaPlayback.stopForegroundService()));
