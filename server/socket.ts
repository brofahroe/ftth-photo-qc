import { Server as SocketIOServer, Socket } from 'socket.io';

interface UserPresence {
  socketId: string;
  userName: string;
  documentId: string;
  lockedSlotKey?: string; // Format: "pageId:slotIndex"
}

interface SlotLock {
  documentId: string;
  pageId: string;
  slotIndex: number;
  userName: string;
  socketId: string;
  lockedAt: number;
}

const activeUsers = new Map<string, UserPresence>();
const slotLocks = new Map<string, SlotLock>(); // Key: "docId:pageId:slotIndex"

export function setupSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Join Document Room
    socket.on('join_document', ({ documentId, userName }: { documentId: string; userName: string }) => {
      const room = `doc:${documentId}`;
      socket.join(room);

      activeUsers.set(socket.id, {
        socketId: socket.id,
        userName: userName || 'Teknisi Lapangan',
        documentId,
      });

      console.log(`[Socket.io] ${userName} (${socket.id}) joined ${room}`);

      // Send current locks in this document to the newly joined client
      const currentLocks: Record<string, string> = {};
      for (const [key, lock] of slotLocks.entries()) {
        if (lock.documentId === documentId) {
          const slotKey = `${lock.pageId}:${lock.slotIndex}`;
          currentLocks[slotKey] = lock.userName;
        }
      }
      socket.emit('initial_locks', currentLocks);

      // Broadcast updated presence list
      broadcastPresence(io, documentId);
    });

    // Leave Document Room
    socket.on('leave_document', () => {
      handleUserLeave(io, socket);
    });

    // Lock Slot (When technician opens camera for this slot)
    socket.on('lock_slot', ({ documentId, pageId, slotIndex, userName }: {
      documentId: string;
      pageId: string;
      slotIndex: number;
      userName: string;
    }) => {
      const lockKey = `${documentId}:${pageId}:${slotIndex}`;
      const existing = slotLocks.get(lockKey);

      // If already locked by someone else within the last 5 minutes, reject
      if (existing && existing.socketId !== socket.id && (Date.now() - existing.lockedAt < 300_000)) {
        socket.emit('lock_rejected', {
          pageId,
          slotIndex,
          lockedBy: existing.userName,
        });
        return;
      }

      slotLocks.set(lockKey, {
        documentId,
        pageId,
        slotIndex,
        userName,
        socketId: socket.id,
        lockedAt: Date.now(),
      });

      const user = activeUsers.get(socket.id);
      if (user) {
        user.lockedSlotKey = `${pageId}:${slotIndex}`;
      }

      console.log(`[Socket.io] Slot locked: doc=${documentId} page=${pageId} slot=${slotIndex} by ${userName}`);

      // Broadcast lock to all participants in document
      io.to(`doc:${documentId}`).emit('slot_locked', {
        pageId,
        slotIndex,
        userName,
      });
    });

    // Unlock Slot (When technician closes camera or cancels)
    socket.on('unlock_slot', ({ documentId, pageId, slotIndex }: {
      documentId: string;
      pageId: string;
      slotIndex: number;
    }) => {
      const lockKey = `${documentId}:${pageId}:${slotIndex}`;
      slotLocks.delete(lockKey);

      const user = activeUsers.get(socket.id);
      if (user) {
        user.lockedSlotKey = undefined;
      }

      io.to(`doc:${documentId}`).emit('slot_unlocked', {
        pageId,
        slotIndex,
      });
    });

    // Document Updated (Header changes, added pages, etc.)
    socket.on('document_updated', ({ documentId, document, userName }: {
      documentId: string;
      document: any;
      userName: string;
    }) => {
      socket.to(`doc:${documentId}`).emit('document_updated', {
        document,
        userName,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      handleUserLeave(io, socket);
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });
}

function handleUserLeave(io: SocketIOServer, socket: Socket) {
  const user = activeUsers.get(socket.id);
  if (!user) return;

  const { documentId } = user;

  // Release any slot locks held by this socket
  for (const [key, lock] of slotLocks.entries()) {
    if (lock.socketId === socket.id) {
      slotLocks.delete(key);
      io.to(`doc:${documentId}`).emit('slot_unlocked', {
        pageId: lock.pageId,
        slotIndex: lock.slotIndex,
      });
    }
  }

  activeUsers.delete(socket.id);
  socket.leave(`doc:${documentId}`);
  broadcastPresence(io, documentId);
}

function broadcastPresence(io: SocketIOServer, documentId: string) {
  const users: string[] = [];
  for (const user of activeUsers.values()) {
    if (user.documentId === documentId && !users.includes(user.userName)) {
      users.push(user.userName);
    }
  }
  io.to(`doc:${documentId}`).emit('presence_list', users);
}
