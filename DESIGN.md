---
name: GPT Image Playground
colors:
  background: 'hsl(0 0% 100%)'
  foreground: 'hsl(240 10% 10%)'
  muted: 'hsl(240 5% 96%)'
  muted-foreground: 'hsl(240 4% 46%)'
  border: 'hsl(240 6% 90%)'
  input: 'hsl(240 6% 90%)'
  primary: 'hsl(221 83% 53%)'
  primary-foreground: 'hsl(0 0% 100%)'
  sidebar: 'hsl(240 5% 96%)'
  sidebar-foreground: 'hsl(240 10% 10%)'
  dark-background: 'hsl(240 10% 4%)'
  dark-foreground: 'hsl(0 0% 98%)'
  dark-muted: 'hsl(240 4% 16%)'
  dark-muted-foreground: 'hsl(240 5% 65%)'
  dark-border: 'hsl(240 4% 22%)'
  dark-input: 'hsl(240 4% 22%)'
  dark-primary: 'hsl(217 91% 60%)'
  accent-blue: '#3b82f6'
  success-green: '#22c55e'
  warning-yellow: '#eab308'
  danger-red: '#ef4444'
typography:
  font-ui-sans:
    fontFamily: HarmonyOS Sans SC, Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif
  font-mono:
    fontFamily: Maple Mono, Cascadia Code, SF Mono, Menlo, Consolas, monospace
  title:
    fontSize: 17px-18px
    fontWeight: '700'
    lineHeight: 24px
  body:
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px-22px
  label:
    fontSize: 12px
    fontWeight: '500-600'
    lineHeight: 16px
  micro:
    fontSize: 10px-11px
    fontWeight: '500-700'
    lineHeight: 14px
rounded:
  sm: 0.375rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  input: 1rem-1.5rem
  full: 9999px
spacing:
  unit: 4px
  page-x-mobile: 16px plus safe-area
  page-x-desktop: 16px plus safe-area, max container 1280px
  grid-gap: 16px
  header-height: 56px plus safe-area-top
  input-bottom-mobile: 16px plus safe-area-bottom handling
  input-bottom-desktop: 24px
  input-max-width: 896px
  content-max-width: 1280px
---

## Brand & Style

GPT Image Playground is a creator-focused image generation workspace. Its visual language is practical, quiet, and tool-like: generated images, prompts, task state, and API configuration are the main content, while the interface stays restrained enough for repeated daily use.

The product has two primary experiences: Gallery mode for batch image generation and history management, and Agent mode for multi-turn image planning, reference reuse, and branchable conversations. The design should preserve this dual identity: Gallery feels like a compact media archive, while Agent feels like a chat workspace with embedded generation results.

The UI avoids decorative illustration and marketing composition. It uses translucent surfaces, thin borders, compact controls, and small utility icons. Status is communicated with clear color accents: blue for active generation and primary action, green for download/edit success actions, yellow for favorites or recoverable/interrupted states, and red for destructive or stopped states.

## Colors

The palette is based on neutral zinc grays with blue as the main action color. CSS variables in `src/index.css` and Tailwind extensions in `tailwind.config.js` are the source of truth.

- **Canvas:** Light mode uses white as the base page background. Dark mode uses near-black `hsl(240 10% 4%)` and low-opacity white surfaces.
- **Text:** Primary text is near-black in light mode and near-white in dark mode. Secondary text uses zinc gray ranges for metadata, disabled hints, timestamps, and empty states.
- **Borders:** Structure is defined by 1px gray borders or `white/[0.08]` in dark mode. Borders should stay subtle and avoid heavy panel framing.
- **Primary Action:** Blue `#3b82f6` / Tailwind `blue-500` is used for submit buttons, selected task rings, running states, mention tags, and active focus rings.
- **Functional Accents:** Green marks downloads or edit-output affordances, yellow marks favorites and interrupted/recoverable states, red marks delete, errors, or stop generation.
- **Overlays:** Image metadata badges use black translucent overlays with backdrop blur. Floating input, menus, and headers use white or dark translucent surfaces with blur.

## Typography

The interface uses `HarmonyOS Sans SC` as the primary UI font, with `Noto Sans SC`, `PingFang SC`, and `Microsoft YaHei` as Chinese fallbacks. Monospace metadata, timers, and code-like values use `Maple Mono` with common code font fallbacks.

Typography is intentionally compact. Titles are usually 17-18px and bold. Most body and control text is 12-14px. Task cards use 14px prompt excerpts with `line-clamp` behavior so dense history stays scannable. Badges and image overlays use 10-12px text to avoid competing with the image preview.

Type scale should not expand into marketing-style hero text. This is a working application, so hierarchy should come from weight, color, spacing, and placement rather than oversized headings.

## Layout & Spacing

The app is a single page application with state-driven views. `src/App.tsx` switches the main surface by Zustand `appMode`; there is no route-level layout system.

- **Header:** A fixed translucent top bar with safe-area support, app title, mode switcher, and utility icons. On mobile, Gallery mode can hide the secondary mode switcher while scrolling; Agent mode can hide the top bar and reveal it with a pull hint.
- **Gallery:** The main content is centered in a `max-w-7xl` container. `TaskGrid` uses a 1 / 2 / 3 column responsive grid with 16px gaps and bottom padding to leave room for the floating input bar.
- **Task Card:** Cards are horizontal media records rather than square gallery tiles: a fixed 160px image preview on the left and prompt/actions/metadata on the right. This favors quick scanning of generation history.
- **Floating Input:** `InputBar` is the primary command surface. It is fixed near the bottom, centered, max-width `4xl`, and uses a blurred, rounded, translucent panel. It must remain visually dominant but not block too much history content.
- **Agent Workspace:** Agent mode uses a conversation-oriented layout with a sidebar/history surface and a central message stream. Messages are bubble-like panels with embedded task cards and generated image references.
- **Mobile:** Controls collapse into tighter stacks. Inputs use 16px minimum font size where necessary to avoid mobile browser zoom. Safe-area variables protect header and bottom controls.

## Elevation & Depth

Depth is created with transparency, blur, borders, and small shadows.

- **Level 0:** Page canvas and scrollable content backgrounds.
- **Level 1:** Task cards, message bubbles, settings groups, and list items use white/dark surfaces plus thin borders.
- **Level 2:** Floating input, batch action bars, dropdowns, and context menus use backdrop blur, ring borders, and soft shadows.
- **Level 3:** Modals and lightbox surfaces add overlay animation and stronger focus containment.

Default cards should not feel heavily elevated. Hover may add `shadow-lg` or a slightly stronger border, but depth should remain secondary to content clarity.

## Shapes

The shape language is rounded but still utilitarian.

- Task cards: `rounded-xl` with clipped media.
- Floating input: `rounded-2xl` on mobile and `rounded-3xl` on larger screens.
- Message bubbles: `rounded-2xl` with one softened corner adjusted by sender direction.
- Icon buttons: usually `rounded-lg` or `rounded-xl` depending on size.
- Chips and batch bars: pills or compact rounded badges.
- Mention tags: small 6px radius inline capsules to keep text editing stable.

Avoid nesting cards inside decorative cards. Use cards for actual repeated items, messages, dialogs, and tool surfaces.

## Components

### Header & Mode Switcher

The header is a compact global control strip. The app title remains the brand anchor; Gallery and Agent are segmented controls. Utility actions are icon-first: install, help, history, new conversation, and settings. Tooltips clarify icon-only actions.

### Task Grid & Task Card

Task cards show status, thumbnail, elapsed time or image dimensions, prompt preview, API/model metadata, generation params, and common actions. Cards support click-to-detail, drag selection, touch swipe selection, favorite assignment, retry, reuse config, edit outputs, and delete. The preview side owns visual state; the text side owns operational context.

### Floating Input Bar

The input bar is a command bar for both modes. It supports contenteditable prompt input, reference image upload/paste/drag, mask editing, parameter controls, submit/stop, and Agent `@` image mentions. Its styling should keep it legible over scrolling content: translucent panel, high-radius corners, blur, and contained controls.

### Agent Workspace

Agent mode is a chat workspace with generation-aware messages. Assistant messages can contain markdown text, web-search status, inline generated task cards, batch image placeholders, branch controls, retry/regenerate actions, copy/download/favorite actions, and deleted-image placeholders. User messages can include uploaded or referenced images.

### Settings Modal

Settings is a dense operational panel, not a marketing surface. It manages API profiles, built-in providers, custom provider manifests, image compression, app preferences, import/export, and proxy behavior. Because `SettingsModal.tsx` is intentionally large, changes should remain narrowly scoped and preserve draft/profile normalization behavior.

### Modals, Menus, Toasts

Modals use fixed overlays, backdrop blur, and short enter animations. Context menus and dropdowns should stay compact, high-contrast enough for dark mode, and positioned to avoid clipping. Toasts are brief status confirmations and should not become a secondary notification center.

## Interaction Principles

- Preserve fast repeated workflows: prompt, attach references, generate, inspect, reuse, retry, favorite, download.
- Keep primary actions obvious and close to the working surface.
- Use icon buttons for compact tool actions, but provide `aria-label` and tooltip text.
- Distinguish running, recoverable, stopped, and failed states with clear copy and color.
- Avoid layout shifts in fixed-format surfaces such as cards, image previews, metadata rows, and bottom controls.
- Agent references should remain understandable through visible mention chips and image thumbnails, without exposing internal XML/reference tags to users.

## Accessibility & Responsiveness

The design includes hover tooltips, `aria-label` attributes for icon buttons, selectable text opt-ins for prompts/errors, and mobile font guards. Future UI additions should preserve keyboard focus outlines or equivalent focus rings, readable contrast in both color schemes, and pointer/touch behavior separation for drag-select and swipe-select flows.

Responsive behavior should prioritize stable fixed controls: header, input bar, cards, and Agent scroll controls must not overlap incoherently on small screens. Safe-area variables are part of the layout contract and should be used for new fixed-position surfaces.

## Motion

Motion is functional and short. Existing patterns include fade/scale modal entrance, dropdown expansion, toast entrance, streaming pulse, web-search text shimmer, card hover elevation, and mobile collapse transitions. Motion must respect `prefers-reduced-motion` where continuous animation is used.

## Implementation Notes

- Design tokens live primarily in `src/index.css` and `tailwind.config.js`.
- View selection lives in `src/App.tsx` through `appMode` from `src/store.ts`.
- Core state, persistence, task lifecycle, Agent workflow, import/export, and image caching live in `src/store.ts`.
- Provider configuration and defaults live in `src/lib/apiProfiles.ts`.
- High-risk UI surfaces are `src/components/InputBar.tsx`, `src/components/SettingsModal.tsx`, and `src/components/AgentWorkspace.tsx`.
- New UI should follow existing Tailwind utility style and local `src/components/icons.tsx` icon conventions.
