# AIA MEDIA — CODEX MASTER TASK: UI/UX REFINEMENT + REAL COMPONENT INTEGRATION

> **Instructions to the existing Codex agent.** Work in the existing AIA Media repository. The owner's complete original component instructions and source code appear **verbatim in Appendix A**; do not omit or replace them. This is one integrated implementation task, not a request for a mockup.

## 0. Objective and decisions

Refine the **already deployed AIA Media ecosystem** using the owner's reference screenshots, with minimal custom code and maximal use of legitimate, reusable source components. Make the **Library and Collections card hover/selection UX excellent**, add **fast tag editing**, remove the **Championship filter from the UI**, add a **real storage usage meter**, and align the **Transfers page and public download receiver page** with the reference images. The product is a working photography/video DAM and file-transfer system, not a generic SaaS dashboard.

### Project and references

- Repository (inspect, do not assume subfolders): `C:\Users\Luke\AIA-Media`
- Main app: AIA Media; ResourceSpace is the permanent DAM backend.
- Transfer engine: Gokapi and existing integration/registry. AIA Transfer remains functionally independent under the hood.
- The **employee-facing Transfers section must live inside AIA Media navigation**, using the same shell/sidebar—not a jump to an entirely separate employee dashboard.
- **Public recipient/download share page remains standalone**, without a login; it shows authorized contents of the specific share only.
- Four reference images in the repository root (use their **real pixels** as visual references, not just filenames):
  1. `C:\Users\Luke\AIA-Media\AIA Media Transfers Dashboard light.png`
  2. `C:\Users\Luke\AIA-Media\AIA Media Transfers Dashboard dark.png`
  3. `C:\Users\Luke\AIA-Media\AIA Media File Transfer Receiver Interface.png`
  4. `C:\Users\Luke\AIA-Media\Algarve Circuit at Golden Hour.png` — **receiver-page background image**, not a component or page screenshot.

Inspect `STATUS.md`, existing planning/architecture files, the current git state, existing UI routes and backend interfaces before changing anything. If a file/path does not exist, report that accurately and work from the actual repository structure; do not invent data or credentials.

## 1. Safety: non-negotiable

1. Work on a fresh feature branch, with a safe rollback point; preserve existing uncommitted work. No destructive git commands.
2. **Do not alter or delete** ResourceSpace originals, asset metadata, Gokapi files, NAS volumes, certificates, databases, or unrelated infrastructure to make UI tests pass.
3. Reuse the existing authorized API adapters, sessions, permissions, transfer links, password/expiry behavior, file streams and storage. No backend rewrite or new public endpoints unless genuinely required; document and test any necessary change.
4. No fake production data, hardcoded NAS capacity, mock download counts, unsupported storage percentages, placeholder thumbnails, or new credential leaks. Sample data only in isolated story/demo/test fixtures.
5. Existing file-transfer download, expiry, revocation and permission tests must remain green. Preserve existing offline/backend independence semantics.
6. Do **not deploy over the current stable LAN frontend automatically**. Build and verify in a separate preview/staging deployment, capture screenshots, and await owner review for deployment. Do not claim UAT passed on behalf of the owner.
7. Use only licensed/reusable components. Confirm source and conditions; retain notices. Keep dependency footprint reasonable.
8. Follow existing typography, accessible interactions, authentication and authorization. Ensure light and dark modes both work.

## 2. Exact requested Library selection behavior

### Selection mode

- In normal mode, clicking an image opens its intended viewer/details as it does today; the checkbox selects it.
- **As soon as one asset checkbox is selected, the Library enters selection mode.** From that moment, clicking **anywhere on another image/card** toggles that asset selected/unselected, not the viewer. The user should not have to aim at tiny checkboxes repeatedly.
- Clicking a selected card deselects it; when the selected count returns to zero, restore normal mode and click-to-preview.
- Make the exit obvious: a **prominent “Done” / “Exit selection” button** and/or a large `×` beside the selected count in the contextual selection toolbar. Support `Escape` to exit selection mode, except when Escape must first dismiss an open modal/popover. Do not rely on a tiny “Clear selection” link at the far-right edge.
- Show a responsive floating or sticky selection toolbar with clear selected count and relevant actions (Edit tags, Share, Download, Add to collection, Clear/Done). The toolbar must not cover important media on small screens.
- Keep selected card styling strong and visible (border/overlay/check). Keyboard focus and selection (`Enter`, `Space` as appropriate) must work; make touch access possible without hover.
- Support Shift+click range selection where the existing loaded/ordered result set permits it, and “select visible” with honest scope labeling. Avoid selecting offscreen/unloaded records silently.
- Prevent nested action buttons, the hover `Tag` action, menus and the file viewer from inadvertently triggering the card selection handler; use proper event propagation and semantics.
- Selection should use stable asset IDs, survive benign sorting/view toggles as appropriate, and reset or reconcile predictably across filter/result changes. No unnecessary full-page reloads.
- Apply the analogous hover emphasis and selection interaction to **Collection cards**, where the collections UI actually supports selection. Preserve collection navigation in normal mode, and do not fabricate bulk collection actions absent from the backend.

### Visual hover behavior: Aceternity Focus Cards

The owner supplied a `FocusCards` demo verbatim in Appendix A. The actual freely accessible component is **Aceternity UI Focus Cards**:

- Official docs: https://ui.aceternity.com/components/focus-cards
- Documented install: `npx shadcn@latest add @aceternity/focus-cards`

Do not merely insert the demo with Unsplash images. Install/inspect **the actual** component, its license and behavior, then reuse or adapt the hover/focus animation within the existing real ResourceSpace asset card and real Collection card components. The original Focus Cards effect blurs other cards on hover; **do not significantly blur all the other thumbnails during routine DAM work**: that would make comparing images harder. Keep the hover cue subtle (e.g. small scale/shadow/overlay emphasis) and disabled/reduced during multiselection and reduced-motion mode. Ensure scrolling and large galleries remain efficient; do not introduce full-gallery animation rerenders. If the component is structurally incompatible with the existing masonry/virtualization infrastructure, reuse its applicable styling/animation techniques and clearly explain the decision, rather than breaking the gallery.

## 3. Hover quick action: Edit tags

Add a **recognizable Tag icon** to each Library card's existing hover action cluster, next to the other actions (preview/share/more). The icon must also be available on keyboard focus and touch via the overflow menu or accessible menu.

**Single asset behavior:**

1. Click Tag icon; open a small anchored **shadcn Popover** (or equivalent existing popover), with existing tags as removable chips.
2. Use searchable multi-select **Combobox/Command** for canonical/suggested existing tags, and allow creating tags only when the current user and ResourceSpace metadata field permit it. Casefold/normalize to avoid accidental duplicate options.
3. Offer Save and Cancel; loading and error states. Preserve unrelated metadata. On success refresh the affected asset record/cache and filter results without a full reload.
4. Close or reposition the popover properly when asset scrolls out of view; support keyboard, accessibility and narrow screens (a Drawer/Sheet fallback on mobile).

**Bulk tagging:**

- In selection mode show **Edit tags**. Open a right-hand **Sheet** with **Add tags** and **Remove tags** modes, explicitly stating the number of selected assets and the effect. Default to additive edits; never silently replace all tags on all assets.
- Resolve current tags and save operations per asset safely; support mixed-tag state, batch progress/errors, retries, and permission-aware actions. Do not claim atomic backend bulk updates unless actually supported. Report partial failures.
- Correctly use ResourceSpace metadata fields/nodes and existing integration. Inspect actual field configuration and node IDs first; API docs: https://www.resourcespace.com/knowledge-base/api/ and https://www.resourcespace.com/knowledge-base/api/update_field . Existing Title, Event, Year etc. must **not** be stuffed into an unstructured free-tag field. Preserve structured metadata.

## 4. Library filters

- Remove **Championship** from the visible filter bar and any corresponding user-facing filter menu or chip.
- Do **not** delete the championship metadata field, saved data or existing filters on the backend; this is a UI-only scope change unless the existing repository requirements explicitly state otherwise.
- Keep Event, Year and other verified relevant filters as already supported. Keep search and sorts working.

## 5. Real storage meter: provided 21st.dev Usage Meter

The owner supplied full `usage-meter.tsx` source, demo, dependencies and suggested CSS tokens in Appendix A. It is the **21st.dev Usage Meter** by `kuratlielia`:

- https://21st.dev/@kuratlielia/components/usage-meter
- Registry source: https://raw.githubusercontent.com/kuratlielia/arc-library/main/public/r/usage-meter.json

### Installation and missing files

1. Confirm existing Next.js/React, shadcn, Tailwind and TypeScript setup. Check `components.json` aliases and existing `components/ui` location. A repository with `src/components/ui` does not need a duplicate root-level `components/ui` if the configured alias resolves correctly; document and preserve the repository convention.
2. Integrate the supplied code **as an actual TypeScript file** `usage-meter.tsx`, separating the labelled `demo.tsx` into its own demo/test file. `usage-meter.tsx` and `demo.tsx` are filenames in Appendix A, **not executable TypeScript statements**.
3. Install/check `motion` and `lucide-react` dependencies consistent with repo package manager.
4. The supplied TSX imports additional files that are **not included** in Appendix A:
   - `@/components/ui/usage-meter-utils/motion-tokens`
   - `@/components/ui/usage-meter-utils/usage-meter.module.css`
   Get the matching original files via the upstream component registry/repository; do not fabricate tokens or claim compilation until resolved. Check matching package versions and licenses.
5. The supplied example CSS contains `@import "tailwindcss";`, `@import "tw-animate-css";`, root variables and resets. **Do not paste that wholesale over the existing AIA `globals.css`**, reimport Tailwind redundantly, change `--background` for the entire app, or set `--focus-ring: transparent` globally (accessibility regression). Add only needed scoped tokens or module styles and map them to AIA theme variables. Support light/dark modes.
6. Make it responsive and compact enough for the **sidebar above Settings**. If the detailed animated meter is too dense, render a condensed percentage pill/card in the sidebar that opens the complete UsageMeter in a Popover while preserving the upstream component's useful animations.
7. **Real source of truth**: Identify whether this is NAS filesystem/volume utilization, ResourceSpace media space or a storage quota. Clearly label what is measured. Do not mistake ResourceSpace media + Gokapi temporary storage for the entire NAS volume, or double-count deduplicated/shared files. Account for total/available via a secure, read-only, authorized server endpoint or existing metrics. Never expose host-level SSH/root access in the browser. If unavailable, display “Usage unavailable” and document a needed secure telemetry source. No made-up free space or total limit.
8. Segments may show categories only if the actual storage source provides a reliable breakdown; otherwise use one legitimate “Used” segment. Warnings can use realistic thresholds (e.g. 85%/90%) only after confirming the correct capacity denominator and owners' policy. Keep administrative capacity information permission-gated if necessary.
9. Motion should be subtle, honor `prefers-reduced-motion`, and not cause busy polling or performance impacts. Validate animated totals as data changes and after unmount.

## 6. Transfers in AIA Media — visually implement the provided references

The owner **approved the Transfers page designs** in the repository root. Build inside the existing **AIA Media shell** (same navigation/sidebar and routing), not a new employee-facing window/site.

- Inspect and visually compare both `AIA Media Transfers Dashboard light.png` and `AIA Media Transfers Dashboard dark.png`.
- Keep the design **minimal but artistic**: track/racing photography or tastefully subtle branded texture; strong readable title; compact drag/drop upload area with clear Select files; expiry and optional password; primary Create transfer; and prominent, well-designed **Recent transfers** with thumbnails or real icons, names, file counts/sizes, statuses, expiry and relevant actions.
- Do not add generic charts, storage usage statistics, notifications, arbitrary metrics, bloated introductory copy or unnecessary decorative cards.
- Use real transfer records from the existing registry/Gokapi, with no test records invented in the UI. A separate “View all” can reveal full history as a route/section or drawer without opening a different app.
- When sharing an existing DAM asset, continue to use the existing ResourceSpace-backed transfer route without copying originals to Gokapi. When uploading new temporary files, use Gokapi and **never automatically import them into the DAM**. Both types appear in the same user-facing transfer history if already supported.
- Ensure upload progress, retry/resume (where supported), valid expiry/password controls, copy link, revoke, and status transitions remain correct. Preserve the already tested security checks.
- Avoid claiming file-size limits unless actually configured and enforced.

## 7. Public receiver page and background artwork

Apply the reference `AIA Media File Transfer Receiver Interface.png` to the **public share-download page**, using `Algarve Circuit at Golden Hour.png` as its responsive background. Keep the current working download flow, file list, individual Download and Download All actions, file sizes, expiry, and password-required states.

Visual expectations:

- **No standalone logo floating outside/above the card.** Show the AIA identity only within the centered card in its header/artwork.
- Keep a single centered, lightly translucent/frosted card that is mostly opaque (readable on any background). Subtle blur/border/shadow and gentle background artwork; don't wash out filename text/buttons.
- Respect the image reference's overall spacing, geometry and artwork, but translate *only verified real product content* into functional React components. Use actual approved brand assets where possible; do not bake the entire page into one PNG.
- Background remains behind the card and fills the screen cleanly (`cover` or appropriate responsive treatment); preserve a practical mobile composition and contrast.
- Recipients need **no login**. Public links are strictly scoped to authorized shared resources; no exposure of Library, other transfers, API keys or NAS filesystem.
- Browser tests must include normal link, multi-file link, expired, revoked, password-protected, invalid link and mobile/slow-network states.

## 8. Phases and test gates

### Phase 0 — Audit

- Read `STATUS.md`, current frontend source, API routes, existing tests and existing deployment arrangement.
- Verify the four reference images exist and inspect them visually; inventory existing Library cards, Collections cards, selection state, tags/metadata, Transfers frontend, receiver page and storage telemetry.
- Run baseline build/lint/tests; record pre-change screenshots, network errors and page responsiveness.
- Branch and rollback plan. Produce a short audit note identifying actual blocked/missing components or backend capabilities.

### Phase 1 — Card/selection UX

- Integrate/adapt Focus Cards for Library and Collection hover.
- Implement the requested selection-mode card-click behavior, exit affordance, keyboard/touch semantics, selection toolbar and regression tests.
- Verify preview/click behavior before, during, and after selection and interaction with nested action buttons.

### Phase 2 — Tag quick action

- Inspect real ResourceSpace tag metadata fields and permissions; implement single-card popover and selected-assets bulk Sheet.
- Validate add/remove cases, duplicate prevention, preservation of unrelated fields, partial failures, search and permission behavior.
- Remove only the Championship UI filter.

### Phase 3 — Storage component

- Install and adapt the genuine 21st.dev usage-meter files/registry, including missing CSS and motion tokens; preserve globals and dark/light themes.
- Wire a real secure read-only storage source, or gracefully show unavailable. Test with actual metrics.

### Phase 4 — Integrated Transfers UI

- Align both dark and light layouts with the named reference images; preserve existing API flows and functionality.
- Make the primary Transfers page upload-and-history focused. No new standalone employee app.

### Phase 5 — Receiver UI

- Rebuild public receiver visual shell with centered translucent card and actual background art. Keep file downloads and access controls unchanged.

### Phase 6 — Verification, handoff, preview

- Run typecheck, lint, unit/integration/E2E/security regression tests; audit upstream attribution/licenses.
- Capture **desktop/tablet/mobile** screenshots of Library, Collection hover, selection states, tag popover, bulk tag Sheet, storage meter, Transfers light/dark, and public receiver normal/error/password states.
- Test with many media assets, not only four. Check hover performance and memory, reduced motion, accessibility, keyboard, screen reader basics and responsive layouts.
- Use a safe staging deployment. If browser automation cannot access the secure LAN URL, explain the blocker and present an exact manual screenshot/UAT checklist—do not call UAT complete.
- Produce one concise final report: files changed, imported sources/licenses, screenshots, tests with **actual results**, remaining gaps, preview URL/command, and the exact rollback procedure. Request sign-off before production deployment.

## 9. Acceptance criteria

- [ ] 4 named visual references inspected; visuals respect owner's selected designs.
- [ ] ResourceSpace and Gokapi originals, permissions, links, data and working backend preserved.
- [ ] Library selection: one checkbox activates mode; clicking anywhere on other cards toggles selection; obvious exit; keyboard/Escape; nested actions work.
- [ ] Collection card hover style consistent and navigation not broken.
- [ ] Real Aceternity Focus Cards source inspected and safely adapted; no excessive blur/slowdowns.
- [ ] Hover Edit tags icon opens accessible, searchable tag editor and saves real ResourceSpace metadata.
- [ ] Bulk tags add/remove existing tags without destructive replacement; partial failure handled.
- [ ] Championship removed from frontend filters only.
- [ ] Original provided Usage Meter code integrated with its actual missing supporting files; no destructive global CSS replacement.
- [ ] Storage data read from a real, correctly-labelled secure source, or displays an honest unavailable state.
- [ ] Transfers uses the AIA Media shell and looks like the approved light/dark designs; real recent history and working upload/share options.
- [ ] Public receiver uses only the in-card AIA brand and specified background; semi-transparent legible card; downloads still work; no login required.
- [ ] Tests passed with evidence, visual UAT ready, rollback available; no automatic production replacement.

## 10. Execute

Start by auditing source and assets, then implement **all phases in order** with short phase-end summaries in the repository status. Prefer genuine reusable components. Do not spend effort rewriting working infrastructure. If upstream components are unavailable/incompatible, explain exactly why and choose the smallest safe adaptation. Finish with working code in a reviewable branch, test evidence and a visual preview ready for owner approval.

---

# Appendix A — OWNER-PROVIDED INSTRUCTIONS AND CODE (VERBATIM)

This appendix reproduces the owner's supplied content **exactly**, including demonstration assets, filename labels and stylesheet suggestions. The rules above explain how to implement this source safely in the existing production codebase. Do not delete, truncate, or silently rewrite the supplied TSX; separate filename labels/demo files correctly, and obtain referenced missing upstream dependencies.

Make sure that once already have clicked on multiple bulk selection box on one, I can click anywhere on the image or asset and it will automatically select it, no need to click the box.
Then make it easy and clear to leave the selection rather than small clear selection button to the right.


use the following for when hovering over the image cards in library:

import { FocusCards } from "@/components/ui/focus-cards";

export function FocusCardsDemo() {
  const cards = [
    {
      title: "Forest Adventure",
      src: "https://images.unsplash.com/photo-1518710843675-2540dd79065c?q=80&w=3387&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      title: "Valley of life",
      src: "https://images.unsplash.com/photo-1600271772470-bd22a42787b3?q=80&w=3072&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      title: "Sala behta hi jayega",
      src: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?q=80&w=3070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      title: "Camping is for pros",
      src: "https://images.unsplash.com/photo-1486915309851-b0cc1f8a0084?q=80&w=3387&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      title: "The road not taken",
      src: "https://images.unsplash.com/photo-1507041957456-9c397ce39c97?q=80&w=3456&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      title: "The First Rule",
      src: "https://assets.aceternity.com/the-first-rule.png",
    },
  ];

  return <FocusCards cards={cards} />;
}


Same with collection cards.

Remove Championship filter.

I also need an easy friendly way to edit tags option to appear like the other options maybe as an icon, when hovering over the image.




You are given a task to integrate an existing React component in the codebase

The codebase should support:
- shadcn project structure<br>
- Tailwind CSS
- Typescript

If it doesn't, provide instructions on how to setup project via shadcn CLI, install Tailwind or Typescript.

Determine the default path for components and styles.
If default path for components is not /components/ui, provide instructions on why it's important to create this folder
Copy-paste this component to /components/ui folder:
```tsx
usage-meter.tsx
"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  AnimatePresence,
  animate,
  cancelFrame,
  frame,
  motion,
  motionValue,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
  type Variants,
} from "motion/react";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { motionTokens } from "@/components/ui/usage-meter-utils/motion-tokens";
import styles from "@/components/ui/usage-meter-utils/usage-meter.module.css";

export interface UsageMeterSegment {
  /** Stable identity. Keep it the same while the value changes, so the segment re-flows instead of being replaced. */
  id: string;
  label: string;
  value: number;
}

/** Use a usage meter for a fixed allowance, such as storage or seats, when people need to see what takes the space and how close they are to the limit. */
export interface UsageMeterProps {
  /** What is measured, such as "Workspace storage". */
  label: string;
  /** Used amounts in display order. Up to four read clearly. */
  segments: UsageMeterSegment[];
  /** The plan limit, in the same unit as the segments. */
  limit: number;
  unit?: string;
  /** Digits after the decimal point. */
  decimals?: number;
  freeLabel?: string;
  overLabel?: string;
  /** Share of the limit at which the meter warns that it is almost full. */
  warnAt?: number;
}

const { spring, duration, ease, blur } = motionTokens;
/** Motion drops inherited velocity on time-defined springs, so values that retarget mid-flight run the same springs written as stiffness and damping. */
const physical = (
  { visualDuration, bounce }: { visualDuration: number; bounce: number },
  restDelta = 0.001,
) => {
  const root = (2 * Math.PI) / (visualDuration * 1.2);
  return {
    type: "spring" as const,
    stiffness: root * root,
    damping: 2 * (1 - bounce) * root,
    restDelta,
    restSpeed: restDelta * 2,
  };
};
const settle = physical(spring.smooth);
const reveal = physical({
  visualDuration: duration.considered + 0.1,
  bounce: 0,
});
const turn = physical(spring.smooth);
const fit = physical(spring.morph, 0.01);
/** A segment stops two pixels short of the next, so neighbours read apart without an outline. */
const GAP = 2;
const subscribeNothing = () => () => {};
/** Reduced motion is only known in the browser, so the first client render matches the server before it takes effect. */
function useReducedMotionSafe() {
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  return { reduced: !!useReducedMotion() && hydrated, hydrated };
}
/** Starts animations on the next frame, so the render that caused them never swallows a spring's first frames. Returns a cleanup. */
function soon(start: () => { stop: () => void }) {
  let controls: { stop: () => void } | null = null;
  const run = () => {
    controls = start();
  };
  frame.update(run);
  return () => {
    cancelFrame(run);
    controls?.stop();
  };
}

/** Changed text rises from a soft blur and leaves a little faster than it arrives. Icons cross through a small scale instead. */
const rise: Variants = {
  hidden: (direction: number) => ({
    opacity: 0,
    y: `${0.3 * direction}em`,
    scale: 1,
    filter: `blur(${blur.soft}px)`,
  }),
  shown: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.22, ease: [...ease.enter] },
  },
  gone: (direction: number) => ({
    opacity: 0,
    y: `${-0.3 * direction}em`,
    scale: 1,
    filter: `blur(${blur.subtle}px)`,
    transition: { duration: 0.14, ease: [...ease.standard] },
  }),
};
const pop: Variants = {
  hidden: {
    opacity: 0,
    y: 0,
    scale: 0.6,
    filter: `blur(${blur.subtle + 1}px)`,
  },
  shown: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      ...spring.snappy,
      opacity: { duration: duration.fast, ease: [...ease.enter] },
      filter: { duration: duration.fast, ease: [...ease.enter] },
    },
  },
  gone: {
    opacity: 0,
    y: 0,
    scale: 0.6,
    filter: `blur(${blur.subtle + 1}px)`,
    transition: { duration: duration.instant, ease: [...ease.standard] },
  },
};
const fade: Variants = {
  hidden: { opacity: 0, y: 0, scale: 1, filter: "blur(0px)" },
  shown: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.15 },
  },
  gone: {
    opacity: 0,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.1 },
  },
};

function Swap({
  text,
  reduced,
  direction = 1,
}: {
  text: string;
  reduced: boolean;
  direction?: number;
}) {
  return (
    <span className={styles.swap}>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.span
          key={text}
          className={styles.swapText}
          custom={direction}
          variants={reduced ? fade : rise}
          initial="hidden"
          animate="shown"
          exit="gone"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

type Part = { key: string; digit: number } | { key: string; text: string };
const formats = new Map<number, Intl.NumberFormat>();
/** Split a number into columns keyed by place value, so 9.8 → 10.4 keeps the ones column the ones column and a new tens column slides in. */
function partsFor(value: number, decimals: number): Part[] {
  let format = formats.get(decimals);
  if (!format) {
    format = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    formats.set(decimals, format);
  }
  const parts = format.formatToParts(value);
  let place = parts.reduce(
      (count, part) =>
        count + (part.type === "integer" ? part.value.length : 0),
      0,
    ),
    fraction = 0;
  return parts.flatMap((part, index): Part[] => {
    if (part.type === "integer")
      return [...part.value].map((char) => ({
        key: `i${--place}`,
        digit: Number(char),
      }));
    if (part.type === "fraction")
      return [...part.value].map((char) => ({
        key: `f${fraction++}`,
        digit: Number(char),
      }));
    return [
      {
        key:
          part.type === "group"
            ? `g${place}`
            : part.type === "decimal"
              ? "d"
              : `${part.type}${index}`,
        text: part.value,
      },
    ];
  });
}
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** One digit on a wheel; its distance from the wheel position sets where it sits and how clearly it shows. */
function Glyph({
  position,
  digit,
}: {
  position: MotionValue<number>;
  digit: number;
}) {
  const offset = useTransform(
    position,
    (current) => ((((digit - current) % 10) + 15) % 10) - 5,
  );
  const y = useTransform(offset, (current) => `${current}em`);
  const opacity = useTransform(offset, (current) =>
    Math.max(0, 1 - Math.abs(current)),
  );
  const filter = useTransform(offset, (current) =>
    Math.abs(current) < 0.02 || Math.abs(current) >= 1
      ? "none"
      : `blur(${(Math.abs(current) * blur.subtle).toFixed(2)}px)`,
  );
  return (
    <motion.span className={styles.glyph} style={{ y, opacity, filter }}>
      {digit}
    </motion.span>
  );
}

const column = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

/** A digit wheel that always turns the way the whole number moved, wrapping 9 → 0 like an odometer. */
function Column({
  digit,
  direction,
  reduced,
}: {
  digit: number;
  direction: number;
  reduced: boolean;
}) {
  const position = useMotionValue(digit);
  const wheel = useRef({ digit, target: digit });
  const running = useRef<(() => void) | null>(null);
  useEffect(() => () => running.current?.(), []);
  useEffect(() => {
    const state = wheel.current;
    if (state.digit === digit) return;
    state.target +=
      direction < 0
        ? -((state.digit - digit + 10) % 10)
        : (digit - state.digit + 10) % 10;
    state.digit = digit;
    running.current?.();
    if (reduced) {
      position.jump(state.target);
      running.current = null;
      return;
    }
    const target = state.target;
    running.current = soon(() => animate(position, target, turn));
  }, [digit, direction, position, reduced]);
  return (
    <motion.span
      className={styles.column}
      {...column}
      transition={reduced ? { duration: 0 } : fit}
    >
      <span className={styles.sizer}>0</span>
      {DIGITS.map((item) => (
        <Glyph key={item} position={position} digit={item} />
      ))}
    </motion.span>
  );
}

/** A number that rolls to each new value. It is decoration over text that screen readers get elsewhere. */
function Ticker({
  value,
  decimals,
  reduced,
}: {
  value: number;
  decimals: number;
  reduced: boolean;
}) {
  const [trend, setTrend] = useState({ value, direction: 1 });
  if (trend.value !== value)
    setTrend({ value, direction: value > trend.value ? 1 : -1 });
  return (
    <span className={styles.ticker} aria-hidden="true">
      <AnimatePresence initial={false}>
        {partsFor(value, decimals).map((part) =>
          "digit" in part ? (
            <Column
              key={part.key}
              digit={part.digit}
              direction={trend.direction}
              reduced={reduced}
            />
          ) : (
            <motion.span
              key={part.key}
              className={styles.symbol}
              {...column}
              transition={reduced ? { duration: 0 } : fit}
            >
              {part.text}
            </motion.span>
          ),
        )}
      </AnimatePresence>
    </span>
  );
}

type Status = "ok" | "near" | "over";

/** The plan status as a compact mark. Its width springs to each new message and the warning icon grows in beside the words. */
function StatusBadge({
  status,
  text,
  reduced,
}: {
  status: Status;
  text: string;
  reduced: boolean;
}) {
  const inner = useRef<HTMLSpanElement>(null);
  const width = useMotionValue<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let measured = false;
    const observer = new ResizeObserver(() => {
      const next = node.offsetWidth;
      if (measured && !reduced) animate(width, next, fit);
      else width.jump(next);
      measured = next > 0;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced, width]);
  const Icon = status === "over" ? TriangleAlert : CircleAlert;
  return (
    <motion.span
      className={styles.badge}
      data-status={status}
      style={{ width }}
    >
      <span ref={inner} className={styles.badgeInner}>
        <AnimatePresence mode="popLayout" initial={false}>
          {status !== "ok" && (
            <motion.span
              key={status}
              className={styles.badgeIcon}
              variants={reduced ? fade : pop}
              initial="hidden"
              animate="shown"
              exit="gone"
            >
              <Icon size={14} strokeWidth={2} aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
        <Swap text={text} reduced={reduced} />
      </span>
    </motion.span>
  );
}

function Segment({
  index,
  amounts,
  span,
  width,
  highlight,
}: {
  index: number;
  amounts: MotionValue<number>[];
  span: MotionValue<number>;
  width: MotionValue<number>;
  highlight: "on" | "off" | undefined;
}) {
  // Each segment starts where the ones before it end, so growth in any of them pushes the rest along in the same frame.
  const x = useTransform(() => {
    let start = 0;
    for (let at = 0; at < index; at++) start += amounts[at].get();
    return (start / span.get()) * width.get();
  });
  const scaleX = useTransform(() => {
    const w = width.get();
    if (!w) return 0;
    const size = (amounts[index].get() / span.get()) * w,
      rest = w - x.get() - size;
    return Math.max(0, size - Math.min(GAP, size, Math.max(0, rest))) / w;
  });
  return (
    <motion.span
      className={styles.segment}
      data-index={index}
      data-highlight={highlight}
      style={{ x, scaleX, originX: 0 }}
    />
  );
}

export function UsageMeter({
  label,
  segments,
  limit,
  unit = "",
  decimals = 1,
  freeLabel = "Free",
  overLabel = "Over limit",
  warnAt = 0.9,
}: UsageMeterProps) {
  const { reduced, hydrated } = useReducedMotionSafe();
  const root = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { once: true, amount: 0.4 });
  const titleId = useId();
  const hatchId = `hatch${titleId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ready = hydrated && (inView || reduced);
  const round = (value: number) =>
    Math.round(value * 10 ** decimals) / 10 ** decimals;
  const total = round(
    segments.reduce((sum, segment) => sum + segment.value, 0),
  );
  const free = round(Math.max(0, limit - total)),
    over = round(Math.max(0, total - limit));
  const status: Status =
    total > limit ? "over" : total >= limit * warnAt ? "near" : "ok";
  const format = (value: number) =>
    `${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
  const limitText = format(limit).replace(/\.0+(?= |$)/, "");

  // One motion value per segment id, kept across renders so a changed value springs from where it is.
  const [store] = useState(() => new Map<string, MotionValue<number>>());
  const amounts = segments.map((segment) => {
    let value = store.get(segment.id);
    if (!value) {
      value = motionValue(0);
      store.set(segment.id, value);
    }
    return value;
  });
  const shownLimit = useMotionValue(limit);
  const width = useMotionValue(0);
  const used = useTransform(() =>
    amounts.reduce((sum, amount) => sum + amount.get(), 0),
  );
  // The bar spans the limit, or everything used once that is more; both follow their springs, so crossing the limit is continuous.
  const span = useTransform(() => Math.max(shownLimit.get(), used.get(), 1e-6));
  const limitX = useTransform(() =>
    Math.round((shownLimit.get() / span.get()) * width.get()),
  );
  // The limit marker and the hatch fade on their own short tween whenever usage crosses the limit, so a limit that jumps past usage never blinks them out in one frame.
  const markerOpacity = useMotionValue(0);
  useEffect(() => {
    let over = used.get() > shownLimit.get();
    markerOpacity.jump(over ? 1 : 0);
    let fading: AnimationPlaybackControls | undefined;
    const check = () => {
      const next = used.get() > shownLimit.get();
      if (next === over) return;
      over = next;
      fading?.stop();
      if (reduced) markerOpacity.jump(next ? 1 : 0);
      else
        fading = animate(markerOpacity, next ? 1 : 0, {
          duration: duration.fast,
          ease: [...ease.standard],
        });
    };
    const stops = [used.on("change", check), shownLimit.on("change", check)];
    return () => {
      stops.forEach((stop) => stop());
      fading?.stop();
    };
  }, [markerOpacity, reduced, shownLimit, used]);
  const overClip = useTransform(() => `inset(0 0 0 ${limitX.get() + GAP}px)`);

  useLayoutEffect(() => {
    const node = trackRef.current;
    if (!node) return;
    width.set(node.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => width.set(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, [width]);

  // Segments grow into place once seen, left to right; later changes re-flow every segment on one spring each.
  const values = segments
    .map((segment) => `${segment.id}:${segment.value}`)
    .join("|");
  const revealed = useRef(false);
  useEffect(() => {
    if (!ready) return;
    const first = !revealed.current;
    revealed.current = true;
    const stops = segments.map((segment, index) => {
      const amount = store.get(segment.id);
      if (!amount || amount.get() === segment.value) return null;
      if (reduced) {
        amount.jump(segment.value);
        return null;
      }
      return soon(() =>
        animate(
          amount,
          segment.value,
          first ? { ...reveal, delay: index * 0.07 } : settle,
        ),
      );
    });
    return () => stops.forEach((stop) => stop?.());
    // `values` carries every segment id and value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, ready, reduced, store]);
  useEffect(() => {
    if (shownLimit.get() === limit) return;
    if (reduced) {
      shownLimit.jump(limit);
      return;
    }
    return soon(() => animate(shownLimit, limit, settle));
  }, [limit, reduced, shownLimit]);

  // Hover previews a category, focus previews it too, and a press pins it until pressed again or Escape.
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [roving, setRoving] = useState(0);
  const items = [
    ...segments.map((segment) => ({
      id: segment.id,
      label: segment.label,
      value: segment.value,
    })),
    {
      id: "free",
      label: status === "over" ? overLabel : freeLabel,
      value: status === "over" ? over : free,
    },
  ];
  const active = hovered ?? focused ?? pinned;
  const activeItem = items.find((item) => item.id === active) ?? null;
  const legend = useRef<HTMLDivElement>(null);

  const idAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect?.width) return null;
    const at = ((clientX - rect.left) / rect.width) * Math.max(limit, total);
    // Past the limit the hatch stands for the overage, so pointing there highlights it rather than the category beneath.
    if (at > limit) return "free";
    let end = 0;
    for (const segment of segments) {
      end += segment.value;
      if (at <= end) return segment.id;
    }
    return "free";
  };
  const onTrackMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") setHovered(idAt(event.clientX));
  };
  const onTrackTap = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") {
      const id = idAt(event.clientX);
      setPinned((current) => (current === id ? null : id));
    }
  };
  const onLegendKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (pinned || focused) {
        event.preventDefault();
        setPinned(null);
      }
      return;
    }
    const next = (
      {
        ArrowRight: roving + 1,
        ArrowDown: roving + 1,
        ArrowLeft: roving - 1,
        ArrowUp: roving - 1,
        Home: 0,
        End: items.length - 1,
      } as Record<string, number>
    )[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const index = (next + items.length) % items.length;
    setRoving(index);
    legend.current
      ?.querySelectorAll<HTMLButtonElement>("button")
      [index]?.focus();
  };

  const headline = ready ? (activeItem ? activeItem.value : total) : 0;
  const share = activeItem ? Math.round((activeItem.value / limit) * 100) : 0;
  const caption = !activeItem
    ? `${unit} of ${limitText} used`
    : activeItem.id === "free"
      ? `${unit} ${status === "over" ? "over the limit" : "free"}`
      : `${unit} in ${activeItem.label} · ${share}% of plan`;
  const badge =
    status === "over"
      ? `${format(over)} over`
      : status === "near"
        ? "Almost full"
        : `${format(free)} free`;
  const summary = `${label}: ${format(total)} of ${limitText} used. ${segments.map((segment) => `${segment.label} ${format(segment.value)}`).join(", ")}. ${status === "over" ? `Over the limit by ${format(over)}.` : `${format(free)} free${status === "near" ? ", almost full" : ""}.`}`;
  // Status changes are announced, and so is a growing overage; routine changes inside a status stay quiet.
  const notice = status === "over" ? `over:${over}` : status;
  const [announced, setAnnounced] = useState({ notice, message: "" });
  if (announced.notice !== notice)
    setAnnounced({
      notice,
      message:
        status === "over"
          ? `Over the plan limit by ${format(over)}.`
          : status === "near"
            ? `Almost full. ${format(free)} free.`
            : `Under the limit. ${format(free)} free.`,
    });

  return (
    <div
      ref={root}
      className={styles.meter}
      role="group"
      aria-labelledby={titleId}
      data-status={status}
    >
      <div className={styles.top}>
        <span id={titleId} className={styles.title}>
          {label}
        </span>
        <StatusBadge status={status} text={badge} reduced={reduced} />
      </div>
      <p className={styles.total}>
        <span className={styles.srOnly}>
          {format(total)} of {limitText} used
        </span>
        <span className={styles.amount} aria-hidden="true">
          <Ticker value={headline} decimals={decimals} reduced={reduced} />
        </span>
        <span className={styles.caption} aria-hidden="true">
          <Swap text={caption} reduced={reduced} />
        </span>
      </p>
      <div className={styles.bar}>
        <div
          ref={trackRef}
          className={styles.track}
          role="img"
          aria-label={summary}
          data-active={active ?? undefined}
          onPointerMove={onTrackMove}
          onPointerLeave={() => setHovered(null)}
          onPointerUp={onTrackTap}
        >
          {segments.map((segment, index) => (
            <Segment
              key={segment.id}
              index={index}
              amounts={amounts}
              span={span}
              width={width}
              highlight={
                active ? (active === segment.id ? "on" : "off") : undefined
              }
            />
          ))}
          {/* Past the limit the bar is struck through: the overflow keeps its colours, hatched so it reads as over without colour. */}
          <motion.svg
            className={styles.overflow}
            data-highlight={
              active ? (active === "free" ? "on" : "off") : undefined
            }
            style={{ clipPath: overClip, opacity: markerOpacity }}
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <pattern
                id={hatchId}
                width={6}
                height={6}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width={2.5} height={6} className={styles.hatch} />
              </pattern>
            </defs>
            <rect className={styles.overTint} width="100%" height="100%" />
            <rect width="100%" height="100%" fill={`url(#${hatchId})`} />
          </motion.svg>
        </div>
        <motion.span
          className={styles.limit}
          style={{ x: limitX, opacity: markerOpacity }}
          aria-hidden="true"
        />
      </div>
      <div
        ref={legend}
        className={styles.legend}
        role="group"
        aria-label={`${label} by category`}
        onKeyDown={onLegendKey}
      >
        {items.map((item, index) => {
          const warning = item.id === "free" && status === "over";
          return (
            <button
              key={item.id}
              type="button"
              className={styles.item}
              data-highlight={
                active ? (active === item.id ? "on" : "off") : undefined
              }
              aria-pressed={pinned === item.id}
              aria-label={`${item.label}, ${format(item.value)}`}
              tabIndex={index === roving ? 0 : -1}
              onClick={() => {
                setRoving(index);
                setPinned((current) => (current === item.id ? null : item.id));
              }}
              onFocus={() => {
                setRoving(index);
                setFocused(item.id);
              }}
              onBlur={() => setFocused(null)}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setHovered(item.id);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") setHovered(null);
              }}
            >
              <span className={styles.itemHead}>
                <span className={styles.key} aria-hidden="true">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {warning ? (
                      <motion.span
                        key="alert"
                        className={styles.keyIcon}
                        variants={reduced ? fade : pop}
                        initial="hidden"
                        animate="shown"
                        exit="gone"
                      >
                        <TriangleAlert size={12} strokeWidth={2} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="swatch"
                        className={styles.swatch}
                        data-index={item.id === "free" ? "free" : index}
                        variants={reduced ? fade : pop}
                        initial="hidden"
                        animate="shown"
                        exit="gone"
                      />
                    )}
                  </AnimatePresence>
                </span>
                <span className={styles.itemLabel}>
                  <Swap text={item.label} reduced={reduced} />
                </span>
              </span>
              <span className={styles.itemValue}>
                <Ticker
                  value={item.value}
                  decimals={decimals}
                  reduced={reduced}
                />
                {unit && <span className={styles.itemUnit}>{unit}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announced.message}
      </p>
    </div>
  );
}

export default UsageMeter;


demo.tsx
"use client";

import UsageMeter from "@/components/ui/usage-meter";

export default function UsageMeterDemo() {
  return (
    <div className="w-full max-w-md p-6">
      <UsageMeter
        label="Workspace storage"
        limit={100}
        unit="GB"
        segments={[
          { id: "documents", label: "Documents", value: 38 },
          { id: "media", label: "Media", value: 22 },
          { id: "backups", label: "Backups", value: 14 },
        ]}
      />
    </div>
  );
}

```

Install NPM dependencies:
```bash
motion, lucide-react
```

Extend existing Tailwind 4 index.css with this code (or if project uses Tailwind 3, extend tailwind.config.js or globals.css):
```css
@import "tailwindcss";
@import "tw-animate-css";

:root {
  --background: var(--neutral-0);
  --foreground: var(--neutral-11);
  --accent: oklch(33% 0 0);
  --neutral-0: oklch(100% 0 0);
  --neutral-2: oklch(97.8% 0 0);
  --neutral-7: oklch(59% 0 0);
  --neutral-8: oklch(46% 0 0);
  --neutral-11: oklch(15% 0 0);
  --surface: var(--neutral-0);
  --surface-muted: var(--neutral-2);
  --text-secondary: var(--neutral-8);
  --text-muted: var(--neutral-7);
  --border-strong: oklch(82% 0 0);
  --focus-ring: transparent;
  --warning: oklch(58% .18 75);
  --danger: oklch(54% .21 25);
  --space-1: .25rem;
  --space-2: .5rem;
  --space-3: .75rem;
  --space-4: 1rem;
  --radius-control: 1.125rem;
  --radius-pill: 9999px;
  --font-display: var(--font-geist, "Geist Variable"), sans-serif;
  --text-xs: .75rem;
  --text-sm: .875rem;
  --text-base: 1rem;
  --text-3xl: 2.25rem;
  --tracking-display: -.03em;
  --tracking-body: -.01em;
  --leading-display: 1.1;
  --leading-body: 1.4;
  --ease-standard: cubic-bezier(.22,1,.36,1);
  --duration-fast: 160ms;
  --duration-standard: 240ms;
}

```



these are the paths to the references

"C:\Users\Luke\AIA-Media\AIA Media Transfers Dashboard light.png"

"C:\Users\Luke\AIA-Media\Algarve Circuit at Golden Hour.png" - background of the receiver.

"C:\Users\Luke\AIA-Media\AIA Media File Transfer Receiver Interface.png"

"C:\Users\Luke\AIA-Media\AIA Media Transfers Dashboard dark.png"


Please take all this info and put it in one single prompt for codex.


---

# Appendix B — Actual upstream sources to inspect

1. [Aceternity UI Focus Cards](https://ui.aceternity.com/components/focus-cards) — use the actual published `focus-cards` component (or verified compatible implementation) rather than the demonstration URLs.
2. [21st.dev Usage Meter](https://21st.dev/@kuratlielia/components/usage-meter) — component and source registry; retrieve missing CSS and `motion-tokens` modules from the same upstream version.
3. [ResourceSpace API reference](https://www.resourcespace.com/knowledge-base/api/) and [update_field](https://www.resourcespace.com/knowledge-base/api/update_field) — authenticated metadata updates and node option IDs.

**When the appendix conflicts with the application's existing security or architecture, treat the appendix's *visual goal* and source code as the owner's component reference, but preserve actual production data, access checks and working infrastructure.**
