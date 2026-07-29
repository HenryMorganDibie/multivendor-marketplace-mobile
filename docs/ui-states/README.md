# UI states

The states the client asked to see, captured by driving the running app rather
than staged by hand.

Reproduce with `node capture-states.js` against a local dev server and the
Firebase emulator.

| Shot | State |
|---|---|
| 01 | Login, default |
| 02 | Login, field-level errors from an empty submit |
| 03 | Login, real backend rejection for an account that does not exist |
| 04 | Login, password revealed |
| 05 | Account type, nothing selected |
| 06 | Account type, selected, showing the check indicator |
| 07 | Vendor form, default |
| 08 | Vendor form, invalid, scrolled to the first failing field |
| 09 | Location, country only, no dead disabled fields below it |
| 10 | Country sheet, searchable |
| 11 | State revealed after country, area still hidden |
| 12 | Area revealed after state |
| 13 | Vendor form complete, button enabled |
| 14 | Submitting |
| 15 | Success, the new vendor's dashboard |

Shot 03 is a genuine backend error, not a simulated one: the request goes to
Cloud Functions and comes back rejected.

Shots 09, 11 and 12 are the progressive reveal in sequence. Each step appears
only once the one above it is answered, so a new user is never shown a field
they cannot use.

These are web captures at phone dimensions. Both native builds are linked in
`docs/native-builds.md`; the equivalent Android captures are in
`docs/native-evidence/android/`.
