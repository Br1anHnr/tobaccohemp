export const easePremium = [0.22, 1, 0.36, 1] as const;
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easePremium },
  },
};
export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
export const drawerSpring = {
  type: "spring" as const,
  damping: 32,
  stiffness: 280,
};
