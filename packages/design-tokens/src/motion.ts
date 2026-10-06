export const motion = {
  duration: { instant: 90, fast: 150, base: 220, slow: 320 }, // ms
  easing: {
    decelerate: [0, 0, 0, 1],       // things entering
    accelerate: [0.3, 0, 1, 1],     // things leaving
    standard:   [0.2, 0, 0, 1],
  },
  spring: {
    press: { damping: 18, stiffness: 300, mass: 0.6 },
  },
  press: { card: 0.98, button: 0.96, icon: 0.88, nav: 0.92 }, // scale on press-in
  stagger: 30,        // ms between list items
  staggerMax: 8,      // items after this index appear together
} as const;

export type MotionToken = typeof motion;
