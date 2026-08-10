# Retro Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement retro pixel-art style animations for interactive elements, loading components, errors, and modals in the JHS Ekskul system.

**Architecture:** We will add custom stepped animation keyframes to the global `index.css` stylesheet, extend the tailwind configuration with custom animations, and apply the animation classes to core elements (cards, buttons, alerts, and modal dialogs).

**Tech Stack:** Tailwind CSS, CSS Custom Keyframes, React, Lucide Icons

## Global Constraints
- Do not add any heavy external transition libraries (like Framer Motion) to maintain performance and minimal bundle size.
- Animations must be stepped (e.g. `steps(4)` or `steps(8)`) rather than smooth to align with the pixel art design system.

---

### Task 1: Add Custom CSS Keyframes and Classes

**Files:**
- Modify: `src/index.css`
- Modify: `tailwind.config.js`

- [ ] **Step 1: Add the retro animation keyframes and interactive card hover styles to `src/index.css`**
  Add the following rules to the `@layer components` section of [src/index.css](file:///media/lian/Ubuntu/Ekskul-JHS/src/index.css):
  ```css
  @keyframes pixel-shake {
    0%, 100% { transform: translate(0, 0); }
    20% { transform: translate(-4px, 2px); }
    40% { transform: translate(4px, -2px); }
    60% { transform: translate(-2px, -2px); }
    80% { transform: translate(2px, 2px); }
  }

  @keyframes pixel-pop {
    0% { transform: scale(0.85); opacity: 0; }
    50% { transform: scale(1.02); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes pixel-xp-float {
    0% { transform: translateY(0); opacity: 0; }
    20% { opacity: 1; }
    80% { opacity: 1; }
    100% { transform: translateY(-24px); opacity: 0; }
  }

  @keyframes pixel-spin-stepped {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .animate-pixel-shake {
    animation: pixel-shake 0.3s steps(4) 1;
  }

  .animate-pixel-pop {
    animation: pixel-pop 0.2s steps(3) forwards;
  }

  .animate-pixel-xp-float {
    animation: pixel-xp-float 1s steps(6) forwards;
  }

  .animate-pixel-spin-stepped {
    animation: pixel-spin-stepped 1s steps(8) infinite;
  }

  /* Interactive card hover styles */
  .pixel-card-interactive {
    cursor: pointer;
    transition: none !important;
  }
  .pixel-card-interactive:hover {
    transform: translate(-2px, -2px);
    box-shadow:
      inset -3px -3px 0 0 rgba(0, 0, 0, 0.4),
      inset 3px 3px 0 0 rgba(255, 255, 255, 0.12),
      6px 6px 0 0 var(--pixel-blue) !important;
  }
  .pixel-card-interactive:active {
    transform: translate(2px, 2px);
    box-shadow:
      inset -3px -3px 0 0 rgba(255, 255, 255, 0.1),
      inset 3px 3px 0 0 rgba(0, 0, 0, 0.4) !important;
  }
  ```

- [ ] **Step 2: Update Tailwind configuration to extend utility animations**
  Modify [tailwind.config.js](file:///media/lian/Ubuntu/Ekskul-JHS/tailwind.config.js#L86-L89) to support these retro utilities natively:
  ```javascript
        animation: {
          'pixel-blink': 'pixel-blink 1s steps(2) infinite',
          'pixel-bounce': 'pixel-bounce 0.6s steps(4) infinite',
          'pixel-shake': 'pixel-shake 0.3s steps(4) 1',
          'pixel-pop': 'pixel-pop 0.2s steps(3) forwards',
          'pixel-xp-float': 'pixel-xp-float 1s steps(6) forwards',
          'pixel-spin-stepped': 'pixel-spin-stepped 1s steps(8) infinite',
        },
  ```

- [ ] **Step 3: Commit changes**
  Run: `git add src/index.css tailwind.config.js && git commit -m "style: add custom retro keyframes and animations"`

---

### Task 2: Apply Stepped Animations to Components and Views

**Files:**
- Modify: `src/components/ui/button.jsx`
- Modify: `src/components/shared/Sidebar.jsx`
- Modify: `src/components/shared/AnnouncementBanner.jsx`

- [ ] **Step 1: Update Button spinner to use stepped spin**
  Ensure any loading spinner in [src/components/ui/button.jsx](file:///media/lian/Ubuntu/Ekskul-JHS/src/components/ui/button.jsx) uses `animate-pixel-spin-stepped` instead of normal spin.

- [ ] **Step 2: Apply shake effect to active navigation items and hover effects on sidebar items**
  Add subtle stepped animations to sidebar or bottom nav interactions in [src/components/shared/Sidebar.jsx](file:///media/lian/Ubuntu/Ekskul-JHS/src/components/shared/Sidebar.jsx).

- [ ] **Step 3: Commit changes**
  Run: `git add src/components/ui/button.jsx src/components/shared/Sidebar.jsx && git commit -m "style: apply stepped animations to buttons and navigation elements"`

---

### Task 3: Enhance Dialog/Modal and Alert Feedback Animations

**Files:**
- Modify: `src/pages/coach/CoachSessions.jsx` (and potentially other pages) to apply shake on error and pop on modal entry.

- [ ] **Step 1: Apply pop animation (`animate-pixel-pop`) to Modals and Dialogs**
  Locate modal containers and add the `animate-pixel-pop` class to make them enter with a retro pop.

- [ ] **Step 2: Apply shake animation (`animate-pixel-shake`) to alert banners when errors occur**
  In pages where error messages are displayed (like `CoachSessions.jsx`), add `animate-pixel-shake` to the alert container to draw attention instantly on entry.

- [ ] **Step 3: Commit changes**
  Run: `git add src/pages/coach/CoachSessions.jsx && git commit -m "style: implement pixel-shake on errors and pixel-pop on modal entry"`

---

## Verification Plan

### Automated Tests
- Run `npm run lint` and `npm run build` to verify there are no compilation or syntax errors.

### Manual Verification
- Launch the dev server via `npm run dev`.
- Inspect the landing/dashboard page and check if button interactions, interactive card hovers, modal popups, and error alert shake animations feel consistent and retro-themed.
