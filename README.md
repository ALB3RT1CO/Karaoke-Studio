# Cakewalk MIDI Retro Music Project
**Project Root:** `P:\Antigravity\Cakewalk_MIDI`

This project is set up to create retro Super Nintendo-style music using:
- **DAW:** Cakewalk Sonar (Free Tier)
- **Keyboard Input:** Logitech G Pro USB Keyboard (via Cakewalk Virtual Controller / Musical Typing)
- **Sound Generator:** C700 VST (Sony SPC700 SNES sound chip emulator)
- **Audio Driver:** ASIO4ALL v2.21 or WASAPI Exclusive

---

## Directory Organization

- `Drivers/`: Hardware and audio driver installers (contains `ASIO4ALL_2_21.exe`).
- `Plugins/`: VST2 / VST3 plugins (place `C700.dll` / `C700.vst3` here).
- `Samples/`: Super Nintendo `.spc` game soundtrack files and `.brr` sample banks (e.g. Super Mario World).
- `Projects/`: Saved Cakewalk Sonar project files (`.cwb` / `.cwp`).

---

## Quick Reference & Setup Steps

### 1. Cakewalk Sonar vs. Next
- **Selected Version:** **Cakewalk Sonar** (Free Tier).
- **Membership Needed?** No. BandLab offers a 100% Free Tier for Sonar. A paid BandLab Membership is strictly optional for extra cloud perks and bundled sound libraries.
- **Why Sonar over Next?** Sonar provides advanced MIDI routing, full piano roll editing, VST2/VST3 plugin hosting, and native Virtual Controller (`Alt + 0`), which are essential for chiptune and retro instrument emulation. Next is a simpler, loop-based sketchpad.

### 2. Audio Driver Configuration
- Inside Cakewalk Sonar: `Edit > Preferences > Audio > Playback and Recording`
- **Option A (ASIO4ALL):** Set Driver Mode to **ASIO**, open the ASIO4ALL control panel, and enable your audio output.
- **Option B (WASAPI Exclusive):** Set Driver Mode to **WASAPI Exclusive**. This is native to Windows 10/11 and offers low latency without needing third-party driver switching.

### 3. Logitech G Pro Virtual Controller
- Open the Virtual Controller with shortcut: **`Alt + 0`**
- Choose **Computer Keyboard**.
- When this window is focused, pressing your keyboard keys (A, W, S, E, D, etc.) will send MIDI note triggers to the active track.

### 4. C700 Plugin & Super Mario Sounds
- Extract C700 into `P:\Antigravity\Cakewalk_MIDI\Plugins`.
- Scan plugins in Sonar: `Edit > Preferences > File > VST Settings > Add Folder > Scan`.
- Create an Instrument Track with C700.
- Drag an `.spc` file (e.g. Super Mario World stage music) directly into the C700 interface to automatically load its sound bank!
