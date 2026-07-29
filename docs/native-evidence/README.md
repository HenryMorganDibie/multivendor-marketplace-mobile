# Native evidence

Phase 1 running on a real Android build, captured automatically by Maestro
against an installed APK on an Android 14 emulator. Not a web preview.

Reproduce with:

```bash
maestro test maestro/phase1-vendor-registration.yaml
```

## Android

| Shot | Shows | Criterion |
|---|---|---|
| 01-login | Login screen | Apple and Google buttons absent, email/password intact |
| 02-choose-account-type | Customer or Vendor | — |
| 03-registration-seven-fields | The seven agreed fields | Business Name and Category absent, deferred to the checklist |
| 04-registration-filled | Form completed | — |
| 05-password-visible | Visibility toggle | — |
| 06-country-picker | Country list | — |
| 07-country-selected | Nigeria selected | No state or area asked for at signup |
| 08-legal-consent | Consent above the button | Terms of Use, Privacy Policy and Vendor Agreement each named and separately tappable |

Every assertion behind these passed on the device, including the two negative
ones that matter most: no placeholder social buttons, and no business name or
category on the signup form.

## What is not captured here, and why

The screenshots stop at the point of submission. Completing registration
against the local Firebase emulator from inside the Android emulator proved
too slow to automate reliably on this machine: the emulator runs on a software
GPU alongside Metro, the Firebase suite and two web dev servers, and Android
itself intermittently raises a "System UI isn't responding" dialog under that
load.

That is an environment limit, not an app defect. The account-creation path
itself is covered three other ways:

- `scripts/phase1-acceptance-tests.js`, 11 of 11 against the real backend
- `scripts/phase2-acceptance-tests.js`, 20 of 20
- `docs/phase1-evidence/`, the same journey completed end to end, including the
  dashboard afterwards

The native screenshots add what those could not show: that the interface, the
layout, the keyboard behaviour and the navigation are correct on a real device
rather than in a browser.

## iOS

The iOS Simulator build is produced by the same EAS profile and is documented
in `docs/native-builds.md`. Driving it needs macOS, so those captures come from
the client's Mac rather than from this Windows machine.
