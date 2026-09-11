# ADR-0002: Tauri as the desktop shell

- Status: Accepted ("no localhost HTTP" has been amended for the embedded web stack by [ADR-0003](0003-embedded-web-stack.md); the "no Electron" constraint remains fully in force)
- Date: 2026-09-09
- Scope: desktop shell selection

## Context

The desktop build must distribute DeepTutor self-contained, avoid local TCP ports, and keep the agent package decoupled from the shell. Both Electron and Tauri can manage sidecars, but this project prioritizes a smaller desktop runtime, an explicit permission model, and centralized sidecar lifecycle management in the Rust main process.

## Decision

Use Tauri for the desktop shell:

- the WebView renderer owns the interface;
- the Rust Core owns commands/events, sidecar lifecycle, and application paths;
- the DeepTutor runtime (Python + Node + wheel) ships as Tauri resources (an implementation evolution; the original plan was `externalBin`);
- the Rust Core talks to the bridge over stdin/stdout NDJSON JSON-RPC;
- no localhost HTTP/WebSocket service is started (amended by ADR-0003 for the embedded web stack);
- Tauri capabilities authorize only the fixed bridge sidecar — no generic shell permission.

## Rationale

- the sidecar is this project's core execution model, and Tauri has explicit packaging and permission configuration for external binaries;
- the agent runs in its own Python runtime and does not require embedding Python into the Rust process;
- WebView, Rust Core, and sidecar form a clear least-privilege boundary;
- the app avoids carrying Electron's bundled Chromium/Node runtime;
- the stdio bridge is independent of the UI framework and remains portable.

## Costs

- a small amount of Rust code must be maintained;
- the bridge/runtime must be built and signed for every target triple;
- DeepTutor's existing Next.js frontend cannot depend on a local service as-is — it needs a Tauri IPC transport or conversion to an embeddable static frontend;
- Tauri does not solve Python runtime dependency packaging itself; that needs its own build pipeline.

## Constraint

Until superseded by a new ADR, no Electron project, Electron Builder configuration, or Electron-specific bridge API may be added.
