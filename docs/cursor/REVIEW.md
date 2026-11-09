# Smooth follower cursor

Prepared 9 November 2026 on `feat/smooth-follower-cursor`, based on `feat/infinite-gallery-persistent-accounts` and the earlier `frontend/unified-ui-review` snapshot.

The owner-supplied dot and expanding-ring follower is mounted once in each application's root layout. It covers the Media and Transfer workspaces, login, invitation signup, settings/dialog portals and public receiver routes. The native pointer and text caret remain available, matching the supplied decorative component's behavior.

The dot is 8 pixels; the ring is 28 pixels and expands to 44 over interactive elements. Position smoothing retains the two supplied speeds with elapsed-time compensation. White difference blending keeps the marks contrasting over light/dark surfaces and photos. Neither mark intercepts clicks or participates in the accessibility tree.

Adaptations avoid the sample's per-frame React state updates and its incomplete animation cancellation. Ref-driven transforms update only the two spans. Animation settles and stops when idle. Mouse-only activation respects fine-pointer/hover capability and reduced-motion preferences; touch/pen input, Tab navigation, window exit/blur and hidden tabs hide or suspend it. The current scheduled frame and all listeners are cleaned up. Delegated pointer targeting supports newly loaded thumbnails, controls and dialogs without attaching a listener to each element.

## Verification

Both optimized builds, typechecking, formatting, dependency audit, secret scan, **48 API/model tests and 37 browser workflows pass**, with no failed or flaky browser checks. The [receipt](evidence/verification.json) records checks against optimized local builds. New browser coverage verifies movement, dimensions, interactive expansion on a dynamically created button, click-through behavior, stacking above settings, idle transforms, keyboard/blur handling, both login pages, signup, the recipient download button, live preference changes and touch fallback. Existing authentication, durable account storage, infinite scrolling, upload and download tests remain in the suite.

Screenshot evidence is retained locally under this folder's ignored `evidence/*.png` paths. No private photos or identity records are published. No dependency, authentication, database, native media, NAS configuration or production deployment change is part of this cursor feature.

## Git integration and rollback

The two preceding application branches are ancestors of this feature branch. Push the feature branches, integrate them into `main` with explicit merge commits, and verify the remote branch tips. No production deployment workflow is configured. GitHub verification results are separate from local results and should be checked on the repository's Actions page.

To remove just the follower, revert its component, the two root-layout mounts and its CSS. It owns no saved data. Keep the persistent identity directory and all earlier account/media features intact. Merging or checking out branches must never reset that directory.
