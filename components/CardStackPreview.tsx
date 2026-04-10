"use client";

import { motion } from "framer-motion";

const cards = [
  { id: 1, title: "Question", text: "What is spaced repetition?", rotate: -6, z: "z-10" },
  { id: 2, title: "Answer", text: "A method to review information over optimized intervals.", rotate: -2, z: "z-20" },
  { id: 3, title: "Question", text: "Why does active recall improve retention?", rotate: 0, z: "z-30" },
];

export default function CardStackPreview() {
  return (
    <div className="relative mx-auto h-[260px] w-full max-w-md">
      {cards.map((card, index) => (
        <motion.div
          key={card.id}
          initial={{ y: 40, opacity: 0 }}
          animate={{
            y: [0, index % 2 === 0 ? -6 : -4, 0],
            opacity: 1,
          }}
          transition={{
            opacity: { duration: 0.45, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] },
            y: {
              duration: 3 + index * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.4,
            },
          }}
          whileHover={{ y: -10, scale: 1.03, zIndex: 50 }}
          className={`absolute left-0 right-0 mx-auto w-[88%] rounded-2xl border border-black/5 bg-white/90 p-5 shadow-soft ${card.z}`}
          style={{ rotate: card.rotate, top: `${index * 26}px` }}
        >
          <p className="text-xs uppercase tracking-wider text-accent">{card.title}</p>
          <p className="mt-2 text-sm text-ink/85">{card.text}</p>
        </motion.div>
      ))}
    </div>
  );
}
