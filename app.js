// DropBeam App Logic

let transfer = null;
let selectedFiles = [];
let currentRole = null; // "sender" | "receiver"
let myPeerId = null;

// ── Utilities ──────────────────────────────────────────────
function fmt(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function fileIcon(name) {
  const ext = name.split(".").pop().toLowerCase();
  const map = {
    pdf: "📄", zip: "🗜️", rar: "🗜️", "7z": "🗜️",
    mp4: "🎬", mov: "🎬", avi: "🎬", mkv: "🎬",
    mp3: "🎵", wav: "🎵", flac: "🎵", aac: "🎵",
    jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", webp: "🖼️", svg: "🖼️",
    doc: "📝", docx: "📝", txt: "📝", md: "📝",
    xls: "📊", xlsx: "📊", csv: "📊",
    ppt: "📽️", pptx: "📽️",
    js: "💻", ts: "💻", py: "💻", html: "💻", css: "💻",
    apk: "📱", exe: "⚙️", dmg: "💿", iso: "💿",
  };
  return map[ext] || "📦";
}

function $(id) { return document.getElementById(id); }

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = $("screen-" + name);
  if (el) { el.classList.add("active"); }
}

function showToast(msg, type = "info") {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show " + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3200);
}

// ── Init ───────────────────────────────────────────────────
async function initTransfer() {
  $("status-dot").className = "dot connecting";
  $("status-text").textContent = "Connecting…";

  transfer = new DropBeamTransfer({
    onReady: (id) => {
      myPeerId = id;
      $("status-dot").className = "dot online";
      $("status-text").textContent = "Ready";

      if (currentRole === "sender") {
        $("sender-code").textContent = id;
        generateQR(id);
        showScreen("sender-wait");
      }
    },
    onConnected: (role) => {
      $("status-dot").className = "dot connected";
      $("status-text").textContent = "Connected";
      if (role === "sender") {
        showScreen("sender-send");
        showToast("✅ Receiver connected!", "success");
      } else {
        showScreen("receiver-wait");
        showToast("✅ Connected to sender!", "success");
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
      if (isSender) {
        $("send-progress-bar").style.width = progress + "%";
        $("send-percent").textContent = progress + "%";
      } else {
        $("recv-progress-bar").style.width = progress + "%";
        $("recv-percent").textContent = progress + "%";
      }
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
      $("dl-link").click();
    },
    onSendDone: () => {
      showScreen("done-send");
      showToast("🎉 File sent!", "success");
    },
    onError: (msg) => {
      showToast("❌ " + (msg || "Connection error"), "error");
      $("status-dot").className = "dot offline";
      $("status-text").textContent = "Error";
    },
    onDisconnect: () => {
      $("status-dot").className = "dot offline";
      $("status-text").textContent = "Disconnected";
      showToast("⚡ Disconnected", "error");
    }
  });

  try {
    await transfer.init();
  } catch (e) {
    showToast("❌ Failed to connect to network", "error");
    $("status-dot").className = "dot offline";
    $("status-text").textContent = "Offline";
  }
}

// ── QR Code ────────────────────────────────────────────────
function generateQR(peerId) {
  const el = $("qr-code");
  el.innerHTML = "";
  const connectUrl = window.location.href.split("?")[0] + "?peer=" + peerId;
  new QRCode(el, {
    text: connectUrl,
    width: 160,
    height: 160,
    colorDark: "#00aaff",
    colorLight: "#060b1a",
    correctLevel: QRCode.CorrectLevel.M
  });
  $("share-link").value = connectUrl;
}

// ── Role Selection ─────────────────────────────────────────
$("btn-send").onclick = () => {
  currentRole = "sender";
  showScreen("loading");
  initTransfer();
};

$("btn-receive").onclick = () => {
  currentRole = "receiver";
  showScreen("receiver-enter");
};

// ── Receiver: Enter Code ───────────────────────────────────
$("btn-connect").onclick = async () => {
  const code = $("peer-input").value.trim();
  if (!code) { showToast("Enter a connection code", "error"); return; }

  $("btn-connect").disabled = true;
  $("btn-connect").textContent = "Connecting…";
  showScreen("loading");

  await initTransfer();

  try {
    await transfer.connect(code);
  } catch (e) {
    showToast("❌ Could not connect. Check the code.", "error");
    showScreen("receiver-enter");
    $("btn-connect").disabled = false;
    $("btn-connect").textContent = "Connect";
  }
};

$("peer-input").addEventListener("keydown", e => {
  if (e.key === "Enter") $("btn-connect").click();
});

// ── Copy Link ──────────────────────────────────────────────
$("btn-copy-link").onclick = () => {
  const val = $("share-link").value;
  navigator.clipboard.writeText(val).then(() => showToast("📋 Link copied!", "success"))
    .catch(() => { $("share-link").select(); document.execCommand("copy"); showToast("📋 Copied!", "success"); });
};

$("btn-copy-code").onclick = () => {
  navigator.clipboard.writeText(myPeerId || "").then(() => showToast("📋 Code copied!", "success"));
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
  e.preventDefault();
  dropZone.classList.remove("drag");
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
  $("send-total").textContent = selectedFiles.length + " file" + (selectedFiles.length > 1 ? "s" : "");
  let fileIdx = 0;

  const sendNext = async () => {
    if (fileIdx >= selectedFiles.length) return;
    const file = selectedFiles[fileIdx++];
    $("send-filename").textContent = file.name;
    $("send-filesize").textContent = fmt(file.size);
    $("send-icon").textContent = fileIcon(file.name);
    $("send-progress-bar").style.width = "0%";
    $("send-percent").textContent = "0%";
    showScreen("sending");
    await transfer.sendFile(file);
    if (fileIdx < selectedFiles.length) setTimeout(sendNext, 400);
  };
  sendNext();
};

// ── Reset / Home ───────────────────────────────────────────
document.querySelectorAll(".btn-home").forEach(b => {
  b.onclick = () => {
    transfer?.destroy();
    transfer = null;
    selectedFiles = [];
    currentRole = null;
    myPeerId = null;
    $("peer-input").value = "";
    $("file-list-wrap").style.display = "none";
    $("btn-send-files").style.display = "none";
    $("btn-connect").disabled = false;
    $("btn-connect").textContent = "Connect & Receive";
    $("status-dot").className = "dot offline";
    $("status-text").textContent = "Ready";
    showScreen("home");
  };
});

// ── Auto-connect via URL param ──────────────────────────────
window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  showScreen("home");
  const params = new URLSearchParams(window.location.search);
  const peer = params.get("peer");
  if (peer) {
    $("peer-input").value = peer;
    currentRole = "receiver";
    showScreen("receiver-enter");
    showToast("📡 Code auto-filled from link!", "info");
  }
});
