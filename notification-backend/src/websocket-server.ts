import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { logger } from './config/logger';
import { logBus, recentLogs } from './config/log-bus';

const HEARTBEAT_TIMEOUT_MS = 30_000;

export function attachWebSocketServer(server: Server): WebSocketServer {
  const websocketServer = new WebSocketServer({ server, path: '/ws' });

  websocketServer.on('connection', (socket, request) => {
    const serverConnectionId = randomUUID();
    let clientConnectionId = 'unknown';
    let lastHeartbeatAt = Date.now();
    let callId: string | undefined;

    const sendLog = (record: unknown): void => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify({ type: 'server-log', record }));
      }
    };
    logBus.on('log', sendLog);

    for (const record of recentLogs()) {
      socket.send(JSON.stringify({ type: 'server-log', record }));
    }

    logger.info(
      { serverConnectionId, ip: request.socket.remoteAddress },
      'WS_CONNECTED',
    );

    socket.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as {
          type?: string;
          connectionId?: string;
          callId?: string;
          role?: string;
        };
        clientConnectionId = message.connectionId ?? clientConnectionId;
        callId = message.callId ?? callId;

        if (message.type === 'heartbeat' || message.type === 'ping' || message.type === 'PING_Call') {
          lastHeartbeatAt = Date.now();
          logger.info(
            { serverConnectionId, clientConnectionId },
            message.type === 'PING_Call' ? 'PING_Call' : message.type === 'ping' ? 'WS_APP_PING' : 'WS_HEARTBEAT',
          );
        } else {
          if (callId && ['CALL_READY', 'CALL_OFFER', 'CALL_ANSWER', 'ICE_CANDIDATE', 'CALL_END'].includes(message.type ?? '')) {
            for (const peer of websocketServer.clients) {
              if (peer !== socket && peer.readyState === peer.OPEN) {
                peer.send(JSON.stringify({ ...message, callId }));
              }
            }
          }
          logger.info({ serverConnectionId, clientConnectionId, type: message.type }, 'WS_MESSAGE');
        }
      } catch {
        logger.warn({ serverConnectionId }, 'WS_INVALID_MESSAGE');
      }
    });

    socket.on('ping', () => {
      lastHeartbeatAt = Date.now();
      logger.info({ serverConnectionId, clientConnectionId }, 'WS_PING');
    });

    socket.on('close', (code, reason) => {
      clearInterval(timeoutCheck);
      logBus.off('log', sendLog);
      logger.warn(
        { serverConnectionId, clientConnectionId, code, reason: reason.toString() },
        'WS_DISCONNECTED',
      );
    });

    socket.on('error', (error) => {
      logger.error({ serverConnectionId, clientConnectionId, err: error.message }, 'WS_ERROR');
    });

    const timeoutCheck = setInterval(() => {
      const elapsedMs = Date.now() - lastHeartbeatAt;
      if (elapsedMs <= HEARTBEAT_TIMEOUT_MS) return;

      logger.warn({ serverConnectionId, clientConnectionId, elapsedMs }, 'WS_HEARTBEAT_TIMEOUT');
      socket.close(4000, 'Heartbeat timeout');
      clearInterval(timeoutCheck);
    }, 5_000);
  });

  return websocketServer;
}

export function closeWebSocketServer(server: WebSocketServer): Promise<void> {
  for (const client of server.clients) {
    client.close(1001, 'Server shutdown');
  }
  return new Promise((resolve) => server.close(() => resolve()));
}