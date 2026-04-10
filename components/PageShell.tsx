"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  maxWidthClassName?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function PageShell({
  children,
  className,
  maxWidthClassName = "max-w-6xl",
}: PageShellProps) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn("mx-auto px-6 py-12", maxWidthClassName, className)}
    >
      {children}
    </motion.main>
  );
}
