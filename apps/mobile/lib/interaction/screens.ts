import { motion } from '@reachinternational/design-tokens';

export const screenAnim = {
  tab:    { animation: 'fade', animationDuration: motion.duration.fast },             // Dashboard, Machines, Operations, Users...
  detail: { animation: 'slide_from_right', animationDuration: motion.duration.base }, // machines/[id], users/[id], clients/[id]
  modal:  { presentation: 'modal', animation: 'slide_from_bottom' },                   // full-screen forms
} as const;
