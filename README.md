# Karaoke Studio

A modern, high-performance, local-first web application for karaoke singing and lyric synchronization. Features real-time 60fps word-by-word highlighting, floating musical chord annotations, YouTube backing track synchronization, and automated document ingestion.

---

## Features

- **60fps Fluid Karaoke Display:** Pure vanilla JS and CSS variable gradient rendering engine ensuring buttery-smooth word fill without UI frame drops or unnecessary React re-renders.
- **Musical Chord Annotations:** Displays guitar/piano chords (e.g. `DoM`, `Sol7`, `Rem`) positioned above lyric segments without interfering with the karaoke gradient fill.
- **YouTube Backing Track Sync:** Seamlessly integrates with YouTube IFrame API to play official audio or backing tracks aligned with synchronized lyrics.
- **Interactive Tap-to-Sync Engine:** Built-in tool allowing real-time spacebar tapping to record or adjust timestamps with auto-save to persistent storage.
- **Automated Document Ingestion:** Built-in parsers for `.docx` and `.rtf` lyric sheets to automatically extract song titles, artists, chords, and clean lyric lines.
- **Zero-Database Architecture:** Fast in-memory datastore backed by an append-only JSONL transaction log (`data.jsonl`) for resilient state management.
- **Self-Hosted & Private:** Docker and Nginx configurations included for reverse-proxy hosting via domain or private mesh VPN (Tailscale).
- **Spec-Driven Development (SDD):** Built following the [gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) framework with strict TDD, quality gateways, and automated watchdog telemetry.

---

## Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v22+ or v26+
- (Optional) Docker & Docker Compose for containerized deployment

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/ALB3RT1CO/Karaoke-Studio.git
cd Karaoke-Studio

# Install dependencies
npm install
```

### 3. Run the Development Server
```bash
npm start
```
Open your browser and navigate to:
👉 **`http://localhost:3030`**

---

## Project Structure

```
Karaoke-Studio/
├── src/
│   ├── server/               # Node.js HTTP server & in-memory transaction store
│   │   ├── store.ts          # Core datastore & JSONL replay engine
│   │   ├── server.ts         # REST API & static file server
│   │   └── ingestion/        # Document & metadata extraction (DOCX, RTF, YouTube)
│   └── components/           # Frontend motion & sync modules
├── public/                   # Web client (index.html, Tailwind CSS, 60fps player)
├── data/                     # Catalog index and initial seed data
├── scripts/                  # Automated maintenance, watchdog, and ingestion scripts
├── test/                     # Comprehensive TDD test suite (100% passing)
├── nginx/                    # Nginx reverse proxy configuration
├── Dockerfile                # Production container specification
├── docker-compose.yml        # Multi-container orchestration (App + Nginx)
└── .kiro/                    # SDD specifications and project steering memory
```

---

## Deployment & Hosting

### Docker Compose
Run the entire stack (Node backend + Nginx reverse proxy) in containers:
```bash
docker-compose up -d
```

### Secure Remote Access via Tailscale
The server automatically binds to all network interfaces (`0.0.0.0:3030`). To share private access with other Tailscale users:
1. Share this machine (`can1`) from your Tailscale Admin Console.
2. Authorized users can connect directly to:
   ```
   http://100.66.212.99:3030
   # or via MagicDNS:
   http://can1:3030
   ```

---

## Testing & Verification

Run the complete test suite:
```bash
npm test
```

Generate automated JUnit XML test reports:
```bash
npm run test:junit
```

Run the anti-looping 5-minute watchdog audit:
```bash
npm run watchdog
```

---

## License
MIT License.
