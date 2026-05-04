<div align="center">

<img src="icons/icon-192.png" width="100" height="100" alt="DropBeam"/>

# ⚡ DropBeam

### Drop a file. Beam it anywhere.

**Direct device-to-device file transfer. No servers. No limits. No sign-up.**

[![Live App](https://img.shields.io/badge/🌐%20Live%20App-Open%20DropBeam-0066ff?style=for-the-badge)](https://mananmadani.github.io/DropBeam/)
[![PWA](https://img.shields.io/badge/PWA-Installable-00dd88?style=for-the-badge&logo=pwa&logoColor=white)](https://mananmadani.github.io/DropBeam/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P%20Transfer-00ccff?style=for-the-badge)](https://webrtc.org/)
[![License](https://img.shields.io/badge/License-MIT-5599ff?style=for-the-badge)](LICENSE)

</div>

---

<div align="center">

**[Try it now →](https://mananmadani.github.io/DropBeam/)**  
Open on any two devices. No install required.

</div>

---

## What is DropBeam?

DropBeam is a **Progressive Web App** that transfers files of any size directly between two browsers using WebRTC — no uploads, no server, no account. Files travel peer-to-peer in a direct encrypted channel between the two devices.

- Sender gets a **connection code** and **QR code**
- Receiver enters the code or scans the QR
- WebRTC DataChannel opens directly between the devices
- Files beam across — receiver's browser auto-downloads

---

## How It Works

```
Sender opens DropBeam                Receiver opens DropBeam
         │                                     │
         │  PeerJS assigns a unique Peer ID    │
         │  QR code + code displayed           │
         │                                     │
         │◄──── Receiver enters code ─────────►│
                          │
              PeerJS signalling server
              (brokers handshake only, ~2s)
                          │
              STUN discovers public IPs
                          │
         ┌────────────────────────────────┐
         │     Direct WebRTC DataChannel  │
         │     Files go device ↔ device   │
         │     Encrypted · No server      │
         └────────────────────────────────┘
```

Once the connection forms, the signalling server is completely out of the picture. All file data goes directly between the two browsers.

---

## Features

| | Feature | Detail |
|---|---|---|
| 🔒 | **End-to-end encrypted** | WebRTC DTLS encryption — built into the protocol |
| ♾️ | **No file size limit** | Files chunked into 64 KB pieces and streamed |
| 📡 | **No server** | Files never touch any server at any point |
| ⚡ | **Any file type** | Documents, videos, APKs, archives — anything |
| 📱 | **Cross-platform** | Android, iPhone, desktop — any modern browser |
| 🔌 | **Works on local WiFi** | No internet required when on the same network |
| 📲 | **Installable PWA** | Add to home screen, works like a native app |
| 🔗 | **Shareable link** | Send a URL — receiver opens it, code auto-fills |
| 📷 | **QR code** | Scan to connect instantly, no typing needed |
| 📦 | **Multiple files** | Queue and send multiple files in one session |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **P2P Transport** | WebRTC DataChannel (native browser API) |
| **Signalling** | PeerJS 1.5.2 — brokers the initial handshake only |
| **NAT Traversal** | Google STUN + Cloudflare STUN |
| **Firewall Fallback** | OpenRelay community TURN servers |
| **Frontend** | Vanilla HTML · CSS · JavaScript — zero frameworks |
| **Fonts** | Space Grotesk · JetBrains Mono (Google Fonts) |
| **QR Generator** | qrcodejs |
| **Offline / PWA** | Service Worker with cache-first strategy |

---

## File Transfer Protocol

Files are split into **64 KB chunks** and sent as binary `ArrayBuffer` over the DataChannel:

```
Sender                                   Receiver
  │                                           │
  │── { type: "meta", name, size, total } ──►│  File info
  │── { type: "chunk", data: Buffer, i:0 } ──►│
  │── { type: "chunk", data: Buffer, i:1 } ──►│  Binary chunks
  │── { type: "chunk", data: Buffer, i:N } ──►│
  │── { type: "ack" } ──────────────────────►│  Done signal
  │                                           │
  │                              Blob reassembled → auto-download
```

The DataChannel is opened in **reliable + ordered** mode — every chunk arrives in sequence with no loss.

---

## Network Architecture

```
Your App                PeerJS Server             Other Device
    │                        │                         │
    │── "give me an ID" ────►│                         │
    │◄── "your ID: abc123" ──│                         │
    │                        │◄── "connect to abc123" ─│
    │◄── SDP offer relayed ──│                         │
    │── SDP answer relayed ─►│                         │
    │                        │                         │
    │◄═══════ Direct WebRTC DataChannel ══════════════►│
    │         (PeerJS server no longer involved)        │
```

```
ICE Servers used:
  stun.l.google.com:19302       ← IP discovery
  stun1.l.google.com:19302      ← IP discovery (fallback)
  stun.cloudflare.com:3478      ← IP discovery (fallback)
  openrelay.metered.ca:80/443   ← TURN relay (only if direct P2P fails)
```

---

## Privacy

- ✅ Files **never leave** the peer-to-peer channel — no server ever sees them
- ✅ No accounts, no tracking, no analytics, no cookies
- ✅ Connection codes are **ephemeral** — expire when the tab closes
- ✅ No data is stored anywhere — not even temporarily
- ⚠️ The only external contact is the PeerJS signalling server during the ~2 second handshake (no file data, just IP addresses and SDP)

---

## Project Structure

```
DropBeam/
│
├── index.html        ← All UI screens (single-page app, 11 screens)
├── app.js            ← UI logic, screen flow, callbacks
├── transfer.js       ← P2P engine — PeerJS, chunking, protocol
├── style.css         ← Complete styling (Space Grotesk + JetBrains Mono)
├── sw.js             ← Service Worker — PWA offline support
├── manifest.json     ← PWA manifest — install metadata
│
└── icons/
    ├── icon-192.png  ← App icon (home screen / PWA)
    └── icon-512.png  ← App icon (splash screen)
```

---

## Getting Started

### Use Online (Recommended)

Open **[mananmadani.github.io/DropBeam](https://mananmadani.github.io/DropBeam/)** on two devices and start transferring.

### Install as App

**Android (Chrome):**
```
Open the site → tap ⋮ → "Add to Home Screen" → Install
```

**iPhone (Safari):**
```
Open the site → tap Share → "Add to Home Screen"
```

### Run Locally

```bash
# Clone
git clone https://github.com/mananmadani/DropBeam.git
cd DropBeam

# Serve (any static server works)
npx serve .
# or
python3 -m http.server 8080
# or
npx http-server -p 8080
```

Open `http://localhost:8080` in **two separate browser tabs** to test sender and receiver.

> ⚠️ WebRTC requires a secure context. Use `localhost` for development or GitHub Pages / any HTTPS host for production.

---

## Browser Support

| Browser | Tested | Send | Receive | Install |
|---|---|---|---|---|
| Chrome Android | ✅ | ✅ | ✅ | ✅ |
| Chrome Desktop | ✅ | ✅ | ✅ | ✅ |
| Safari iOS 16+ | ✅ | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ | — |
| Samsung Internet | ✅ | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ | ✅ |

---

## Roadmap

- [ ] Self-hosted signalling server (remove PeerJS public dependency)
- [ ] Transfer speed & ETA display
- [ ] Pause / resume large transfers
- [ ] Transfer history (local only)
- [ ] Multiple concurrent sessions
- [ ] Dark / light theme toggle

---

## Contributing

Pull requests are welcome. For major changes please open an issue first.

```bash
git clone https://github.com/mananmadani/DropBeam.git
cd DropBeam

# Make changes to index.html / app.js / transfer.js / style.css
# Test on two devices or two browser tabs
# Open a PR describing what you changed and why
```

---

## License

MIT © [Manan Madani](https://github.com/mananmadani)

---

<div align="center">

Built with ⚡ using WebRTC · Runs entirely in your browser

**[mananmadani.github.io/DropBeam](https://mananmadani.github.io/DropBeam/)**

</div>
