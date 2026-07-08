// Central z-index scale — the only z-* classes the UI may use.
// Tailwind picks these up because the literals appear in this file.
export const Z = {
  /** In-page raised elements: sticky headers, floating page controls. */
  raised: 'z-10',
  /** Side drawers and slide-in panels. */
  drawer: 'z-30',
  /** Full-page overlays (snip view, loop overlay). */
  overlay: 'z-40',
  /** Topmost layer: modals, menus, popovers, scrims. */
  modal: 'z-50',
} as const
