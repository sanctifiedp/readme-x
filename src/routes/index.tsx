import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, CheckCircle2, ClipboardList, Sparkles, MessageSquareText, ArrowRight, Heart, Rocket, Clock, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, FEEDBACK_URL } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReadMe X — Practice past questions. Pass with confidence." },
      {
        name: "description",
        content:
          "Timed CBT practice from your course's question bank, with AI hints when you're stuck. Built by students, for students.",
      },
      { property: "og:title", content: "ReadMe X — Smart CBT practice for students" },
      {
        property: "og:description",
        content: "Pick a course, choose your time and question count, and practice with AI-powered hints.",
      },
    ],
  }),
  component: Home,
});

const BENEFITS = [
  { icon: Clock, title: "Practice on your terms", body: "Pick up to 70 questions and a 30-minute timer that fits your schedule." },
  { icon: ClipboardList, title: "Up to 500 questions per course", body: "Deep banks per course code, so every session feels fresh." },
  { icon: Sparkles, title: "AI hint on every question", body: "Stuck? Get a single-sentence nudge — without spoiling the answer." },
  { icon: CheckCircle2, title: "Review after every attempt", body: "See your answers, the correct ones, and the hints — side by side." },
];

function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
          <div className="container mx-auto px-4 py-20 lg:py-28 text-center max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-80">CBT practice · Early access</p>
            <h1 className="mt-3 text-4xl md:text-6xl font-extrabold tracking-tight">
              Practice past questions.<br className="hidden sm:block" /> Pass with confidence.
            </h1>
            <p className="mt-5 text-base md:text-lg opacity-90">
              Timed CBT practice from your course's question bank, with AI hints when you're stuck.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/courses">
                <Button size="lg" variant="secondary" className="font-semibold w-full sm:w-auto">
                  Try it now <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link to="/notes">
                <Button size="lg" variant="outline" className="font-semibold bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white w-full sm:w-auto">
                  Browse notes
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-3xl font-bold tracking-tight">Why students choose ReadMe X</h2>
            <p className="text-muted-foreground mt-2">Lightweight. Focused. Built around how you actually study.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <b.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold">{b.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Preview mock */}
        <section className="container mx-auto px-4 pb-16">
          <div className="rounded-2xl border border-border bg-card p-6 md:p-10 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">A peek inside</p>
              <h2 className="text-2xl md:text-3xl font-bold mt-2">Every question, one tap from a hint.</h2>
              <p className="mt-3 text-muted-foreground">
                Pick a course, set your time and how many questions, then practice. Every prompt has an AI hint waiting — a single sentence to nudge you forward without giving away the answer.
              </p>
              <Link to="/courses" className="inline-block mt-5">
                <Button>Start practicing <ArrowRight className="h-4 w-4 ml-2" /></Button>
              </Link>
            </div>
            <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Question 4 of 20</div>
              <p className="mt-2 font-medium leading-relaxed">Which data structure offers O(1) average lookup by key?</p>
              <div className="mt-4 space-y-2 text-sm">
                {["Linked list", "Hash table", "Binary tree", "Stack"].map((o, i) => (
                  <div key={o} className={`px-3 py-2 rounded-md border ${i === 1 ? "border-primary bg-primary/10" : "border-border"}`}>
                    <span className="font-mono text-xs mr-2">{String.fromCharCode(65 + i)}.</span>{o}
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span><span className="font-semibold">Hint: </span>Think about which structure maps keys directly to memory slots.</span>
              </div>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section className="container mx-auto px-4 pb-16">
          <div className="rounded-2xl bg-muted/40 border border-border p-8 text-center">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Quote className="h-5 w-5" />
            </div>
            <p className="mt-3 max-w-2xl mx-auto text-muted-foreground">
              <span className="font-semibold text-foreground">Built by students, for students.</span> ReadMe X is in early access — your feedback shapes what we ship next.
            </p>
            <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className="inline-block mt-5">
              <Button variant="outline" className="gap-2"><MessageSquareText className="h-4 w-4" /> Give feedback</Button>
            </a>
          </div>
        </section>

        {/* Coming soon */}
        <section className="container mx-auto px-4 pb-16">
          <h2 className="text-2xl font-bold text-center">Coming soon</h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-6 max-w-3xl mx-auto">
            {[
              { icon: Brain, title: "Smart recommendations", body: "We'll suggest what to revise next based on your attempts." },
              { icon: Rocket, title: "Grok AI integration", body: "Bring your own Grok API key to power deeper explanations." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-dashed border-border p-5 bg-background/50">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Upcoming</span>
                </div>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="container mx-auto px-4 pb-20">
          <div className="rounded-2xl p-8 text-center text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
            <h2 className="text-3xl font-bold">Ready to practice?</h2>
            <p className="mt-2 opacity-90">Pick a course and start your first timed session.</p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/courses">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">Try it now</Button>
              </Link>
              <Link to="/donate">
                <Button size="lg" variant="outline" className="bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white w-full sm:w-auto gap-2">
                  <Heart className="h-4 w-4" /> Support the project
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
