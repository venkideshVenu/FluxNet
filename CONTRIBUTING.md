# Contributing to FluxNet

Thanks for helping. Bug reports, fixes, features and documentation are all
welcome. This guide covers how to set up the project, the checks your change
needs to pass, and how to open a pull request.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs:** search the [issues](https://github.com/venkideshVenu/FluxNet/issues)
  first, then open one with the bug report form.
- **New features or larger changes:** open an issue to discuss the idea before
  writing code, so that nobody spends time on something that won't be merged.
- **Small fixes** such as typos or obvious one-line bugs can go straight to a
  pull request.
- **Security problems:** don't open an issue; see [SECURITY.md](SECURITY.md).

## Setting up

FluxNet is a [Tauri 2](https://tauri.app/) app: a Rust backend and a React +
TypeScript frontend running in WebView2.

### Requirements

| Tool                           | Version                             | Notes                                                                            |
| ------------------------------ | ----------------------------------- | -------------------------------------------------------------------------------- |
| Windows                        | 10 or 11                            | Needed to run the full app. The frontend also runs on macOS and Linux, see below |
| [Node.js](https://nodejs.org/) | 24 (see [`.nvmrc`](.nvmrc))         |                                                                                  |
| [pnpm](https://pnpm.io/)       | 11 (pinned in `package.json`)       | Run `corepack enable` and the right version is used automatically                |
| [Rust](https://rustup.rs/)     | Latest stable                       | The backend uses the 2024 edition                                                |
| Tauri prerequisites            | Microsoft C++ Build Tools, WebView2 | See [Tauri's Windows guide](https://tauri.app/start/prerequisites/#windows)      |

### First run

```bash
git clone https://github.com/venkideshVenu/FluxNet.git
cd FluxNet
pnpm install        # also installs the Git hooks
pnpm dev            # starts Vite and the Tauri app with hot reload
```

The first `pnpm dev` compiles the Rust backend, which takes a few minutes.
Later runs are incremental.

### Working on the UI without Windows

`pnpm dev:web` runs the frontend in a normal browser at
<http://localhost:1420>, on any OS. In development builds, a fake backend
([`src/dev/mockBackend.ts`](src/dev/mockBackend.ts)) answers the Tauri calls
with realistic data. It is never included in release builds.

Query parameters pick what to show:

| Parameter                   | Effect                                     |
| --------------------------- | ------------------------------------------ |
| `window=pill\|compact\|hud` | Render a widget instead of the main window |
| `theme=light\|dark`         | Force a colour mode                        |
| `material=mica`             | Simulate the Windows 11 Mica backdrop      |
| `onboarding=1`              | Start in the first-run setup               |
| `route=/usage`              | Open a page directly                       |
| `state=empty\|offline`      | Show the empty or disconnected states      |

For example: <http://localhost:1420/?theme=dark&route=/usage>.

Fonts, Mica and the accent colour only look right on Windows, so check UI
changes there before they're released.

### Checking the Windows backend from macOS or Linux

The Rust code is Windows-only in places (`#[cfg(windows)]`). To type-check it
from another OS, install the MinGW toolchain and the target:

```bash
brew install mingw-w64          # or your distro's mingw-w64 package
rustup target add x86_64-pc-windows-gnu
mkdir -p dist                   # tauri-build expects the frontend output folder
cd src-tauri
cargo clippy --target x86_64-pc-windows-gnu --all-targets -- -D warnings
```

This checks that the code compiles and passes Clippy. It doesn't run it. CI
builds and tests on real Windows for every pull request.

## Making a change

1. Fork the repository and create a branch from `main`, named after the change:
   `fix/pill-off-screen`, `feat/usage-export`, `docs/readme-install`.
2. Make your change, with tests (see below).
3. Run the checks.
4. Add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md) if users will
   notice the change.
5. Open a pull request and fill in the template.

### Checks

These are the same checks CI runs. Run them before you push:

```bash
pnpm check                      # type check, ESLint, Prettier, frontend tests

cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

`pnpm format` fixes formatting. When you commit, a Git hook formats and lints
the staged files and runs the type checker.

### Tests

- **Frontend:** [Vitest](https://vitest.dev/) and Testing Library. Test files
  sit next to the code they test (`formatSpeed.ts` → `formatSpeed.test.ts`).
  Run `pnpm test` for watch mode.
- **Backend:** standard Rust unit tests in `#[cfg(test)] mod tests` blocks.
  Logic that can be tested without Windows, such as storage, time handling and
  widget placement, is kept in plain functions so it can be.

Bug fixes should come with a test that fails without the fix.

### Code style

- Formatting is automatic: Prettier for TypeScript, CSS, JSON, Markdown and YAML;
  rustfmt for Rust. [`.editorconfig`](.editorconfig) sets up most editors.
- TypeScript is strict. Avoid `any`, and don't silence the type checker without a
  comment explaining why.
- Rust must pass Clippy with no warnings.
- UI follows the Windows 11 design: use the controls in
  [`src/components/fluent`](src/components/fluent) and the tokens in
  [`src/styles/tokens.css`](src/styles/tokens.css), not one-off colours or
  sizes. Labels are in sentence case, as in Windows Settings.
- Don't add a database migration by editing an existing one. Append a new one in
  [`src-tauri/src/storage/migrations.rs`](src-tauri/src/storage/migrations.rs).

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains how the pieces fit
together.

### Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/),
checked by commitlint when you commit:

```text
fix(widgets): keep the pill on screen after a monitor is unplugged

- Clamp the saved position to the nearest monitor's work area
- Add placement tests for a removed monitor
```

| Type       | Use for                                  |
| ---------- | ---------------------------------------- |
| `feat`     | A new feature                            |
| `fix`      | A bug fix                                |
| `perf`     | A performance improvement                |
| `refactor` | Code changes that don't change behaviour |
| `test`     | Adding or fixing tests                   |
| `docs`     | Documentation only                       |
| `build`    | Build system or dependencies             |
| `ci`       | GitHub Actions workflows                 |
| `chore`    | Anything else that doesn't touch the app |

Common scopes are `widgets`, `hud`, `overview`, `usage`, `adapters`,
`settings`, `onboarding`, `tray`, `storage`, `network`, `ui` and `deps`. Keep
lines under 100 characters.

### Pull requests

- Keep each pull request to one change. Several small ones are easier to review
  than one large one.
- The title must also follow Conventional Commits, because pull requests are
  squash-merged and the title becomes the commit message.
- Include screenshots in light and dark mode for UI changes.
- CI must pass. A maintainer will review, and may ask for changes.

## License

FluxNet is licensed under the [GNU General Public License v3.0 or later](LICENSE).
By contributing, you agree that your contributions are licensed under the same
terms.
