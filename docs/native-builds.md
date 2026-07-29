# Native builds

How to produce iOS and Android builds of the the platform app, what each one needs,
and what is genuinely blocked until the company store accounts exist.

Everything before this point had only ever run in the Expo web preview. These
are the first native builds, so this document also records the issues that
surfaced the first time the project was prepared for one.

## Prerequisites

```bash
cd the platform-mobile/expo
bun install
npx eas-cli login          # a free Expo account; no Apple or Google account needed
```

The Expo account must be the platform's, not a contractor's. Builds, credentials and
the project slug all live under whichever account runs them.

## Build profiles

Defined in `expo/eas.json`.

| Profile | Produces | Needs a paid store account? |
|---|---|---|
| `ios-simulator` | `.app` for the iOS Simulator | **No.** Simulator builds are not code-signed |
| `android-development` | Installable debug `.apk` | **No.** EAS generates a debug keystore |
| `android-preview` | Internal-distribution `.apk` | No |
| `production` | Store-ready binaries | Yes, both |

## Commands

```bash
# iOS simulator build. Runs on EAS macOS workers, so no Mac is required locally.
npx eas-cli build --platform ios --profile ios-simulator

# Android development build, installable on a device or emulator.
npx eas-cli build --platform android --profile android-development
```

Both print a download URL when finished. For the simulator build, unzip and drag
the `.app` onto a running Simulator, or `npx eas-cli build:run -p ios`. For
Android, download the `.apk` and `adb install` it, or open the URL on the device.

To regenerate native project files locally for inspection:

```bash
npx expo prebuild --platform android   # works on Windows
npx expo prebuild --platform ios       # macOS or Linux only
```

`android/` and `ios/` are gitignored. EAS regenerates them on every build, so
they are never committed.

## Native issues found and fixed

These only affect native builds. None of them could surface in the web preview,
which is why they had gone unnoticed.

**1. Nine packages behind the SDK 54 requirement.** `expo` itself, plus
`expo-router`, `expo-notifications`, `expo-constants`, `expo-font`,
`expo-image-picker`, `expo-linking`, `expo-splash-screen` and
`expo-web-browser`. Version skew inside a single SDK is tolerated by Metro on
web but is a common cause of native build failures. Fixed with
`npx expo install --fix`.

**2. Two versions of `expo-location` in the dependency tree.** The app depends
on `~19.0.8`. `@rork-ai/toolkit-sdk`, which the AI chat screen imports for
`createRorkTool` and `useRorkAgent`, depends on
`@teovilla/react-native-web-maps`, which pins `expo-location@~15.1.1`.

A native build may contain only one copy of a native module, so autolinking two
versions of `expo-location` would have failed the build. It could not fail on
web, where neither copy is linked natively.

Fixed with a `resolutions` entry in `package.json` forcing the single version
the app actually depends on. The web maps package is safe to override because
the app renders no maps: it arrives only as a transitive dependency of the Rork
toolkit and nothing imports `MapView` or `react-native-maps` anywhere.

**3. Duplicate copies of `expo-constants` and `expo-font`** from an inconsistent
`node_modules` tree. Cleared with a clean reinstall.

`npx expo-doctor` now reports **18/18 checks passed**, from two failing checks
before this work.

## First build results

Both profiles built successfully on the first attempt, under the platform's Expo
organisation, with no Apple Developer Program and no Google Play Console.

| Platform | Profile | Result | Artifact |
|---|---|---|---|
| iOS | `ios-simulator` | Finished | `.tar.gz` containing the `.app` for the Simulator |
| Android | `android-development` | Finished | Installable `.apk` |

Build pages live under
`expo.dev/accounts/the platform-technologies/projects/<project>/builds/<id>`.

The Android build used a debug keystore that EAS generated and stores against
the organisation, so it belongs to the platform rather than to whoever ran the build.

Note on roles: renaming the project on Expo requires Owner or Admin. A
contractor holding only the Developer role cannot rename it, cannot change
members and cannot touch billing, which is the intended arrangement.

## What still needs the paid accounts

**Apple Developer Program**

- TestFlight distribution
- Sign in with Apple (an entitlement, so it needs a provisioning profile)
- Push notifications in production (APNs key)
- App Check via App Attest
- Installing on a physical device beyond free provisioning

Free Apple ID provisioning will install a development build on a personally
owned device, but the profile expires after **7 days**, is limited to three
apps, and requires a Mac with Xcode. Push and Sign in with Apple do not work
under it.

**Google Play Console**

- Internal test track
- Play App Signing
- Play Integrity for App Check
- Play-signed OAuth verification

**Neither is needed** for the iOS simulator build, the Android development
build, or running the full Phase 1 and Phase 2 flows on either.

## Ownership

The Expo, Apple and Google projects, and every credential and capability under
them, belong to the platform. A contractor needs delegated access only, and that
access can be revoked without affecting the builds or the apps.
