# macOS Build

ibia now has a macOS Electron Builder target. macOS packages must be built on macOS because Electron Builder cannot create macOS artifacts from Windows.

## Local macOS Build

```bash
npm install
node scripts/generate_icon.js
npm run pack:mac
npm run dist:mac
```

`pack:mac` creates an unpacked `.app` for smoke testing. `dist:mac` creates the distributable `.dmg` and `.zip` in `dist/`, for **arm64 and x64** — four artifacts, so Apple Silicon and Intel Macs each get a native build. To build a single architecture while iterating:

```bash
npx electron-builder --mac --arm64
```

Minimum supported system is macOS 11 (Big Sur).

## What to Smoke Test on macOS

The macOS build is feature-identical to Windows. Worth checking by hand on a real Mac:

* **Menu bar icon** — click toggles the window; right-click shows the appearance modes.
* **Global shortcut** — default `Cmd+Shift+I`; rebind it in Settings and confirm the new combination works after an app restart.
* **Breathe** — the window fades in without taking focus from the app you are typing in, holds while the cursor is over it, and fades out again. It is set to show on all Spaces and over fullscreen apps.
* **Traffic lights** — the inset title bar draws over the transparent window; the in-app minimize/maximize/close buttons are hidden on macOS.
* **Document library** — requires `python3` on `PATH` (`brew install python`). ibia probes `python3`, the Homebrew paths, then `/usr/bin/python3`; if none answer it reports that Python 3 is needed instead of failing silently.
* **Local models** — Ollama on `127.0.0.1:11434` works the same. Foundry Local is Windows-only, so on macOS use Ollama or a cloud key.

## Entitlements

`build/entitlements.mac.plist` is applied to the app and its helpers under the hardened runtime. It allows JIT and unsigned executable memory (Electron), library validation and dyld environment variables (so the bundled app can run the system `python3` extractor), outbound network access, and user-selected file read/write.

## Signed Distribution

For public distribution, build on macOS with Apple Developer signing credentials and notarization configured:

```bash
export CSC_LINK="/path/to/developer-id-application.p12"
export CSC_KEY_PASSWORD="certificate-password"
export APPLE_ID="apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID1234"

npm run dist:mac
```

Unsigned local builds are fine for internal testing, but users will see macOS Gatekeeper warnings unless the app is signed and notarized.

## GitHub Actions

The `.github/workflows/build-macos.yml` workflow builds the macOS `.dmg` and `.zip` on `macos-latest` and uploads them as `ibia-macos`. Add the signing values above as repository secrets to produce signed/notarized release builds.
