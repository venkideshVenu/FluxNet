# Software Requirements Specification (SRS)

> This is the original requirements document, written before the first
> release. It records the intended scope and goals; where it differs from the
> code, the code and [ARCHITECTURE.md](ARCHITECTURE.md) describe how FluxNet
> works today. Items such as macOS support are plans, not current features.

# Cross-Platform Real-Time Network Meter Desktop Application

---

# 1. Introduction

## 1.1 Purpose

The purpose of this document is to define the software requirements, architecture expectations, system behavior, and functional/non-functional specifications for a lightweight real-time network monitoring desktop application.

The application will primarily target Microsoft Windows during the initial release and later extend support to macOS.

The application will provide users with:

- Real-time upload/download speed monitoring
- Floating desktop widget overlay
- System tray integration
- Historical bandwidth visualization
- Low-resource background execution
- Customizable appearance and behavior

The goal is to create a modern, minimal, high-performance alternative to existing network meter applications.

## 1.2 Scope

The application is designed as a lightweight desktop utility for users who want continuous visibility into network activity.

The system will:

- Monitor selected network interfaces
- Calculate real-time bandwidth usage
- Display data in an overlay widget
- Provide historical mini-graphs
- Run efficiently in the background
- Support customization and theming
- Minimize CPU and memory usage

The initial version focuses on:

- Windows support
- Core monitoring functionality
- Stable floating overlay system
- Performance optimization

Future versions may include:

- macOS support
- Per-application network monitoring
- Internet quality metrics
- Plugin architecture
- Cloud synchronization
- Usage analytics

## 1.3 Definitions and Terminology

| Term              | Description                                              |
| ----------------- | -------------------------------------------------------- |
| Bandwidth         | Amount of data transferred over a network connection     |
| Upload Speed      | Outgoing network transfer rate                           |
| Download Speed    | Incoming network transfer rate                           |
| Overlay Widget    | Floating desktop window displaying network data          |
| Network Interface | Hardware or virtual network adapter                      |
| Polling           | Repeatedly reading system network statistics             |
| Sampling Interval | Time gap between bandwidth measurements                  |
| IPC               | Inter-process communication between frontend and backend |
| Tray Application  | Application running in system tray                       |
| WebView           | Native embedded browser rendering engine                 |

## 1.4 Intended Audience

This document is intended for:

- Software developers
- System architects
- UI/UX designers
- Contributors
- Future maintainers
- Open-source collaborators

## 1.5 Technology Stack

| Layer                | Technology                        |
| -------------------- | --------------------------------- |
| Frontend UI          | React                             |
| Styling              | Tailwind CSS                      |
| Desktop Framework    | Tauri                             |
| Backend/System Layer | Rust                              |
| Charts/Visualization | Recharts / Canvas-based rendering |
| Build Tool           | Vite                              |
| State Management     | Zustand / Context API             |
| Packaging            | Tauri Bundler                     |
| Future macOS Support | Native Tauri macOS APIs           |

---

# 2. Overall Description

## 2.1 Product Perspective

The application is a standalone desktop utility.

The system consists of:

- Native desktop window management
- Real-time network monitoring engine
- UI rendering engine
- Background service layer
- Platform integration layer

The architecture separates:

- System-level logic (Rust backend)
- Presentation layer (React frontend)

This separation improves:

- maintainability
- scalability
- portability
- performance

## 2.2 Product Goals

### Functional Goals

- Accurate real-time monitoring
- Lightweight background execution
- Stable overlay rendering
- Cross-platform architecture
- User customization

### Engineering Goals

- Low memory usage
- Minimal CPU consumption
- Efficient rendering
- Smooth animations
- Native desktop experience

### User Experience Goals

- Minimal visual clutter
- Fast startup
- Always accessible
- Reliable measurements
- Modern UI aesthetics

## 2.3 User Classes

| User Type    | Description                            |
| ------------ | -------------------------------------- |
| Casual Users | Want basic internet speed visibility   |
| Gamers       | Need latency and bandwidth awareness   |
| Developers   | Monitor downloads, APIs, cloud sync    |
| Streamers    | Observe upload stability               |
| Power Users  | Want detailed monitoring/customization |

## 2.4 Operating Environment

### Initial Target

- Windows 10
- Windows 11

### Future Support

- macOS Ventura+
- macOS Sonoma+

### Minimum Hardware Requirements

| Component  | Requirement                    |
| ---------- | ------------------------------ |
| RAM        | 4 GB                           |
| CPU        | Dual-core processor            |
| Disk Space | 150 MB                         |
| GPU        | Integrated graphics sufficient |

## 2.5 Constraints

### Technical Constraints

- Must use Tauri architecture
- Must minimize polling overhead
- Must avoid memory leaks
- Must support high-DPI displays
- Must support multi-monitor setups

### UX Constraints

- Overlay must remain unobtrusive
- App should not block user workflows
- Startup time should remain minimal

### Performance Constraints

- CPU usage target: <2%
- RAM usage target: <150 MB
- UI refresh target: 60 FPS

---

# 3. System Architecture

## 3.1 High-Level Architecture

```text
+------------------------------------------------+
| User Interface                                 |
| React + Tailwind                               |
+------------------------------------------------+
| Tauri IPC Communication                        |
+------------------------------------------------+
| Rust Backend Engine                            |
|                                                |
| - Network Monitor                              |
| - Sampling Engine                              |
| - Data Processor                               |
| - Platform APIs                                |
+------------------------------------------------+
| Operating System APIs                          |
+------------------------------------------------+
```

## 3.2 Frontend Layer

### Responsibilities

- Widget rendering
- Graph visualization
- User settings UI
- Theme handling
- Window interaction
- Real-time updates

### Features

- Responsive layout
- Hardware accelerated rendering
- Animation support
- Dynamic graphs

## 3.3 Backend Layer

### Responsibilities

- Network interface monitoring
- Bandwidth calculation
- Polling management
- CPU optimization
- Native OS interaction

### Rust Responsibilities

- Read network counters
- Process byte deltas
- Compute transfer rates
- Manage event loops
- Provide IPC APIs

## 3.4 Platform Layer

### Windows APIs

Potential APIs:

- IP Helper API
- Performance Counters
- WinRT APIs
- Windows Networking APIs

### macOS APIs (Future)

Potential APIs:

- SystemConfiguration
- Network framework
- Darwin networking APIs

---

# 4. Functional Requirements

## 4.1 Real-Time Network Monitoring

### Description

The application shall monitor upload and download speeds in real time.

### Functional Requirements

| ID   | Requirement                                            |
| ---- | ------------------------------------------------------ |
| FR-1 | System shall detect available network interfaces       |
| FR-2 | System shall allow interface selection                 |
| FR-3 | System shall calculate upload speed                    |
| FR-4 | System shall calculate download speed                  |
| FR-5 | System shall update displayed values periodically      |
| FR-6 | System shall support configurable refresh intervals    |
| FR-7 | System shall handle interface disconnection gracefully |

## 4.2 Floating Widget System

### Description

The application shall display a floating desktop widget.

### Functional Requirements

| ID    | Requirement                              |
| ----- | ---------------------------------------- |
| FR-8  | Widget shall support always-on-top mode  |
| FR-9  | Widget shall be draggable                |
| FR-10 | Widget shall support resizing            |
| FR-11 | Widget shall support transparency        |
| FR-12 | Widget shall remember previous position  |
| FR-13 | Widget shall support multiple themes     |
| FR-14 | Widget shall minimize visual obstruction |

## 4.3 System Tray Integration

### Functional Requirements

| ID    | Requirement                                         |
| ----- | --------------------------------------------------- |
| FR-15 | Application shall minimize to system tray           |
| FR-16 | Tray menu shall provide quick controls              |
| FR-17 | User shall be able to quit application from tray    |
| FR-18 | User shall be able to show/hide overlay             |
| FR-19 | Application shall optionally start with system boot |

## 4.4 Historical Graph Visualization

### Functional Requirements

| ID    | Requirement                                         |
| ----- | --------------------------------------------------- |
| FR-20 | System shall display bandwidth history graph        |
| FR-21 | Graph shall update in real time                     |
| FR-22 | System shall maintain configurable history duration |
| FR-23 | Graph shall support smoothing                       |
| FR-24 | Graph shall support compact and expanded modes      |

## 4.5 Settings and Customization

### Functional Requirements

| ID    | Requirement                            |
| ----- | -------------------------------------- |
| FR-25 | User shall configure refresh interval  |
| FR-26 | User shall configure widget opacity    |
| FR-27 | User shall configure widget size       |
| FR-28 | User shall choose display units        |
| FR-29 | User shall select themes               |
| FR-30 | User shall configure startup behavior  |
| FR-31 | Settings shall persist across restarts |

## 4.6 Notifications

### Functional Requirements

| ID    | Requirement                                         |
| ----- | --------------------------------------------------- |
| FR-32 | System may provide bandwidth spike alerts           |
| FR-33 | System may notify interface disconnection           |
| FR-34 | Notifications shall use native OS notification APIs |

## 4.7 Future Advanced Features

### Planned Features

#### Per-Application Monitoring

- Process-level network tracking
- Application usage graphs
- Top bandwidth consumers

#### Internet Quality Metrics

- Ping monitoring
- Jitter monitoring
- Packet loss analysis

#### Advanced Overlay Modes

- Gaming HUD
- Compact mode
- Graph-only mode
- Minimal pill mode

---

# 5. Non-Functional Requirements

## 5.1 Performance Requirements

| ID    | Requirement                                         |
| ----- | --------------------------------------------------- |
| NFR-1 | Application startup time < 3 seconds                |
| NFR-2 | Average CPU usage < 2%                              |
| NFR-3 | Average memory usage < 150 MB                       |
| NFR-4 | UI updates should remain smooth at 60 FPS           |
| NFR-5 | Polling engine shall avoid unnecessary calculations |

## 5.2 Reliability Requirements

| ID    | Requirement                                              |
| ----- | -------------------------------------------------------- |
| NFR-6 | Application shall recover from interface changes         |
| NFR-7 | Application shall not crash during network interruptions |
| NFR-8 | Application shall persist settings safely                |
| NFR-9 | Monitoring engine shall remain stable for long durations |

## 5.3 Scalability Requirements

| ID     | Requirement                                      |
| ------ | ------------------------------------------------ |
| NFR-10 | Architecture shall support macOS expansion       |
| NFR-11 | System shall support plugin extensions in future |
| NFR-12 | System shall support future monitoring modules   |

## 5.4 Security Requirements

| ID     | Requirement                                           |
| ------ | ----------------------------------------------------- |
| NFR-13 | Application shall not transmit user data externally   |
| NFR-14 | Application shall not require unnecessary permissions |
| NFR-15 | Local configuration shall remain sandboxed            |

## 5.5 Usability Requirements

| ID     | Requirement                                   |
| ------ | --------------------------------------------- |
| NFR-16 | Interface shall remain intuitive              |
| NFR-17 | Users shall access settings within two clicks |
| NFR-18 | Widget shall avoid clutter                    |
| NFR-19 | Application shall support dark mode           |

---

# 6. UI/UX Requirements

## 6.1 Design Principles

The UI should:

- remain minimal
- prioritize readability
- avoid clutter
- support translucency
- support modern Windows aesthetics

## 6.2 Widget Variants

### Compact Widget

Displays:

- upload speed
- download speed

### Graph Widget

Displays:

- historical graph
- current speed

### Gaming Overlay

Displays:

- latency
- bandwidth
- packet loss

## 6.3 Visual Style

### Preferred Styles

- Windows 11 aesthetic
- Acrylic blur
- Mica effect
- Rounded corners
- Smooth animations

---

# 7. Data Flow

## 7.1 Monitoring Flow

```text
OS Network Counters
 ↓
Rust Polling Engine
 ↓
Bandwidth Calculation
 ↓
IPC Communication
 ↓
React State Update
 ↓
Widget Rendering
```

## 7.2 Speed Calculation

Formula:

```text
Speed = (CurrentBytes - PreviousBytes) / TimeInterval
```

Additional Processing:

- smoothing
- averaging
- spike reduction
- adaptive refresh optimization

---

# 8. Error Handling

## Error Scenarios

| Scenario                   | Expected Behavior         |
| -------------------------- | ------------------------- |
| Network adapter disconnect | Display graceful fallback |
| Invalid interface          | Prompt user selection     |
| Permission issues          | Show warning notification |
| Corrupted settings         | Restore defaults          |
| IPC failure                | Attempt reconnect         |

---

# 9. Installation and Distribution

## 9.1 Windows Packaging

The application shall provide:

- EXE installer
- MSI installer
- Portable version (future)

## 9.2 Installer Features

Installer should support:

- desktop shortcut creation
- startup registration
- uninstall entry
- version upgrades

---

# 10. Logging and Diagnostics

## Requirements

| ID    | Requirement                              |
| ----- | ---------------------------------------- |
| LOG-1 | Application shall maintain internal logs |
| LOG-2 | Logs shall support debugging             |
| LOG-3 | User shall optionally export logs        |

---

# 11. Testing Requirements

## 11.1 Unit Testing

Test:

- bandwidth calculations
- smoothing algorithms
- parser logic
- settings persistence

## 11.2 Integration Testing

Test:

- frontend-backend IPC
- tray integration
- startup behavior
- overlay rendering

## 11.3 Performance Testing

Test:

- CPU usage
- memory leaks
- refresh stability
- rendering performance

## 11.4 Compatibility Testing

Test:

- Windows 10
- Windows 11
- multiple DPI scales
- multiple monitors

---

# 12. Future Roadmap

## Version 1.0

Features:

- realtime monitoring
- floating widget
- tray integration
- graph visualization
- customization

## Version 1.5

Features:

- latency monitoring
- internet quality metrics
- advanced themes
- adaptive refresh

## Version 2.0

Features:

- macOS support
- per-app monitoring
- plugin architecture
- cloud sync

---

# 13. Risks and Challenges

## Technical Risks

### Accurate Speed Measurement

Improper sampling may produce unstable spikes.

### High CPU Usage

Frequent polling can increase resource consumption.

### Transparent Window Rendering

Cross-platform overlay rendering can behave differently.

### Multi-Monitor Positioning

Overlay positioning across monitors requires careful handling.

### High DPI Scaling

UI scaling must remain consistent across displays.

---

# 14. Success Criteria

The project will be considered successful if:

- application remains lightweight
- bandwidth calculations remain accurate
- overlay remains stable
- CPU usage remains minimal
- users can customize behavior easily
- installation is seamless
- cross-platform architecture remains extensible

---

# 15. Conclusion

This project aims to create a modern, minimal, and efficient real-time network meter desktop application with a strong focus on:

- engineering quality
- performance
- native desktop experience
- scalability
- user experience

The architecture intentionally separates UI rendering from system-level logic to ensure:

- maintainability
- extensibility
- platform portability
- long-term scalability

The project serves both as:

- a practical productivity utility
- a technically sophisticated systems engineering project

---

# Appendix A — Suggested Rust Crates

| Crate                   | Purpose                |
| ----------------------- | ---------------------- |
| sysinfo                 | System information     |
| netdev                  | Network interface data |
| tokio                   | Async runtime          |
| tauri-plugin-autostart  | Startup integration    |
| tauri-plugin-positioner | Window positioning     |
| serde                   | Serialization          |
| anyhow                  | Error handling         |
| tracing                 | Logging                |

---

# Appendix B — Suggested Project Structure

```text
network-meter/
│
├── src/                    # React frontend
│   ├── components/
│   ├── hooks/
│   ├── store/
│   ├── pages/
│   └── styles/
│
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── monitor/
│   │   ├── platform/
│   │   ├── ipc/
│   │   ├── utils/
│   │   └── main.rs
│   │
│   └── tauri.conf.json
│
├── public/
├── package.json
└── README.md
```

---

# Appendix C — Suggested Development Phases

## Phase 1

- Learn Tauri basics
- Build network polling CLI
- Understand Rust ownership and async

## Phase 2

- Build React widget UI
- IPC integration
- Real-time updates

## Phase 3

- Add tray support
- Add graphs
- Add settings

## Phase 4

- Performance optimization
- Memory optimization
- Rendering optimization

## Phase 5

- Packaging
- Installer
- Release management

## Phase 6

- macOS support
- Cross-platform abstractions
- Advanced monitoring

```

```
