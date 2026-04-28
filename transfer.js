// DropBeam Transfer Engine
// Handles all WebRTC P2P connections, chunking, sending, receiving

const CHUNK_SIZE = 64 * 1024; // 64KB chunks

class DropBeamTransfer {
  constructor(callbacks) {
    this.peer = null;
    this.conn = null;
    this.peerId = null;
    this.callbacks = callbacks; // { onReady, onConnected, onReceiveStart, onProgress, onReceiveDone, onSendDone, onError, onDisconnect }

    // Receive state
    this._incoming = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      this.peer = new Peer({
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" }
          ]
        },
        debug: 0
      });

      this.peer.on("open", id => {
        this.peerId = id;
        this.callbacks.onReady?.(id);
        resolve(id);
      });

      this.peer.on("connection", conn => {
        this._setupConn(conn);
        this.conn = conn;
        this.callbacks.onConnected?.("receiver");
      });

      this.peer.on("error", err => {
        console.error("PeerJS error:", err);
        this.callbacks.onError?.(err.type || err.message);
        reject(err);
      });

      this.peer.on("disconnected", () => {
        this.callbacks.onDisconnect?.();
      });
    });
  }

  connect(remotePeerId) {
    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(remotePeerId, {
        reliable: true,
        serialization: "binary"
      });
      conn.on("open", () => {
        this._setupConn(conn);
        this.conn = conn;
        this.callbacks.onConnected?.("sender");
        resolve();
      });
      conn.on("error", err => {
        this.callbacks.onError?.(err.message);
        reject(err);
      });
      setTimeout(() => reject(new Error("Connection timeout")), 20000);
    });
  }

  _setupConn(conn) {
    conn.on("data", data => this._handleData(data));
    conn.on("close", () => {
      this.conn = null;
      this.callbacks.onDisconnect?.();
    });
    conn.on("error", err => this.callbacks.onError?.(err.message));
  }

  _handleData(data) {
    if (data.type === "meta") {
      // New file incoming
      this._incoming = {
        name: data.name,
        size: data.size,
        fileType: data.fileType,
        chunks: [],
        received: 0,
        total: data.total
      };
      this.callbacks.onReceiveStart?.({ name: data.name, size: data.size });
    } else if (data.type === "chunk") {
      if (!this._incoming) return;
      this._incoming.chunks.push(data.data);
      this._incoming.received++;
      const progress = Math.round((this._incoming.received / this._incoming.total) * 100);
      this.callbacks.onProgress?.({ progress, received: this._incoming.received, total: this._incoming.total, sent: false });

      if (this._incoming.received === this._incoming.total) {
        const blob = new Blob(this._incoming.chunks, { type: this._incoming.fileType || "application/octet-stream" });
        this.callbacks.onReceiveDone?.({ blob, name: this._incoming.name, size: this._incoming.size });
        this._incoming = null;
      }
    } else if (data.type === "ack") {
      this.callbacks.onSendDone?.();
    }
  }

  async sendFile(file) {
    if (!this.conn) throw new Error("Not connected");

    const total = Math.ceil(file.size / CHUNK_SIZE);

    // Send metadata first
    this.conn.send({
      type: "meta",
      name: file.name,
      size: file.size,
      fileType: file.type,
      total
    });

    // Read and send chunks
    let offset = 0;
    let chunkIndex = 0;

    const readChunk = () => {
      return new Promise((resolve, reject) => {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(slice);
      });
    };

    while (offset < file.size) {
      const buffer = await readChunk();
      this.conn.send({ type: "chunk", data: buffer, index: chunkIndex });

      offset += CHUNK_SIZE;
      chunkIndex++;

      const progress = Math.round((chunkIndex / total) * 100);
      this.callbacks.onProgress?.({ progress, sent: chunkIndex, total, isSender: true });

      // Small yield to prevent UI blocking
      if (chunkIndex % 16 === 0) await new Promise(r => setTimeout(r, 0));
    }
  }

  destroy() {
    this.conn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
  }
}

window.DropBeamTransfer = DropBeamTransfer;
