# yt-dlp Plan Audit for Host CAN1

## 1. Security & Execution Plan
To safely run `yt-dlp` on host CAN1, we will adhere to strict isolation and operational precision guidelines:
*   **Official Sources Only:** `yt-dlp` will only be installed via official package managers (`winget install yt-dlp` or package repos) or directly from the official GitHub releases repository.
*   **Cookie Security:** When accessing geo-blocked or authenticated streams, session cookies should be explicitly exported to a plaintext `cookies.txt` file from a hardened, isolated browser profile rather than using the `--cookies-from-browser` flag. This prevents `yt-dlp` from having unrestricted read access to the host's primary browser credential stores.
*   **Network Isolation:** If `yt-dlp` is run on a homelab server, it should operate within a restricted VLAN that allows outbound traffic to the WAN but drops outbound RFC1918 traffic to protect internal infrastructure.

## 2. Media Delivery & Browser Playback Standards
To guarantee universal HTML5 Direct Play across all clients without triggering server-side transcoding, all media pulled by `yt-dlp` must conform to strict standards.

**Optimal yt-dlp Options for Stream Copying (Remuxing):**
If the source stream is already H.264/AAC, we force MP4 containerization and move the `moov` atom to the front for fast streaming.
```powershell
yt-dlp -S "vcodec:h264,acodec:aac" --merge-output-format mp4 --postprocessor-args "-c:v copy -c:a copy -movflags +faststart" "URL"
```

**Optimal yt-dlp Options for Forced Transcoding:**
If the source stream is not compliant (e.g., HEVC, AV1, or 10-bit color), we will invoke FFmpeg through `yt-dlp` to force the required profile (H.264 High@4.1 8-bit, yuv420p, AAC-LC 2.0).
```powershell
yt-dlp -f "bestvideo+bestaudio/best" --merge-output-format mp4 --postprocessor-args "-c:v libx264 -profile:v high -level 4.1 -pix_fmt yuv420p -c:a aac -ac 2 -movflags +faststart" "URL"
```

## 3. Resource Consumption Scenarios
*   **Scenario A: Stream Extraction & Remuxing (Direct Play Match)**
    *   **CPU:** Minimal (1-3% on Zen 3).
    *   **RAM:** < 100MB.
    *   **Disk I/O:** Sequential write operations tied to WAN bandwidth (e.g., 5-20 MB/s).
*   **Scenario B: Software Transcoding (libx264 via FFmpeg)**
    *   **CPU:** High. `libx264` will scale across all available threads. On a Zen 3 8-core CPU (e.g., Ryzen 7 5700X), this can consume 80-100% utilization during conversion.
    *   **RAM:** 500MB - 1GB.
    *   **Thermal:** Will heavily stress CPU thermal limits; ensure adequate cooling.
*   **Scenario C: Hardware Transcoding (NVENC)**
    *   **CPU:** Low to Moderate.
    *   **GPU:** High Video Engine utilization, moderate VRAM usage (1-2GB depending on queue depth). Asynchronous offloading prevents host CPU thread starvation.

## 4. Docker Containerization Assessment
**Verdict: STRONGLY RECOMMENDED**
*   **Efficacy:** High. Containerizing the `yt-dlp` pipeline natively satisfies the requested Security Guideline 1 by creating an ephemeral, isolated environment.
*   **Execution Strategy:**
    1.  Deploy a lightweight Alpine Linux Docker container running `yt-dlp`.
    2.  Map a specific local directory (e.g., `P:\Media\Downloads`) into the container as a volume mount (`-v`).
    3.  If hardware transcoding (NVENC) is required, the container must be run with the NVIDIA Container Toolkit (`--gpus all`).
*   **Security Benefit:** The container restricts `yt-dlp`'s filesystem access exclusively to the designated download folder. It prevents the tool from accessing host credentials, user profiles, or executing rogue binaries on the host OS. Network rules can be explicitly bound to the container's bridge network.
