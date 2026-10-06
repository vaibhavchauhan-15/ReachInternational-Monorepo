import { Easing, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { motion } from '@reachinternational/design-tokens';

export const reveal = (i = 0) =>
  FadeInDown.delay(Math.min(i, motion.staggerMax) * motion.stagger)
    .duration(motion.duration.base)
    .reduceMotion(ReduceMotion.System);

export const motionEasings = {
  decelerate: Easing.bezier(...motion.easing.decelerate),
  accelerate: Easing.bezier(...motion.easing.accelerate),
  standard: Easing.bezier(...motion.easing.standard),
};

export { motion };
