import { Variants, Easing } from "motion/react";

/**
 * Apple-inspired Easing Functions
 */
export const APPLE_EASE: Easing = [0.25, 0.1, 0.25, 1];
export const EXPO_OUT: Easing = [0.16, 1, 0.3, 1];

/**
 * Spring configurations for premium feel
 */
export const SPRING_SOFT = {
  type: "spring" as const,
  stiffness: 100,
  damping: 20,
  mass: 1,
};

export const SPRING_STIFF = {
  type: "spring" as const,
  stiffness: 260,
  damping: 30,
};

export const APPLE_LYRICS_TRANSITION = {
  type: "spring" as const,
  stiffness: 100,
  damping: 20,
  mass: 1,
};

/**
 * Common Animation Variants optimized for performance
 * using opacity and transform (translate) only.
 */

export const FADE_IN_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4, ease: APPLE_EASE } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: APPLE_EASE } },
};

export const SLIDE_UP_VARIANTS: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EXPO_OUT } },
  exit: { opacity: 0, y: 10, transition: { duration: 0.3, ease: APPLE_EASE } },
};

export const SCALE_VARIANTS: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25 } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.2 } },
};

/**
 * Reusable motion configurations to reduce memory footprint
 * and re-definition overhead.
 */
export const MOTION_CONFIG = {
  transition: { duration: 0 },
};
