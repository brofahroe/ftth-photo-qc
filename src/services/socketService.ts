import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // Connect to same origin in production, or server port 3001 in development
    const socketUrl =
      window.location.port === '5173'
        ? `http://${window.location.hostname}:3001`
        : window.location.origin;
    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to server, id:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });
  }

  return socket;
}

export interface SlotLockEvent {
  pageId: string;
  slotIndex: number;
  userName: string;
}

export interface SlotUnlockEvent {
  pageId: string;
  slotIndex: number;
}

export interface DocumentUpdatedEvent {
  document: any;
  userName: string;
}

export function joinDocumentRoom(documentId: string, userName: string) {
  const s = getSocket();
  if (s.connected) {
    s.emit('join_document', { documentId, userName });
  } else {
    s.once('connect', () => {
      s.emit('join_document', { documentId, userName });
    });
  }
}

export function leaveDocumentRoom() {
  if (socket && socket.connected) {
    socket.emit('leave_document');
  }
}

export function emitLockSlot(documentId: string, pageId: string, slotIndex: number, userName: string) {
  const s = getSocket();
  s.emit('lock_slot', { documentId, pageId, slotIndex, userName });
}

export function emitUnlockSlot(documentId: string, pageId: string, slotIndex: number) {
  const s = getSocket();
  s.emit('unlock_slot', { documentId, pageId, slotIndex });
}

export function emitDocumentUpdated(documentId: string, doc: any, userName: string) {
  const s = getSocket();
  s.emit('document_updated', { documentId, document: doc, userName });
}
