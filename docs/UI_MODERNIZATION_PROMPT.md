# UOL Alumni Portal — UI/UX Modernization Prompt

> Copy everything below the line into a new agent session. It is self-contained.
> Scope: visual/UX modernization only. No business logic, API, or database changes.

---

## Role

You are a senior product designer + frontend engineer modernizing the **University of Lahore Alumni Portal** (Next.js App Router, TypeScript, Tailwind CSS v4, React Hook Form + Zod, TanStack Query, lucide-react, `motion`, `tailwind-merge`). The portal currently feels dated and visually inconsistent: it was assembled from an admin-dashboard template (TailAdmin-style tokens) plus many hand-styled forms, each with its own spacing, colours, and input styles. Your job is to make it feel **professional, premium, calm, and consistent** — institutional-grade, not flashy.

Think: Stripe Dashboard / Linear / Vercel settings pages / modern university portals (Harvard Alumni, Oxford Alumni). Restraint over decoration.

## Hard constraints

1. **Do not change behavior.** No changes to validation rules, API payloads, SQL, auth, routing, or data flow. Markup may be restructured only if form field `name`s, `register()` bindings, `aria-*`, `id`/`htmlFor` pairs, and test-relevant attributes are preserved.
2. **Accessibility is non-negotiable.** Keep/improve: label associations, focus rings (visible, 2px, brand colour), colour contrast ≥ 4.5:1 for text, `aria-invalid` + `aria-describedby` on errored inputs, keyboard reachability, reduced-motion respect (`motion-reduce:`).
3. **Dark mode must remain fully supported** (`.dark` class variant). Every new token needs a dark counterpart.
4. **Mobile first.** Alumni primarily use phones. Forms must be comfortable at 375px. Native date/time pickers must remain openable (do NOT hide `::-webkit-calendar-picker-indicator` globally).
5. **No new UI libraries.** Use what exists: Tailwind v4, lucide-react, `motion`, `tailwind-merge`, `react-hot-toast`. Build primitives, don't install shadcn/MUI/etc.
6. **PDF generators (`src/lib/pdfGenerator.ts`) are out of scope.**
7. Work incrementally — one surface at a time, typecheck (`npx tsc --noEmit`) after each, and keep every commit shippable.

## Current state (what you'll find)

- **Design tokens** live in `src/app/globals.css` under `@theme`: a `brand` blue scale (`#465fff` — generic template blue), a UOL deep-green `accent` scale (`#183d32`), Untitled-UI-style grays, success/error/warning/orange scales. Fonts: `Outfit` (variable, self-hosted) and `Roboto`, loaded via `src/lib/fonts.ts`. Only `--font-outfit` is registered in the theme.
- **Primitives** in `src/components/ui/`: `button/Button.tsx` (2 variants, 2 sizes, no loading state, no `ref`), `badge`, `alert`, `avatar`, `card.tsx`, `modal`, `table`, `tooltip`, `dropdown`, `PageBanner.tsx` (a hard-coded `from-green-700 to-green-400` gradient banner — this is the single biggest "dated" signal and appears on most alumni pages).
- **Layout shells**: `src/layout/AppHeader.tsx`, `AppSidebar.tsx`, `UnifiedHeader.tsx`, `Backdrop.tsx`; admin routes under `src/app/(admin)/`, alumni-facing under `src/app/alumni-profile/`, auth/registration under `src/app/(full-width-pages)/(auth)/`.
- **Forms** are the core of the product and the least consistent surface:
  - `src/components/forms/AlumniSqlForm.tsx` (registration, ~2.5k lines, uses an `inputBase` const with indigo focus ring)
  - `src/components/forms/alumni-card.tsx` (card application; another `inputBase`)
  - `src/components/forms/campus-membership-form.tsx` (gym/pool/cricket)
  - `src/app/alumni-profile/scholarship-application/ScholarshipApplicationContent.tsx` (~2k lines; inline `className="px-4 py-3 pr-8 bg-[#f0f1f2] ... outline-[#007bff]"` repeated dozens of times; arbitrary hex values; toast styling passed inline as object literals on every call)
  - `src/components/forms/MentorshipForm.tsx`, `JobForm.tsx`
  - Each form defines its own section card, label style, required-asterisk, helper text, error text, and read-only "auto-fetched" field style. None match.
- **Admin tables/detail views** (e.g. `src/components/alumni/AlumniScholarshipsTab.tsx`, `AlumniExpandableDetails.tsx`, `MembershipApplicationPreviewBody.tsx`): key–value tables built from `[label, value][]` arrays, heavy repeated `dark:` class chains, inconsistent status badges, dense without hierarchy.
- **Feedback**: `react-hot-toast` with per-call inline `style` objects (red/green/amber hex) — no central toast theme.
- **Icons**: mix of `lucide-react` and `react-icons` — standardize on lucide.

## Design direction (decide, then apply everywhere)

### 1. Identity: "Institutional Modern"
- **Primary = UOL green**, not template blue. Re-base the `brand` scale on the existing `accent` green so that primary buttons, active nav, focus rings, links, and progress indicators are all green. Keep a single neutral-cool gray scale. Blue becomes an informational colour only (info alerts, links inside body copy if needed).
- Surfaces: white cards on `gray-50` page background (light); `gray-900` cards on `gray-950` (dark). **One** card style: `rounded-2xl border border-gray-200 bg-white shadow-sm` — no gradients, no coloured borders, no drop shadows heavier than `shadow-sm` except modals/popovers.
- Typography: `Outfit` for headings and UI, system/`Roboto` for long body text if needed. Establish a 6-step scale: `display`, `h1 (24/32 semibold)`, `h2 (18/28 semibold)`, `h3 (16/24 medium)`, `body (14/20)`, `caption (12/16)`. Tight tracking on headings only.
- Radius: `rounded-lg` for inputs/buttons, `rounded-2xl` for cards, `rounded-full` for pills/avatars. Nothing else.
- Spacing: 4px grid. Section padding `p-5 sm:p-6`, field gap `gap-5`, section gap `space-y-6`.
- Motion: `motion` for page/section entrance (fade + 4px rise, 150–200ms) and layout transitions only. No bouncing, no parallax.

### 2. Replace `PageBanner`
Replace the full-bleed green gradient banner with a **page header**: breadcrumb (caption, gray-500) → `h1` → optional one-line description → optional right-aligned action slot. Flat background, bottom border. Same component API (`title`) plus optional `description`, `actions`, `breadcrumbs` props so existing call sites keep working.

### 3. Build the form system (highest ROI)
Create `src/components/ui/form/` with these primitives and migrate every form to them:
- `FormSection` — card with numbered/lettered title, optional description, consistent padding. Replaces every hand-rolled `<div className="border ... rounded-lg p-4 sm:p-5">`.
- `Field` — wraps label + control + helper + error. Props: `label`, `required`, `hint`, `error`, `htmlFor`. Renders the red asterisk, `aria-describedby`, and error text (`text-error-600 text-xs mt-1.5` with a lucide `CircleAlert` icon) in one place.
- `Input`, `Select`, `Textarea`, `Checkbox`, `RadioGroup`, `FileInput` — all share one base style: `h-11 rounded-lg border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:bg-gray-50`. Error variant swaps to `border-error-500 focus:ring-error-500/15`. Must be `forwardRef` so React Hook Form `register()` and `Controller` keep working unchanged.
- `ReadOnlyField` — the "auto-fetched from your profile" pattern used across scholarship/card/membership forms: subtle `bg-gray-50`, `text-gray-700`, lock icon, caption "From your profile". One component replaces ~40 copies.
- `AcknowledgmentCheckbox` — the legal/declaration checkbox pattern (card collection/postal terms, scholarship declaration, disclosure): bordered panel, body copy, checkbox with bold summary line. Used by all three forms.
- `FileDropzone` — styled wrapper for the existing `react-dropzone`/`<input type=file>` usage: dashed border, icon, filename chip with remove, PDF/size hints.
- `FormActions` — sticky-on-mobile footer with primary submit (loading spinner state) and secondary cancel.
- Extend `Button`: add `variant: "primary" | "secondary" | "outline" | "ghost" | "danger"`, `size: "sm" | "md" | "lg"`, `loading`, `fullWidth`, `asChild`-style `href` support, `forwardRef`. Keep existing props backward compatible.

### 4. Admin detail & table views
- Key–value displays → a `DescriptionList` component (two-column on `sm+`, stacked on mobile, label `text-gray-500 text-xs uppercase tracking-wide`, value `text-gray-900 text-sm`). Long values (addresses, declaration text) span full width.
- One `StatusBadge` with a fixed map: `pending → amber`, `approved → green`, `rejected → red`, `withdrawn → gray`, `verified → green`, etc. Dot + label, `rounded-full`, `text-xs font-medium`.
- Tables: sticky header, `text-xs uppercase tracking-wide` header cells, 12px/16px padding, zebra off, row hover `bg-gray-50`, row actions in a trailing `⋯` menu on mobile. Empty state component with icon + one-line copy + primary action.
- Document checklists (uploaded PDFs with admin verified Yes/No): list with file icon, name, size, "View" link, and verification toggle as a segmented control — not raw selects.

### 5. Feedback & states
- Centralize toasts: configure `<Toaster>` once with themed `success`/`error`/`loading` styles; **delete every inline `style: { background: '#fee2e2', ... }` object** from call sites — they should just call `toast.error("...")`.
- `Alert` variants `info | success | warning | error` with lucide icons; use for the "complete your profile first" / "email and contact required" gates with an inline action link.
- Skeletons for every TanStack Query loading state (cards, tables, forms) — replace spinners-in-the-middle-of-the-page except for full-page auth transitions.
- Inline validation: show errors on blur/submit, not on every keystroke; scroll to and focus the first invalid field on submit.

### 6. Navigation shells
- Sidebar: 240px, group labels in caption style, active item `bg-brand-50 text-brand-700` with a 2px left bar, lucide icons at 18px, collapse to icon rail on `lg` and below; drawer on mobile.
- Header: 64px, white/gray-900, bottom border, left = page context, right = search (admin only), notifications, user menu with avatar initials fallback.
- Alumni-facing pages: constrain content to `max-w-4xl` for forms and `max-w-6xl` for dashboards; centered.

## Execution plan (follow in order)

1. **Tokens & globals** — re-base `brand` on UOL green in `globals.css`, add typography scale, register fonts properly, define `--shadow-*` and `--radius-*`, add a global `:focus-visible` style, set `<Toaster>` theme. Typecheck.
2. **Primitives** — `Button` extension, `form/*`, `DescriptionList`, `StatusBadge`, `Alert`, `Skeleton`, `EmptyState`, new `PageHeader` (keeping `PageBanner` as a thin wrapper that renders `PageHeader`). Typecheck.
3. **Alumni card form** (`alumni-card.tsx`) — smallest form; migrate fully as the reference implementation. Verify all three flows (collection ack, delivery ack + address, missing email/contact gate).
4. **Scholarship form** (`ScholarshipApplicationContent.tsx`) — migrate self + kinship flows, read-only profile fields, uploads, declaration + disclosure blocks, semester select. Remove all inline toast styles and arbitrary hex classes.
5. **Campus membership form** — same.
6. **Registration form** (`AlumniSqlForm.tsx`) — multi-step; add a step indicator component, migrate fields section by section.
7. **Admin: Scholarships / Memberships / Cards tabs** — `DescriptionList`, `StatusBadge`, document checklist, tables, empty states.
8. **Shells** — sidebar, header, alumni layout widths.
9. **Sweep** — grep for leftover `bg-[#`, `outline-[#`, `text-[#`, `style={{ background`, `from-green-700`, `react-icons` imports and remove them. Final `npx tsc --noEmit` and `npm run build`.

## Definition of done

- Zero arbitrary hex colour classes outside `globals.css`.
- Every `<input>/<select>/<textarea>` in `src/components/forms/**` and `src/app/alumni-profile/**` renders through the new primitives.
- `PageBanner` gradient no longer appears anywhere.
- All toasts use the central theme (no per-call `style`).
- Lighthouse Accessibility ≥ 95 on registration, scholarship, card, and admin scholarship detail pages (light and dark).
- Visual consistency check: screenshot each migrated page at 375px and 1280px, light and dark; headings, inputs, buttons, cards, and badges must be indistinguishable in style across pages.
- `npx tsc --noEmit` and `npm run build` pass.

## Deliverable per step

For each step, report: files touched, components introduced, screenshots (mobile + desktop), and any place where preserving behavior forced a compromise. Do not proceed to the next step if typecheck fails.
