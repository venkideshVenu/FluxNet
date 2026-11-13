# Architecture

FluxNet is a [Tauri 2](https://tauri.app/) application. A Rust process does all
measuring, storing and window management. The interface is a React app that
runs in one WebView2 window per surface: the main window and each desktop
widget.

```text
┌──────────────────────────── Rust process ────────────────────────────┐
│                                                                      │
│  Sampler (every 500 ms)  ──►  MonitorState ──► commands ◄── invoke() │
│     │   adapter counters        (latest speeds,                      │
│     │   ping every 5 s           peaks, adapter)                     │
│     ▼                                                                │
│  SQLite (fluxnet.db)  ◄── hourly / daily / monthly rollups           │
│                                                                      │
│  Window manager · tray · settings and widget state (JSON files)      │
└──────────────────────────────────────────────────────────────────────┘
        ▲ IPC (commands + events)
┌───────┴─────────┬─────────────┬─────────────┬─────────────┐
│ main window     │ pill        │ compact     │ hud         │   WebView2,
│ (dashboard,     │ widget      │ widget      │ game        │   created only
│  first-run)     │             │             │ overlay     │   while shown
└─────────────────┴─────────────┴─────────────┴─────────────┘
```

## Backend (`src-tauri/src`)

| Module                  | Responsibility                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `main.rs`               | Logging, panic hook, plugins (single instance, autostart), command registration, and keeping the app alive in the tray    |
| `setup.rs`              | Startup order: open the database, load settings, start the sampler, build the tray, restore widgets, open the main window |
| `background/sampler.rs` | The 500 ms sampling loop: reads counters, stores samples, runs the ping, triggers rollups, prunes old samples             |
| `commands/`             | Everything the frontend can call. `network.rs` also holds `MonitorState` and adapter selection                            |
| `monitor/`              | Speed calculation and the ping (Windows ICMP API, with a TCP-connect fallback elsewhere)                                  |
| `storage/`              | SQLite connections, migrations, queries, rollups, and DST-safe local-time helpers                                         |
| `persistence/`          | Settings and widget state stored as JSON, written atomically                                                              |
| `app_windows.rs`        | Creating and destroying windows on demand                                                                                 |
| `placement.rs`          | Pure functions that place widgets on the right monitor at the right size for its scale factor                             |
| `window_positions.rs`   | Debounced saving of widget positions while they are dragged                                                               |
| `appearance.rs`         | Reads the Windows accent colour and picks Mica (Windows 11) or a solid background (Windows 10)                            |
| `tray.rs`, `theme.rs`   | The notification-area icon and menu, and switching the icon when Windows changes between light and dark                   |

### Sampling

`start_sampler` runs one Tokio task for the life of the app. Every 500 ms it
refreshes the adapter counters (via `sysinfo`), works out download and upload
speed for the selected adapter, and writes a row to `bandwidth_samples`,
including how long the interval really was, so totals stay correct when
a tick is late. The full adapter list is re-read every 5 minutes, or straight
away if the selected adapter disappears.

The ping runs every 5 seconds on its own task, so a slow reply (it times out
after 2 seconds) never delays sampling.

The display refresh rate in Settings only changes how often the frontend asks
for data. Measurements are always taken at 500 ms.

### Storage

The database is `fluxnet.db` in the app data folder, in WAL mode. There are two
connections: a read-write one for the sampler and a read-only one for queries
from the UI, which run off the main thread.

| Table               | Contents                                  | Kept    |
| ------------------- | ----------------------------------------- | ------- |
| `bandwidth_samples` | One row per 500 ms sample                 | 7 days  |
| `hourly_usage`      | Totals, averages and peaks per local hour | Forever |
| `daily_usage`       | Per local day (`YYYY-MM-DD`)              | Forever |
| `monthly_usage`     | Per local month (`YYYY-MM`)               | Forever |

Rollups (`storage/aggregation.rs`) run when the local hour changes and at
startup. They catch up on any hours missed while the PC was asleep or FluxNet
was closed. Today's daily row is refreshed every 10 seconds so the Data usage
page stays current. All hour and day boundaries come from
`storage/local_time.rs`, which handles daylight-saving changes.

Schema changes are migrations in `storage/migrations.rs`. Only append new
migrations; never edit one that has shipped. If the database fails SQLite's
`quick_check` at startup, it is moved aside as `fluxnet.db.broken-<time>` and
a new one is created, rather than crashing.

### Windows and widgets

Every window in `tauri.conf.json` has `"create": false`. A window's WebView2
process exists only while it is on screen:

- turning a widget off destroys its window, and turning it on creates it again;
- closing the main window with "Keep running in the notification area" on
  destroys it, and the tray icon recreates it;
- while the main window is minimized, WebView2 is asked to use less memory.

Creating windows from a synchronous command deadlocks on Windows, so window
creation always happens in `async` commands or on a spawned task
(`spawn_on_app`). Turning a widget on or off emits `widget-visibility-changed`
to every window, so the Widgets page and first-run setup stay in step with the tray menu.

Widget positions are saved in physical pixels. On restore, `placement.rs`
puts the widget on the monitor that contains its centre (or the nearest one, if
that monitor has been unplugged) and keeps it inside that monitor's bounds. It
uses the full bounds rather than the work area, so a widget parked over the
taskbar stays there. New widgets start down the right edge of the primary
monitor. Each widget's logical size is re-applied whenever its scale factor
changes, which keeps it the same visual size across mixed-DPI monitors.

### Settings files

In `%APPDATA%\com.fluxnet.app`:

| File                | Contents                                                     |
| ------------------- | ------------------------------------------------------------ |
| `app-settings.json` | Refresh rate, first-run completion, keep running in the tray |
| `widget-state.json` | Per widget: visible, position, always on top; the HUD layout |
| `fluxnet.db`        | Usage history (see above)                                    |

Writes go to a temporary file, are flushed to disk, then replace the original,
so a crash or power cut can't leave a half-written file. Logs are written to
`%APPDATA%\fluxnet\logs` in release builds (one file per day), and a panic also
writes `last_crash.log` there.

## Frontend (`src`)

`main.tsx` reads the window's label and loads only that window's code:
`PillApp`, `CompactApp`, `HudApp`, or `DashboardApp` for the main window.
Widget windows never load the router, charts or settings pages.

| Folder               | Contents                                                                            |
| -------------------- | ----------------------------------------------------------------------------------- |
| `api/`               | Typed wrappers around `invoke` and `listen`                                         |
| `pages/`             | Overview, Data usage, Network adapters, Widgets, Settings, and first-run setup      |
| `components/fluent/` | Windows 11 controls: buttons, toggle switches, combo boxes, sliders, settings cards |
| `components/charts/` | The live throughput chart and the usage chart (Recharts)                            |
| `components/`        | The widgets, each split into a data container and a presentational component        |
| `hooks/`             | Polling, theme and accent sync, widget settings, drag to move                       |
| `store/`             | Zustand stores for live data and settings                                           |
| `styles/`            | `tokens.css` (WinUI colours, type ramp, spacing) and per-widget styles              |
| `utils/`             | Formatting, chart scales, usage bucketing, storage helpers                          |
| `dev/mockBackend.ts` | Fake backend for `pnpm dev:web` (development builds only)                           |

The frontend polls rather than listening for every sample. `useNetworkPoller`
calls a command at the user's refresh rate, waits for each reply before
scheduling the next, and drops replies that arrive out of order. The main
window stops polling while it is minimized or in the tray; widgets keep polling
while they are on screen.

Settings that several windows share, such as units, theme, refresh rate and
widget opacity, live in `localStorage`. Changes reach the other windows through `storage`
events. The backend is the source of truth for anything it also uses:
widget visibility, always-on-top, the HUD layout and the first-run state.

### Look and feel

The UI follows Windows 11 (WinUI 3) design. Colours, type sizes and corner radii
come from `src/styles/tokens.css`. At startup the main window asks the backend
for the Windows accent colour and backdrop, and applies them before its first
paint (waiting at most 300 ms for the answer). Chart colours were checked for colour-blind safety and contrast in both
themes.

## Build and release

- `pnpm build` builds the frontend into `dist/`. `pnpm build:desktop` builds the
  app and the NSIS installer (per-user install).
- CI (`.github/workflows/ci.yml`) runs the frontend checks on Linux, and
  `cargo fmt`, `cargo clippy` and `cargo test` on Windows.
- Pushing a `v*` tag runs `.github/workflows/release.yml`, which builds the
  installer and creates a draft GitHub release. See [RELEASING.md](RELEASING.md).
