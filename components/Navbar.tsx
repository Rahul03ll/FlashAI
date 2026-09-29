"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import UserProfilePill from "@/components/UserProfilePill";
import LivePresenceBadge from "@/components/LivePresenceBadge";

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/upload", label: "Upload" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/leaderboard", label: "Leaderboard" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl font-bold text-ink">
            <span className="font-display bg-comic-yellow border-2 border-ink rounded-full px-2.5 py-0.5 shadow-xs">
              FlashAI
            </span>
          </Link>
          <div className="hidden md:block">
            <LivePresenceBadge />
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <div className="flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <motion.div
                  key={link.href}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link
                    href={link.href}
                    className={`rounded-full px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-accent border-2 border-ink shadow-comic-sm text-white"
                        : "text-ink/70 hover:text-ink hover:bg-black/5"
                    }`}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <div className="ml-1 pl-1 border-l border-black/10 sm:ml-2 sm:pl-2">
            <UserProfilePill />
          </div>
        </div>
      </div>
    </nav>
  );
}
