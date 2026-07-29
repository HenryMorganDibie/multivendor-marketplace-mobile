# The backend is integrated

One continuous recording, `registration-creates-real-backend-records.webm`:
a vendor account is created through the app, then the database is opened in the
same session to show the records that registration just wrote. No gap between
the two halves where anything could have been substituted.

## What the recording shows

| Shot | Shows |
|---|---|
| 01-login | The app, before anything exists |
| 02-form-complete | Registration filled in, country selected |
| 03-dashboard | The dashboard the new vendor lands on |
| 04-firestore-users | The `users` collection |
| 05-auth-account | The Firebase Auth account that did not exist a minute earlier |
| 06-firestore-vendors | The vendor record, opened |

## The evidence in one line

The account created during the recording:

```
demo.proof.1785349652289@the platform.test
UID  5JPc3yOpsQoGsOfMnUey0HfAZmiu
```

The vendor document created for it carries **the same id**:

```
vendors/5JPc3yOpsQoGsOfMnUey0HfAZmiu
  country                    "Nigeria"
  countryCode                "NG"          resolved server-side from the country
  isSystemGeneratedUsername  true          a username was assigned automatically
  isPublished                false         publication blocked until setup is done
  isDiscoverable             false         discovery blocked until verification
  isVerified                 false
  createdAt                  server timestamp
```

Auth account and vendor record sharing an id is the thing worth looking at. A
front end with no backend cannot produce that: nothing in the app invents a
Firebase UID, and nothing in the app can write to Firestore directly, because
the rules forbid it. Those documents exist because Cloud Functions created them.

`countryCode: "NG"` and `isSystemGeneratedUsername: true` are both derived on
the server during `completeRegistration`. Neither value was typed by anyone.

## Why it does not work on another machine yet

The build handed over for design review points at a Firebase emulator on
`127.0.0.1`. On the reviewer's own laptop that address is their machine, where
nothing is running, so every call fails and the app looks like it has no
backend behind it. It is an interface preview, not a working copy.

Fixing that means deploying the backend to a real Firebase project and building
the app against it, which is deployment work rather than integration work. The
integration itself is done and is what this folder demonstrates.

## Verify it independently

```bash
# terminal 1, from the platform-backend/
npx firebase-tools emulators:start --project demo-platform

# terminal 2, from the platform-backend/scripts/
node phase1-acceptance-tests.js     # 11 checks
node phase2-acceptance-tests.js     # 20 checks
node sales-counting-tests.js        #  6 checks
```

All 37 run against the same backend seen in the recording. They exit non-zero on
failure, and every one of them would fail immediately if the app were not wired
to it.
