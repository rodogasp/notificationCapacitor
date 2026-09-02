import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CallNotificationSettings } from './call-notification-settings';
import type { AppLogger } from './logger';

export class WebSocketMonitor {
  private socket: WebSocket | null = null;
  private heartbeatTimer: number | null = null;
  private pingTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private connectionId = '';
  private appActive = true;
  private state: 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' = 'DISCONNECTED';
  private reconnectAttempts = 0;
  private callActive = false;
  private callId: string | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private remoteAudio: HTMLAudioElement | null = null;

  constructor(
    private readonly backendUrl: () => string,
    private readonly logger: AppLogger,
  ) {}

  async initialize(): Promise<void> {
    await this.loadCallState();

    await App.addListener('appStateChange', ({ isActive }) => {
      this.appActive = isActive;
      this.logger.info(isActive ? 'WS_APP_FOREGROUND' : 'WS_APP_BACKGROUND');
      if (isActive) this.connect();
    });

    await App.addListener('pause', () => this.logger.info('WS_APP_PAUSE'));
    await App.addListener('resume', () => {
      this.logger.info('WS_APP_RESUME');
      void this.loadCallState();
      this.connect();
    });

    window.addEventListener('online', () => this.connect());
    window.addEventListener('offline', () => {
      this.setState('DISCONNECTED');
      this.socket?.close(1000, 'Network offline');
    });

    this.connect();
  }

  private async loadCallState(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const callState = await CallNotificationSettings.isCallActive();
      this.callId = (await CallNotificationSettings.getCallId()).callId;
      this.setCallActive(callState.active);
      this.logger.info('WS_CALL_STATE_LOADED', { active: callState.active, callId: this.callId });
      if (callState.active && this.callId && this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'CALL_READY', connectionId: this.connectionId, callId: this.callId }));
      }
    } catch (error) {
      this.logger.error('WS_CALL_STATE_LOAD_FAILED', error);
    }
  }

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const url = toWebSocketUrl(this.backendUrl());
    if (!url) {
      this.logger.warn('WS_CONNECT_SKIPPED_NO_BACKEND_URL');
      return;
    }

    if (Capacitor.getPlatform() === 'android' && /^(ws|wss):\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)) {
      this.logger.warn('WS_CONNECT_SKIPPED_ANDROID_LOCALHOST', {
        url,
        message: 'Use the development computer LAN IP or 10.0.2.2 for an emulator.',
      });
      return;
    }

    this.connectionId = crypto.randomUUID();
    this.setState(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');
    this.logger.info('WS_CONNECTING', { url, connectionId: this.connectionId, state: this.state });
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.logger.info('WS_OPEN', { connectionId: this.connectionId });
      this.reconnectAttempts = 0;
      this.setState('CONNECTED');
      socket.send(JSON.stringify({ type: 'hello', connectionId: this.connectionId, role: 'phone', callId: this.callId }));
      if (this.callActive && this.callId) socket.send(JSON.stringify({ type: 'CALL_READY', connectionId: this.connectionId, callId: this.callId }));
      this.startHeartbeat();
      if (this.callActive) this.startConnectionProofPing();
    });

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data) as {
          type?: string;
          callId?: string;
          sdp?: RTCSessionDescriptionInit;
          candidate?: RTCIceCandidateInit;
        };
        if (message.callId !== this.callId) return;
        if (message.type === 'CALL_OFFER' && message.sdp) void this.answerCall(message.sdp);
        if (message.type === 'ICE_CANDIDATE' && message.candidate && this.peerConnection) {
          void this.peerConnection.addIceCandidate(message.candidate);
        }
      } catch (error) {
        this.logger.error('WS_CALL_SIGNAL_INVALID', error);
      }
    });

    socket.addEventListener('close', (event) => {
      this.stopHeartbeat();
      this.stopConnectionProofPing();
      this.setState('DISCONNECTED');
      this.logger.warn('WS_CLOSE', {
        connectionId: this.connectionId,
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      this.logger.error('WS_ERROR', {
        connectionId: this.connectionId,
        message: 'WebSocket failed; the close event contains the transport reason.',
      });
    });
  }

  sendCallPing(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.logger.warn('PING_CALL_SKIPPED_SOCKET_NOT_CONNECTED', { state: this.state });
      return;
    }
    this.socket.send(JSON.stringify({ type: 'PING_Call', connectionId: this.connectionId }));
    this.logger.info('PING_Call_SENT', { connectionId: this.connectionId });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify({ type: 'heartbeat', connectionId: this.connectionId }));
      this.logger.debug('WS_HEARTBEAT_SENT', { connectionId: this.connectionId });
    }, 15_000);
  }

  setCallActive(active: boolean): void {
    this.callActive = active;
    if (active && this.socket?.readyState === WebSocket.OPEN) this.sendCallPing();
    if (!active) this.stopConnectionProofPing();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private startConnectionProofPing(): void {
    this.stopConnectionProofPing();
    this.pingTimer = window.setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify({ type: 'PING_Call', connectionId: this.connectionId }));
      this.logger.info('PING_Call_SENT', { connectionId: this.connectionId });
    }, 3_000);
  }

  private stopConnectionProofPing(): void {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private async answerCall(offer: RTCSessionDescriptionInit): Promise<void> {
    this.peerConnection?.close();
    const peer = new RTCPeerConnection();
    this.peerConnection = peer;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.onicecandidate = (event) => {
      if (event.candidate) this.socket?.send(JSON.stringify({
        type: 'ICE_CANDIDATE', callId: this.callId, candidate: event.candidate.toJSON(),
      }));
    };
    peer.ontrack = (event) => {
      this.remoteAudio?.pause();
      this.remoteAudio = new Audio();
      this.remoteAudio.autoplay = true;
      this.remoteAudio.srcObject = event.streams[0];
      void this.remoteAudio.play().catch((error) => this.logger.error('CALL_REMOTE_AUDIO_FAILED', error));
    };
    await peer.setRemoteDescription(offer);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    this.socket?.send(JSON.stringify({ type: 'CALL_ANSWER', callId: this.callId, sdp: answer }));
    this.logger.info('CALL_WEBRTC_ANSWER_SENT', { callId: this.callId });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delayMs = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.setState('RECONNECTING');
    this.logger.info('WS_RECONNECT_SCHEDULED', { delayMs, attempt: this.reconnectAttempts });
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3_000);
  }

  private setState(state: typeof this.state): void {
    if (this.state === state) return;
    this.state = state;
    this.logger.info('WS_STATE', { state });
  }
}

function toWebSocketUrl(backendUrl: string): string | null {
  const baseUrl = backendUrl.trim();
  if (!baseUrl) return null;
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = '';
  return url.toString();
}