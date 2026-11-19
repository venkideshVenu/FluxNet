# Changelog

All notable changes to FluxNet are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-11-19

### Changed

- Automatic adapter mode now follows the adapter Windows uses for the
  internet, all the time. Plugging in an Ethernet cable (or connecting a VPN)
  switches FluxNet over within a few seconds, even while the main window is
  closed. A manually chosen adapter is remembered across restarts.
- First-run setup has two steps instead of three: the adapter step is gone,
  since automatic mode is right for almost everyone. The game overlay's layout
  is chosen on its card, so the page no longer needs scrolling.
- Widgets size their windows to their content. The pill and compact widgets
  are smaller, and no widget is cut off by wider fonts or text settings.
- The vertical game overlay lines up its values and units in columns.
- The light theme is softer: grey surfaces instead of near-white ones.
- Widget settings expand and collapse with an animation, and the page no
  longer changes width when a scrollbar appears.
- Overview's "Back to now" is a proper button.
- Panning the Overview chart redraws at most once per frame, which keeps the
  graphics memory spike while scrolling it lower.

### Fixed

- Widgets set to the "System" theme followed the app's theme instead of
  Windows' when the app was set to light or dark.

## [0.2.0] - 2026-11-18

### Added

- Windows 11 look: Mica backdrop on Windows 11, your Windows accent colour,
  Segoe UI Variable, and Windows-style controls and navigation.
- Data usage shows every hour, day or month on its time axis, including the
  current one and periods with no traffic, and has a table view.
- Network adapters lists adapters as a choice list with a properties panel
  (MAC address, link speed, status). The "Choose adapter automatically" switch
  is remembered.
- Settings shows the app version.
- Widgets show arrows next to download and upload speeds, so the direction
  doesn't depend on colour alone.

### Changed

- Pages are renamed Overview, Data usage, Network adapters, Widgets and
  Settings. Old links redirect.
- Overview leads with live download and upload speeds above a full-width chart.
- First-run setup is rebuilt as a step-by-step flow with live widget previews.
- The weekly usage total covers exactly the last 7 days, including today.
- Updated Tauri to 2.12, sysinfo to 0.40, React to 19.3 and other dependencies.
- Windows are created only while they are shown and destroyed when closed,
  and the main window uses less memory while minimized, which lowers
  FluxNet's memory use.

### Removed

- The in-app accent colour picker. FluxNet now follows the Windows accent colour.

### Fixed

- Widgets keep their size and position on mixed-DPI and multi-monitor setups,
  and can sit over the taskbar.
- Usage totals are correct across daylight-saving changes, and hours missed
  while the PC was asleep are filled in.
- FluxNet recovers from a damaged usage database instead of failing to start.
- Settings can no longer be lost or corrupted by a crash during a save.
- Turning widgets on and off quickly no longer leaves them in the wrong state,
  and every window agrees on which widgets are on.
- Opacity changes made with the keyboard are saved.
- Speeds just under a unit boundary no longer show as "1024.0 KB/s" instead of "1.0 MB/s".
- When no adapter is clearly connected, the busiest one is chosen.
- Live speeds no longer jump back to older values when a reply arrives late.

## [0.1.2] - 2026-06-26

### Added

- Game overlay redesign with a choice of horizontal or vertical layout.
- Time format, date format and first day of the week settings.
- Toast notifications for actions such as resetting peaks.
- The pill widget shows whether the selected adapter is connected.

### Changed

- The ping target is fixed to Cloudflare (`1.1.1.1`); the setting was removed.

### Fixed

- Widgets no longer clip on some displays.
- Smoother first-run transitions and adapter selection.

## [0.1.1] - 2026-06-22

### Changed

- Choosing widgets during first-run setup is optional.

### Fixed

- A crash at startup, and resource leaks during long sessions.
- First-run setup could get stuck and never finish.

## [0.1.0] - 2026-06-16

### Added

- First release.
- Live download and upload speeds, sampled every 500 ms, with peak tracking.
- Pill, compact and game overlay desktop widgets, with per-widget opacity,
  always-on-top and refresh rate.
- Notification-area icon that follows the Windows light or dark theme.
- Usage history in a local SQLite database, with hourly, daily and monthly totals.
- First-run setup, start with Windows, and light, dark or system theme.
- Windows installer.

[Unreleased]: https://github.com/venkideshVenu/FluxNet/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/venkideshVenu/FluxNet/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/venkideshVenu/FluxNet/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/venkideshVenu/FluxNet/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/venkideshVenu/FluxNet/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/venkideshVenu/FluxNet/releases/tag/v0.1.0
