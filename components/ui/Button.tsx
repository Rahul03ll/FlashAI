"use client";

import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type Variant = "accent" | "mint" | "coral" | "ghost" | "danger" | "comic-yellow" | "comic-blue" | "comic-green" | "comic-red";
type Size = "sm" | "md" | "lg";

type ButtonProps = HTMLMotionProps<"button"> & {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const variantClasses: Record<Variant, string> = {
  accent: "bg-accent text-white hover:bg-accent-hover",
  mint: "bg-mint text-ink hover:bg-[#00b988]",
  coral: "bg-coral text-white hover:bg-[#ff5757]",
  ghost: "border border-black/10 bg-white/70 text-ink hover:bg-white",
  danger: "bg-danger text-white hover:bg-[#dc2626]",
  "comic-yellow": "bg-comic-yellow text-ink hover:bg-[#ffd700]",
  "comic-blue": "bg-comic-blue text-ink hover:bg-[#29b6f6]",
  "comic-green": "bg-comic-green text-ink hover:bg-[#00e676]",
  "comic-red": "bg-comic-red text-white hover:bg-[#ff1744]",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-3 text-sm",
  lg: "px-7 py-4 text-base",
};

export default function Button({
  children,
  className,
  variant = "accent",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ x: 2, y: 2, boxShadow: "0px 0px 0px 0px #0a0a0f" }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "rounded-full font-semibold border-2 border-ink shadow-comic transition-all duration-300 ease-premium disabled:cursor-not-allowed disabled:opacity-60",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
