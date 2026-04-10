"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type CardVariant = "default" | "outlined" | "flat" | "comic";

type CardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  variant?: CardVariant;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const variantClasses: Record<CardVariant, string> = {
  default: "border-2 border-ink shadow-comic bg-white/85",
  outlined: "border-2 border-black/15 bg-white/60",
  flat: "bg-white/50",
  comic: "border-2 border-ink shadow-comic bg-white rounded-2xl",
};

export default function Card({ children, className, hover = false, variant = "default" }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -4, scale: 1.01, boxShadow: "5px 5px 0px 0px #0a0a0f" } : undefined}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn("rounded-2xl", variantClasses[variant], className)}
    >
      {children}
    </motion.div>
  );
}
