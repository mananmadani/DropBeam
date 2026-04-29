// DropBeam Transfer Engine v2
// Fixed: role callbacks, TURN servers, connection reliability

const CHUNK_SIZE = 64 * 1024; // 64KB

// Free TURN servers for reliable cross-network NAT traversal
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject"
  }
];

class DropBeamTransfer {
  constructor(callbacks) {
    this.peer = null;
    this.conn = null;
    this.peerId = null;
    this.callbacks = callbacks;
    this._incoming = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("PeerJS server timeout — check internet connection"));
      }, 15000);

      try {
        this.peer = new Peer(undefined, {
          config: { iceServers: ICE_SERVERS },
          debug: 0
        });
      } catch (e) {
        clearTimeout(timeout);
        return reject(e);
      }

      this.peer.on("open", id => {
        clearTimeout(timeout);
        this.peerId = id;
        // ✅ FIX: just signal ready — role logic stays in app.js
        this.callbacks.onReady?.(id);
        resolve(id);
      });

      // ✅ FIX: host receives incoming connection (this device is the FILE SENDER)
      this.peer.on("connection", conn => {
        this.conn = conn;
        this._setupConn(conn);
        // Don't call onConnected here — wait for conn "open" event
      });

      this.peer.on("error", err => {
        clearTimeout(timeout);
        console.error("PeerJS error:", err.type, err);
        const msg = {
          "peer-unavailable": "Code not found. Make sure the sender's tab is still open.",
          "network": "Network error — check your internet connection.",
          "server-error": "Signalling server error — please retry.",
          "socket-error": "Socket error — please retry.",
        }[err.type] || (err.message || "Unknown error");
        this.callbacks.onError?.(msg);
        reject(err);
      });

      this.peer.on("disconnected", () => {
        // Try to reconnect once
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect();
        }
      });
    });
  }

  // Called by the FILE RECEIVER to connect to the sender's peer ID
  connect(remotePeerId) {
    return new Promise((resolve, reject) => {
      if (!this.peer || this.peer.destroyed) {
        return reject(new Error("Peer not initialized"));
      }

      const timeout = setTimeout(() => {
        reject(new Error("Connection timed out — make sure sender's tab is open"));
      }, 25000);

      let conn;
      try {
        conn = this.peer.connect(remotePeerId, {
          reliable: true,
          serialization: "binary"
        });
      } catch (e) {
        clearTimeout(timeout);
        return reject(e);
      }

      conn.on("open", () => {
        clearTimeout(timeout);
        this.conn = conn;
        this._setupConn(conn);
        // ✅ FIX: signal connected — app.js uses currentRole to decide screen
        this.callbacks.onConnected?.();
        resolve();
      });

      conn.on("error", err => {
        clearTimeout(timeout);
        this.callbacks.onError?.(err.message);
        reject(err);
      });
    });
  }

  _setupConn(conn) {
    conn.on("open", () => {
      // ✅ FIX: for INCOMING connections (sender side), signal connected here
      if (this.peer && conn === this.conn) {
        this.callbacks.onConnected?.();
      }
    });

    conn.on("data", data => this._handleData(data));

    conn.on("close", () => {
      this.conn = null;
      this.callbacks.onDisconnect?.();
    });

    conn.on("error", err => {
      this.callbacks.onError?.(err.message || "Connection error");
    });
  }

  _handleData(data) {
    if (!data || !data.type) return;

    if (data.type === "meta") {
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
      this.callbacks.onProgress?.({ progress, isSender: false });

      if (this._incoming.received === this._incoming.total) {
        const blob = new Blob(this._incoming.chunks, {
          type: this._incoming.fileType || "application/octet-stream"
        });
        this.callbacks.onReceiveDone?.({
          blob,
          name: this._incoming.name,
          size: this._incoming.size
        });
        this._incoming = null;
      }

    } else if (data.type === "ack") {
      this.callbacks.onSendDone?.();
    }
  }

  async sendFile(file) {
    if (!this.conn) throw new Error("Not connected");

    const total = Math.ceil(file.size / CHUNK_SIZE);

    // Send metadata
    this.conn.send({ type: "meta", name: file.name, size: file.size, fileType: file.type, total });

    let offset = 0;
    let chunkIndex = 0;

    while (offset < file.size) {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await slice.arrayBuffer();

      this.conn.send({ type: "chunk", data: buffer, index: chunkIndex });

      offset += CHUNK_SIZE;
      chunkIndex++;

      const progress = Math.round((chunkIndex / total) * 100);
      this.callbacks.onProgress?.({ progress, isSender: true });

      // Yield every 8 chunks to keep UI responsive
      if (chunkIndex % 8 === 0) await new Promise(r => setTimeout(r, 0));
    }

    // Notify receiver transfer is complete
    try { this.conn?.send({ type: "ack" }); } catch {}
  }

  destroy() {
    try { this.conn?.close(); } catch {}
    try { this.peer?.destroy(); } catch {}
    this.conn = null;
    this.peer = null;
  }
}

window.DropBeamTransfer = DropBeamTransfer;
