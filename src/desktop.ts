import { DEV_TEST_BEARER_TOKEN } from './config';
import './desktop.css';

const backendUrl = document.querySelector<HTMLInputElement>('#desktop-backend-url')!;
const bearerToken = document.querySelector<HTMLInputElement>('#desktop-bearer-token')!;
const userId = document.querySelector<HTMLInputElement>('#desktop-user-id')!;
const callerName = document.querySelector<HTMLInputElement>('#desktop-caller-name')!;
const status = document.querySelector<HTMLElement>('#desktop-status')!;
const result = document.querySelector<HTMLElement>('#desktop-result')!;
const serverLogs = document.querySelector<HTMLElement>('#desktop-server-logs')!;
const callId = crypto.randomUUID();
let peerConnection: RTCPeerConnection | null = null;
let signalingSocket: WebSocket | null = null;
let pendingPhoneCandidates: RTCIceCandidateInit[] = [];
let remoteAudio: HTMLAudioElement | null = null;

backendUrl.value = localStorage.getItem('desktop-backend-url') || 'http://localhost:3000';
bearerToken.value = localStorage.getItem('desktop-bearer-token') || DEV_TEST_BEARER_TOKEN;

function setStatus(message: string, failed = false): void {
  status.textContent = message;
  status.classList.toggle('failed', failed);
}

function saveSettings(): void {
  localStorage.setItem('desktop-backend-url', backendUrl.value.trim());
  localStorage.setItem('desktop-bearer-token', bearerToken.value);
}

function appendServerLog(record: unknown): void {
  if (isHealthLog(record)) return;
  if (isTransportNoise(record)) return;
  const line = typeof record === 'string' ? record : JSON.stringify(record, null, 2);
  serverLogs.textContent += `${line}\n`;
  serverLogs.scrollTop = serverLogs.scrollHeight;
}

function isTransportNoise(record: unknown): boolean {
  if (!record || typeof record !== 'object') return false;
  const message = record as { msg?: unknown; viewer?: unknown };
  return message.msg === 'WS_HEARTBEAT'
    || message.msg === 'WS_PING'
    || message.msg === 'WS_HEARTBEAT_TIMEOUT'
    || message.viewer === 'WS_HEARTBEAT';
}

function isHealthLog(record: unknown): boolean {
  if (!record || typeof record !== 'object') return false;
  const request = (record as { req?: { url?: unknown } }).req;
  return request?.url === '/health';
}

function connectServerLogViewer(): void {
  const baseUrl = backendUrl.value.trim() || 'http://localhost:3000';
  try {
    const url = new URL(baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.search = '';
    appendServerLog({ viewer: 'WS_CONNECTING', url: url.toString() });
    const socket = new WebSocket(url);
    signalingSocket = socket;
    const connectionId = crypto.randomUUID();
    let heartbeatTimer: number | null = null;
    socket.addEventListener('open', () => {
      appendServerLog({ viewer: 'WS_OPEN', connectionId });
      socket.send(JSON.stringify({ type: 'hello', connectionId, role: 'desktop', callId }));
      heartbeatTimer = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'heartbeat', connectionId }));
        }
      }, 15_000);
    });
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data) as { type?: string; record?: unknown };
        if (message.type === 'CALL_ANSWER' || message.type === 'ICE_CANDIDATE') {
          void handlePhoneSignal(message as SignalingMessage);
          return;
        }
        if (message.type === 'CALL_READY') void createOffer();
        if (message.type === 'server-log') appendServerLog(message.record);
      } catch {
        appendServerLog(event.data);
      }
    });
    socket.addEventListener('close', (event) => {
      if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
      appendServerLog({
        viewer: 'WS_CLOSE',
        connectionId,
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      window.setTimeout(connectServerLogViewer, 3_000);
    });
    socket.addEventListener('error', () => appendServerLog({ viewer: 'WS_ERROR' }));
  } catch (error) {
    appendServerLog({ viewer: 'WS_CONNECT_ERROR', error: String(error) });
  }
}

type SignalingMessage = { type: string; callId: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

async function createOffer(): Promise<void> {
  peerConnection = new RTCPeerConnection();
  pendingPhoneCandidates = [];
  peerConnection.ontrack = (event) => {
    remoteAudio?.pause();
    remoteAudio = new Audio();
    remoteAudio.autoplay = true;
    remoteAudio.srcObject = event.streams[0];
    void remoteAudio.play().then(() => setStatus('Call connected')).catch((error) => {
      setStatus('Remote audio blocked; check browser audio permissions.', true);
      appendServerLog({ call: 'REMOTE_AUDIO_FAILED', error: String(error) });
    });
  };
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => peerConnection!.addTrack(track, stream));
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) signalingSocket?.send(JSON.stringify({ type: 'ICE_CANDIDATE', callId, candidate: event.candidate.toJSON() }));
  };
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  signalingSocket?.send(JSON.stringify({ type: 'CALL_OFFER', callId, sdp: offer }));
}

async function handlePhoneSignal(message: SignalingMessage): Promise<void> {
  if (!peerConnection) return;
  if (message.type === 'CALL_ANSWER' && message.sdp) {
    await peerConnection.setRemoteDescription(message.sdp);
    for (const candidate of pendingPhoneCandidates) await peerConnection.addIceCandidate(candidate);
    pendingPhoneCandidates = [];
  }
  if (message.type === 'ICE_CANDIDATE' && message.candidate) {
    if (peerConnection.remoteDescription) await peerConnection.addIceCandidate(message.candidate);
    else pendingPhoneCandidates.push(message.candidate);
  }
}

async function sendIncomingCall(): Promise<void> {
  saveSettings();
  const baseUrl = backendUrl.value.trim().replace(/\/+$/, '');
  const target = userId.value.trim();
  const caller = callerName.value.trim();
  if (!baseUrl || !target || !caller) {
    setStatus('Backend URL, target user, and caller are required.', true);
    return;
  }

  setStatus('Sending incoming call...');
  result.textContent = 'Waiting for backend response...';
  try {
    const response = await fetch(`${baseUrl}/api/v1/notifications/users/${encodeURIComponent(target)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearerToken.value.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { type: 'INCOMING_CALL', callerName: caller, callId } }),
    });
    const body = await response.json();
    result.textContent = JSON.stringify(body, null, 2);
    setStatus(response.ok ? 'Incoming call sent' : `Request failed (${response.status})`, !response.ok);
  } catch (error) {
    result.textContent = String(error);
    setStatus('Network request failed', true);
  }
}

document.querySelector<HTMLButtonElement>('#desktop-use-dev-token')!.addEventListener('click', () => {
  bearerToken.value = DEV_TEST_BEARER_TOKEN;
  saveSettings();
  setStatus('Development token loaded');
});
document.querySelector<HTMLButtonElement>('#desktop-send-call')!.addEventListener('click', () => {
  void sendIncomingCall();
});
document.querySelector<HTMLButtonElement>('#desktop-clear-logs')!.addEventListener('click', () => {
  serverLogs.textContent = '';
});
connectServerLogViewer();