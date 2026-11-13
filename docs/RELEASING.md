# Releasing FluxNet

Releases are built by GitHub Actions when a version tag is pushed. Versions
follow [Semantic Versioning](https://semver.org/): while FluxNet is `0.x`, a
minor bump (`0.2.0`) can include breaking changes, and a patch (`0.1.3`) is for
fixes only.

## Steps

1. **Start from an up-to-date `main` with green CI.**

   ```bash
   git switch main && git pull
   ```

2. **Test on Windows.** Install a local build (`pnpm build:desktop`) over the
   previous release and check:
   - upgrading keeps usage history, settings and widget positions;
   - widgets on a second monitor with a different scale factor;
   - light and dark mode, and Mica on Windows 11;
   - start with Windows, close to tray, and quitting from the tray menu.

3. **Set the version** in `package.json`, `src-tauri/Cargo.toml` and
   `src-tauri/tauri.conf.json` with one command, then refresh `Cargo.lock`:

   ```bash
   pnpm version:set 0.2.0
   (cd src-tauri && cargo check)
   ```

4. **Update the changelog.** In `CHANGELOG.md`, rename **Unreleased** to the new
   version and date, add a fresh empty **Unreleased** section above it, and
   update the comparison links at the bottom.

5. **Commit and tag.**

   ```bash
   git commit -am "chore(release): 0.2.0"
   git tag -a v0.2.0 -m "FluxNet 0.2.0"
   git push origin main v0.2.0
   ```

   A tag with a hyphen, such as `v0.2.0-beta.1`, is published as a pre-release.

6. **Publish.** The [Release workflow](../.github/workflows/release.yml) checks
   that the tag matches the version in all three files, runs the frontend tests,
   builds the NSIS installer and attaches it to a **draft** release with
   `SHA256SUMS.txt`. Review the draft on the
   [releases page](https://github.com/venkideshVenu/FluxNet/releases), paste
   the changelog section into the notes, then publish it.

## If something goes wrong

- **The version check fails:** the tag and the files disagree. Delete the tag
  (`git push --delete origin v0.2.0 && git tag -d v0.2.0`), fix the version,
  and tag again.
- **A bad release is already published:** don't delete or reuse its tag.
  Mark it as a pre-release so it stops being "Latest", and ship a patch
  version with the fix.

## Code signing

Installers are not code-signed yet, so Windows SmartScreen warns on first
run. To sign them, add a certificate and set `certificateThumbprint` under
`bundle.windows` in `src-tauri/tauri.conf.json` (see
[Tauri's Windows signing guide](https://tauri.app/distribute/sign/windows/)).
