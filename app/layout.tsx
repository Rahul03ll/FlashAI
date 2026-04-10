import type { Metadata } from "next";
import { Inter, Fredoka } from "next/font/google";
import Navbar from "@/components/Navbar";
import DbWarmup from "@/components/DbWarmup";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const fredokaOne = Fredoka({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://flashai.vercel.app"),
  title: 'FlashAI — Turn any PDF into smart flashcards',
  description: 'Upload a PDF and get 15-20 exam-quality flashcards in seconds. SM-2 spaced repetition keeps them in your head for good.',
  openGraph: {
    title: 'FlashAI — Turn any PDF into smart flashcards',
    description: 'Upload a PDF, get AI-generated flashcards with spaced repetition. Built for students who actually want to remember.',
    url: '/',
    siteName: 'FlashAI',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FlashAI — AI Flashcard Engine',
      }
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FlashAI — Turn any PDF into smart flashcards',
    description: 'Upload a PDF, get AI-generated flashcards with spaced repetition.',
    images: ['/og-image.png'],
  },
};



export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${fredokaOne.variable} min-h-screen bg-cream text-ink antialiased`}>
        <div className="global-noise pointer-events-none fixed inset-0 z-0 opacity-[0.08]" />
        <div className="pointer-events-none fixed -left-20 -top-24 z-0 h-72 w-72 rounded-full bg-accent blur-[110px] opacity-20" />
        <div className="pointer-events-none fixed -bottom-16 -right-20 z-0 h-80 w-80 rounded-full bg-coral blur-[120px] opacity-20" />
        <div className="relative z-10">
          <Navbar />
          {children}
          <DbWarmup />
        
        </div>
      </body>
    </html>
  );
}
