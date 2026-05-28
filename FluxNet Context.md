FluxNet Context

directory structure

F:\New folder>tree /F
Folder PATH listing for volume New Volume
Volume serial number is 000000E3 5C2D:BF20
F:.
│   .gitignore
│   commitlint.config.js
│   eslint.config.js
│   FluxNet Context.md
│   index.html
│   package.json
│   pnpm-lock.yaml
│   pnpm-workspace.yaml
│   README.md
│   tailwind.config.js
│   tsconfig.json
│   tsconfig.node.json
│   vite.config.ts
│
│
├───src
│   │   App.css
│   │   App.tsx
│   │   index.css
│   │   main.tsx
│   │   vite-env.d.ts
│   │
│   ├───assets
│   │       react.svg
│   │
│   ├───components
│   │       PillWidget.test.tsx
│   │       PillWidget.tsx
│   │
│   ├───hooks
│   │       useNetworkPoller.test.ts
│   │       useNetworkPoller.ts
│   │
│   ├───store
│   │       networkStore.test.ts
│   │       networkStore.ts
│   │
│   ├───test
│   │       setup.ts
│   │
│   └───utils
│           formatSpeed.test.ts
│           formatSpeed.ts
│
└───src-tauri
    │   .gitignore
    │   build.rs
    │   Cargo.lock
    │   Cargo.toml
    │   tauri.conf.json
    │
    ├───capabilities
    │       default.json
    │
    ├───gen
    │   └───schemas
    │           acl-manifests.json
    │           capabilities.json
    │           desktop-schema.json
    │           windows-schema.json
    │
    └───src
        │   lib.rs
        │   main.rs
        │
        ├───commands
        │       mod.rs
        │       network.rs
        │
        └───monitor
                bandwidth.rs
                mod.rs