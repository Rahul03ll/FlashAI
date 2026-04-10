"use client";

import { motion } from "framer-motion";

type LoadingSkeletonProps = {
  count?: number;
};

export default function LoadingSkeleton({ count = 4 }: LoadingSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-3 sm:grid-cols-2"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-black/5 bg-white/80 p-4 shadow-soft">
          <div className="shimmer h-3 w-24 rounded" />
          <div className="shimmer mt-3 h-4 w-full rounded" />
          <div className="shimmer mt-2 h-4 w-2/3 rounded" />
          <div className="shimmer mt-5 h-3 w-20 rounded" />
          <div className="shimmer mt-3 h-4 w-full rounded" />
        </div>
      ))}
    </motion.div>
  );
}
