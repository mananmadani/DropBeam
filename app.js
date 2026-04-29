// DropBeam App Logic v2
// Fixed: role handling uses currentRole (not callback param), better error UX

let transfer = null;
let selectedFiles = [];
let currentRole = null; // "sender" | "receiver"  — set BEFORE initTransfer()
let myPeerId = null;

// ── Utilities ──────────────────────────────────────────────
function fmt(bytes) {
  if (!bytes) return "0 B";
  const k = 1024, s = ["B","KB","MB","GB","TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k,i)).toFixed(1)) + " " + s[i];
}

function fileIcon(name) {
  const ext = (name||"").split(".").pop().toLowerCase();
  return {
    pdf:"📄", zip:"🗜️", rar:"🗜️", "7z":"🗜️",
    mp4:"🎬", mov:"🎬", avi:"🎬", mkv:"🎬",
    mp3:"🎵", wav:"🎵", flac:"🎵", aac:"🎵",
    jpg:"🖼️", jpeg:"🖼️", png:"🖼️", gif:"🖼️", webp:"🖼️", svg:"🖼️",
    doc:"📝", docx:"📝", txt:"📝", md:"📝",
    xls:"📊", xlsx:"📊", csv:"📊",
    ppt:"📽️", pptx:"📽️",
    js:"💻", ts:"💻", py:"💻", html:"💻", css:"💻",
    apk:"📱", exe:"⚙️", dmg:"💿", iso:"💿",
  }[ext] || "📦";
}

function $(id) { return document.getElementById(id); }

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = $("screen-" + name);
  if (el) el.classList.add("active");
}

function showToast(msg, type = "info") {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show " + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3500);
}

function setStatus(state, label) {
  $("status-dot").className = "dot " + state;
  $("status-text").textContent = label;
}

// ── Init Transfer Engine ───────────────────────────────────
async function initTransfer() {
  setStatus("connecting", "Connecting…");

  transfer = new DropBeamTransfer({

    onReady: (id) => {
      myPeerId = id;
      setStatus("online", "Ready");

      // ✅ Only sender shows the waiting screen with QR code
      if (currentRole === "sender") {
        $("sender-code").textContent = id;
        generateQR(id);
        showScreen("sender-wait");
      }
      // receiver flow continues in btn-connect handler after this resolves
    },

    // ✅ FIX: use currentRole to decide screen, NOT a callback parameter
    onConnected: () => {
      setStatus("connected", "Connected");
      if (currentRole === "sender") {
        // Sender: receiver just joined → show file picker
        showScreen("sender-send");
        showToast("✅ Receiver connected! Pick files to send.", "success");
      } else {
        // Receiver: connected to sender → wait for files
        showScreen("receiver-wait");
        showToast("✅ Connected! Waiting for sender…", "success");
      }
    },

    onReceiveStart: ({ name, size }) => {
      showScreen("receiving");
      $("recv-filename").textContent = name;
      $("recv-filesize").textContent = fmt(size);
      $("recv-icon").textContent = fileIcon(name);
      $("recv-progress-bar").style.width = "0%";
      $("recv-percent").textContent = "0%";
    },

    onProgress: ({ progress, isSender }) => {
      const bar = $(isSender ? "send-progress-bar" : "recv-progress-bar");
      const pct = $(isSender ? "send-percent" : "recv-percent");
      if (bar) bar.style.width = progress + "%";
      if (pct) pct.textContent = progress + "%";
    },

    onReceiveDone: ({ blob, name, size }) => {
      const url = URL.createObjectURL(blob);
      $("dl-link").href = url;
      $("dl-link").download = name;
      $("dl-filename").textContent = name;
      $("dl-filesize").textContent = fmt(size);
      $("dl-icon").textContent = fileIcon(name);
      showScreen("done-receive");
      showToast("🎉 File received!", "success");
      // Trigger download
      setTimeout(() => $("dl-link").click(), 300);
    },

    onError: (msg) => {
      showToast("❌ " + (msg || "Connection error"), "error");
      setStatus("offline", "Error");
    },

    onDisconnect: () => {
      setStatus("offline", "Disconnected");
      showToast("⚡ Connection closed", "error");
    }
  });

  return transfer.init();
}

// ── QR Code ────────────────────────────────────────────────
function generateQR(peerId) {
  const el = $("qr-code");
  el.innerHTML = "";
  const url = window.location.href.split("?")[0] + "?peer=" + peerId;
  new QRCode(el, {
    text: url,
    width: 160, height: 160,
    colorDark: "#00aaff",
    colorLight: "#060b1a",
    correctLevel: QRCode.CorrectLevel.M
  });
  $("share-link").value = url;
}

// ── Role: SENDER ───────────────────────────────────────────
$("btn-send").onclick = () => {
  currentRole = "sender";
  showScreen("loading");
  initTransfer().catch(err => {
    showToast("❌ " + (err.message || "Failed to start"), "error");
    showScreen("home");
  });
};

// ── Role: RECEIVER ─────────────────────────────────────────
$("btn-receive").onclick = () => {
  currentRole = "receiver";
  showScreen("receiver-enter");
};

// ── Receiver: Connect ──────────────────────────────────────
$("btn-connect").onclick = async () => {
  const code = ($("peer-input").value || "").trim();
  if (!code) { showToast("Please enter the sender's code", "error"); return; }

  const btn = $("btn-connect");
  btn.disabled = true;
  btn.textContent = "Connecting…";
  showScreen("loading");

  try {
    // Step 1: init our own peer
    await initTransfer();
    // Step 2: connect TO the sender's peer ID
    await transfer.connect(code);
    // onConnected callback takes over from here
  } catch (err) {
    showToast("❌ " + (err.message || "Could not connect"), "error");
    showScreen("receiver-enter");
    btn.disabled = false;
    btn.textContent = "Connect & Receive";
    setStatus("offline", "Ready");
  }
};

$("peer-input").addEventListener("keydown", e => {
  if (e.key === "Enter") $("btn-connect").click();
});

// ── Copy ───────────────────────────────────────────────────
$("btn-copy-link").onclick = () => {
  const val = $("share-link").value;
  navigator.clipboard.writeText(val)
    .then(() => showToast("📋 Link copied!", "success"))
    .catch(() => { $("share-link").select(); document.execCommand("copy"); showToast("📋 Copied!", "success"); });
};

$("btn-copy-code").onclick = () => {
  if (myPeerId) navigator.clipboard.writeText(myPeerId)
    .then(() => showToast("📋 Code copied!", "success"));
};

// ── File Selection ─────────────────────────────────────────
const dropZone = $("drop-zone");
dropZone.addEventListener("click", () => $("file-input").click());
$("file-input").addEventListener("change", e => {
  if (e.target.files.length) handleFiles(Array.from(e.target.files));
});
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag"));
dropZone.addEventListener("drop", e => {
  e.preventDefault(); dropZone.classList.remove("drag");
  if (e.dataTransfer.files.length) handleFiles(Array.from(e.dataTransfer.files));
});

function handleFiles(files) {
  selectedFiles = files;
  const list = $("file-list");
  list.innerHTML = "";
  files.forEach(f => {
    const item = document.createElement("div");
    item.className = "file-item";
    item.innerHTML = `
      <span class="file-ico">${fileIcon(f.name)}</span>
      <span class="file-info">
        <span class="file-name">${f.name}</span>
        <span class="file-size">${fmt(f.size)}</span>
      </span>`;
    list.appendChild(item);
  });
  $("file-list-wrap").style.display = "block";
  $("btn-send-files").style.display = "flex";
}

// ── Send Files ─────────────────────────────────────────────
$("btn-send-files").onclick = async () => {
  if (!selectedFiles.length) return;

  const total = selectedFiles.length;
  let idx = 0;

  const sendNext = async () => {
    if (idx >= total) {
      // ✅ All files done — show done screen ONCE at the end
      showScreen("done-send");
      showToast("🎉 All files sent!", "success");
      return;
    }

    const file = selectedFiles[idx];
    idx++;

    $("send-filename").textContent = file.name;
    $("send-filesize").textContent = fmt(file.size);
    $("send-icon").textContent = fileIcon(file.name);
    $("send-progress-bar").style.width = "0%";
    $("send-percent").textContent = "0%";
    $("send-total").textContent = `File ${idx} of ${total}`;

    // ✅ Stay on sending screen between files — no showScreen() here
    if (idx === 1) showScreen("sending");

    try {
      await transfer.sendFile(file);
      // Small pause between files so progress bar visually completes
      await new Promise(r => setTimeout(r, 350));
      sendNext();
    } catch (err) {
      showToast("❌ Send failed: " + (err.message || "error"), "error");
    }
  };

  sendNext();
};

// ── Send another ───────────────────────────────────────────
$("btn-send-another").onclick = () => {
  selectedFiles = [];
  $("file-list").innerHTML = "";
  $("file-list-wrap").style.display = "none";
  $("btn-send-files").style.display = "none";
  $("file-input").value = "";
  showScreen("sender-send");
};

// ── Home / Reset ───────────────────────────────────────────
document.querySelectorAll(".btn-home").forEach(b => {
  b.onclick = () => {
    transfer?.destroy();
    transfer = null; selectedFiles = []; currentRole = null; myPeerId = null;
    $("peer-input").value = "";
    $("file-list").innerHTML = "";
    $("file-list-wrap").style.display = "none";
    $("btn-send-files").style.display = "none";
    $("file-input").value = "";
    $("btn-connect").disabled = false;
    $("btn-connect").textContent = "Connect & Receive";
    setStatus("offline", "Ready");
    showScreen("home");
  };
});

// ── PWA + URL param auto-fill ──────────────────────────────
window.addEventListener("load", () => {
  // Register service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js")
      .then(() => console.log("SW registered"))
      .catch(e => console.warn("SW failed:", e));
  }

  showScreen("home");

  // Auto-fill peer code from shared link
  const peer = new URLSearchParams(window.location.search).get("peer");
  if (peer) {
    $("peer-input").value = peer;
    currentRole = "receiver";
    showScreen("receiver-enter");
    showToast("📡 Code auto-filled — tap Connect!", "info");
  }
});
