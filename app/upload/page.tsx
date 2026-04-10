import CardStackPreview from "@/components/CardStackPreview";
import OnboardingFlow from "@/components/OnboardingFlow";
import PageShell from "@/components/PageShell";
import UploadZone from "@/components/UploadZone";

export default function UploadPage() {
  return (
    <PageShell maxWidthClassName="max-w-6xl">
      <OnboardingFlow />
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">FlashAI Studio</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight text-ink sm:text-5xl lg:text-6xl">
            Turn PDFs into<br className="hidden sm:block" /> memory-ready cards.
          </h1>
          <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-ink/65">
            Upload your notes, and FlashAI instantly crafts premium flashcards with Groq-powered
            generation, designed for active recall and long-term retention.
          </p>
        </div>
        <CardStackPreview />
      </section>

      <div className="mt-10">
        <UploadZone />
      </div>
    </PageShell>
  );
}
