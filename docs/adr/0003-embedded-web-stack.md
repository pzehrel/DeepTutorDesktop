# ADR-0003: Embed the full DeepTutor web stack, allowing loopback HTTP

- Status: Accepted
- Date: 2026-09-10
- Scope: full-application distribution of DeepTutorDesktop
- Relation: amends ADR-0001's "the agent listens on no TCP port" constraint for the embedded web stack; the stdio bridge (ADR-0001) remains in place for protocol-level access.

## Context

ADR-0001 adopted the stdio bridge on the premise that the desktop shell only needed programmatic access to DeepTutor capabilities. The product goal, however, is to deliver the complete DeepTutor learning interface: opening the app lands the user in the web UI (sessions, knowledge bases, visualizations, settings, and more). That interface is provided by DeepTutor's official wheel — a Next.js frontend (`deeptutor_web`) plus a FastAPI backend — and the two speak only HTTP/WebSocket; there is no stdio form of them.

## Decision

1. At build time, install the pinned official `deeptutor` wheel into an embedded Python runtime (python-build-standalone) and package it together with an official Node.js binary as Tauri resources (see `docs/packaging.md`).
2. The Rust Core runs `deeptutor start --detach --no-browser` inside the application data directory, reads the ports recorded in the home directory's `system.json`, waits for the loopback interface to become ready, and then navigates the window to the frontend URL.
3. Backend and frontend bind to `127.0.0.1` only, with ports managed by the launcher; on app exit, `deeptutor stop` performs a graceful shutdown.
4. This project never copies or modifies DeepTutor source; DeepTutor is always consumed as a pinned external dependency (the PyPI wheel).

## Relation to ADR-0001's constraint

ADR-0001's TCP ban was motivated by "do not expose the agent to other processes on this machine". The full web UI cannot satisfy that constraint, so this ADR amends it to: **the sole permitted exception is the launcher binding to the loopback interface**, while the stdio bridge (ADR-0001, `bridge/`) remains the protocol-level, TCP-free access channel. Both coexist.

## Costs

- other processes under the same local user can in principle reach the loopback ports (the same risk level as a browser accessing localhost);
- distribution size grows significantly (Python + Node + wheel, several hundred MB);
- CI must build a runtime per target platform.

## Alternatives considered

### Converting the Next.js frontend into static assets embedded in the WebView

Requires forking the DeepTutor frontend and rewriting its API layer onto the bridge protocol — violating the "no upstream source coupling" boundary, and breaking with every upstream release.

### Opening the frontend in a browser with Tauri as a mere launcher

Degrades the experience to "opening a web page" and fails the "install one desktop app and you are done" goal.
