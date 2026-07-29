# Phase 1 evidence

Captured by driving the real app against the real backend. Every screenshot
comes from an account created during the run, not from seeded data.

| # | Shows |
|---|---|
| 01 | Login screen |
| 02 | Choose account type |
| 03 | Vendor registration, the seven agreed fields only |
| 04 | Registration filled in |
| 05 | Password visibility toggle |
| 06 | Country picker |
| 07 | Country selected, no state or area asked for at signup |
| 08 | Legal consent above the button, three documents separately tappable |
| 09 | Dashboard immediately after registration |
| 10 | Storefront setup checklist |
| 11 | Checklist continued |

## Why this set replaced the previous one

Two things changed after the first capture.

**The password field was restyled.** It had its own background colour, border
width and font size, so it did not match the fields directly above it on the
same form. Shot 05 shows the corrected field with its visibility toggle.

**Legal documents now open on the website.** The previous set had a shot of an
in-app legal screen, reached by tapping "Terms of Use" on the registration form.
That screen is no longer part of this flow, so the screenshot has been removed
rather than left in place showing a journey that no longer happens.

The links were verified individually against the running app:

| Link | Opens |
|---|---|
| Terms of Use | `https://the platform.com/terms-of-service` |
| Privacy Policy | `https://the platform.com/privacy-policy` |
| Vendor Agreement | `https://the platform.com/vendor-terms` |

Those routes exist and render in the the platform-website repo. They currently show
"Content pending publication" because the legal copy has not been published
through the CMS yet, so there is deliberately no screenshot of the destination:
it would show a page waiting on content rather than anything about this phase.
