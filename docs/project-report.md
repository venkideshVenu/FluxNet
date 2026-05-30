# FluxNet Project Report (2026-05-29)

FluxNet is a Tauri + React desktop network meter with a full dashboard window and a compact pill widget. The app polls native network counters via Rust, keeps a short in-memory history, and renders live charts plus settings for behavior and appearance.

## Runtime Architecture

- Two UI entry points: the main dashboard window and a compact pill window, both routed from the same React bundle.
- Native backend (Rust + Tauri) exposes commands for polling stats, listing interfaces, selecting interface, resetting peaks, and pill window controls.
- Polling cadence is stored in a Zustand store; the UI reads/writes it and the poller respects live changes.

## Core Monitoring Features

- Real-time upload/download sampling from system network counters.
- Interface auto-selection at first run (skips loopback by default).
- Peak upload/download tracking for the session.
- Short history ring buffer capped at around 120 samples (used for charts and summaries).
- Snapshot API for the dashboard that returns latest values plus full history.

## Dashboard (Main Window)

- Live stat cards for upload, download, and peak download.
- Area chart for recent bandwidth history with adaptive Y-axis scaling.
- Live / No signal indicator driven by poller success/failure.
- Sidebar navigation with pages for Dashboard, History, Interfaces, Alerts, Settings.

## History Page

- Full session chart of upload/download history.
- Summary cards: peak upload, peak download, and average download.
- Empty state if no history has accumulated yet.

## Interfaces Page

- Lists available interfaces from the backend.
- Click to switch monitored interface; loopback interfaces are marked and disabled.
- Visual states: Active / Idle / Switching.

## Alerts Page

- Disconnected warning if polling fails (no signal).
- Download spike detection when last sample approaches 90 percent of peak.
- All clear info state when no alerts are triggered.

## Pill Widget (Compact Window)

- Always-on-top, transparent, borderless, non-resizable overlay window.
- Compact readout of download/upload with unit-specific styling.
- Live status dot (green/gray) reflects connection state.
- Drag-to-move behavior using native window dragging.

## Settings

- Pill visibility toggle (show/hide pill window).
- Always-on-top toggle for the pill window.
- Pill opacity slider (applies via backend and persists to localStorage).
- Polling interval selector (0.5/1/2/5 seconds).
- Display units selector (Auto/MB/s/KB/s/Mbps) stored in state.
- Light/dark mode toggle and accent color picker.
- Pill-only dark mode toggle.
- Reset peak values (native command).

## System Tray and Windowing

- Tray icon with menu: Open dashboard, Show widget, Hide widget, Quit.
- Left-click tray toggles pill visibility and focuses it.
- Dashboard window creation logic ensures a single main window instance.

## Theming and Styling

- CSS variables with light/dark modes and dynamic accent theming.
- Visual system for cards, badges, toggles, alerts, empty states, and charts.
- Pill widget has its own minimal theme with color-coded units.

## Testing and Tooling

- Unit tests for speed formatting.
- Store tests for initial state and mutations.
- Hook test for polling and error handling.
- UI test for pill widget rendering.
- Rust unit tests for bandwidth calculations and interface listing.

## Notes on Partial or Incomplete Wiring

- Display units is stored in state and selectable, but current formatting calls do not apply the selected unit yet.
- Start with Windows UI calls autostart commands, but corresponding Rust commands are not present; the UI currently degrades gracefully with a warning.
