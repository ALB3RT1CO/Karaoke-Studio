# Brief: midi-testing-lab

## Problem
Testing a DAW-based MIDI configuration (Cakewalk, ASIO4ALL, C700) manually is error-prone and time-consuming. We lack a standardized, automated way to verify that ASIO4ALL is not blocked, MIDI routing is correct, and audio rendering works without manual intervention.

## Current State
The project has been initialized with CC-SDD and automation logging (`logs/automation_results.jsonl`), and the C700 VST plugin and ASIO4ALL driver are installed, but no actual testing configuration or track templates exist to simulate MIDI input and verify output.

## Desired Outcome
An automated "testing lab" inside Cakewalk where agents can programmatically verify ASIO4ALL configuration, inject mock MIDI data, and export/render `.wav` files to validate audio output.

## Approach
Automated Testing Strategy via DAW scripting and project file verification:
1. Ensure "Microsoft GS Wavetable Synth" is disabled.
2. Configure ASIO4ALL with a 256-sample buffer.
3. Use generated `.mid` files with mock note data injected into a C700 synth track.
4. Export the resulting audio to verify rendering.

## Scope
- **In**: Cakewalk ASIO4ALL driver setup, Virtual Controller integration, C700 `.cwp` track template generation, batch rendering scripts, AI-friendly JSON-L logging.
- **Out**: End-to-end OS-level audio routing, physical hardware driver testing, musical composition.

## Boundary Candidates
- Audio Subsystem Configuration (ASIO4ALL optimization and GS Wavetable disabling)
- MIDI Routing (Virtual Controller and track templates)
- Test Execution Engine (Mock `.mid` injection and render verification)

## Out of Boundary
- Physical MIDI keyboard hardware drivers.
- Musical logic or timing accuracy tests.

## Upstream / Downstream
- **Upstream**: Standard Windows WDM kernel-streaming, Cakewalk command-line interface.
- **Downstream**: Future CI/CD pipelines or automated agent workflows that rely on the audio system.

## Existing Spec Touchpoints
- **Extends**: None (Greenfield spec).
- **Adjacent**: Core CC-SDD testing logs (`automation_results.jsonl`).

## Constraints
ASIO4ALL requires exclusive device access, meaning tests cannot run if other software is utilizing the audio hardware. Tests must run sequentially to avoid audio driver locks.
