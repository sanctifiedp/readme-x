import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Brain, CheckCircle2, MessagesSquare, Sparkles, Phone, RefreshCw, Quote, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getRandomQuote } from "@/lib/quotes.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReadMe — CBT Exam Platform for Students" },
      {
        name: "description",
        content:
          "ReadMe lets students take 30-question randomized CBT exams, auto-graded instantly. Chat with classmates and stay inspired.",
      },
      { property: "og:title", content: "ReadMe — CBT Exam Platform" },
      {
        property: "og:description",
        content: "Auto-graded computer-based tests, AI question banks, class chat. Built for students.",
      },
    ],
  }),
  component: Home,
});

const FEATURES = [
  { icon: BookOpen, title: "Course-based exams", body: "Admin uploads materials per course code. You take 30-question randomized tests." },
  { icon: Brain, title: "AI-generated questions", body: "Each exam pulls from a fresh question bank built by AI from real course content." },
  { icon: CheckCircle2, title: "Auto-graded results", body: "Submit and see your score instantly. Track every past attempt." },
  { icon: MessagesSquare, title: "Class chat", body: "Talk to classmates in a realtime group chat — share tips, ask questions." },
  { icon: Sparkles, title: "Daily inspiration", body: "Refreshable inspirational quotes to keep you focused." },
  { icon: Phone, title: "Direct line to admin", body: "One tap to message the administrator at 09064887865." },
];

function Home() {
  const fetchQuote = useServerFn(getRandomQuote);
  const { data: quote, refetch, isFetching } = useQuery({
    queryKey: ["random-quote"],
    queryFn: () => fetchQuote(),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
          <div className="container mx-auto px-4 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-80">University CBT Platform</p>
              <h1 className="mt-3 text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight">
                READ<span className="opacity-80">ME</span>
                <span className="block text-2xl md:text-3xl font-semibold mt-3 opacity-90">
                  Take exams. Get graded. Keep reading.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-base md:text-lg opacity-90">
                Take exams, get auto-graded instantly, chat with classmates, and stay inspired.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/auth">
                  <Button size="lg" variant="secondary" className="font-semibold">
                    Get started
                  </Button>
                </Link>
                <a href="sms:09064887865">
                  <Button size="lg" variant="outline" className="font-semibold bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white">
                    <Phone className="h-4 w-4 mr-2" />
                    Message admin
                  </Button>
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-6 md:p-8 shadow-2xl">
                <div className="flex items-start gap-3">
                  <Quote className="h-6 w-6 opacity-80 shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="text-xl md:text-2xl font-medium leading-relaxed">
                      "{quote?.text ?? "Loading…"}"
                    </p>
                    <p className="mt-3 text-sm opacity-80">— {quote?.author ?? ""}</p>
                  </div>
                  <button
                    onClick={() => refetch()}
                    className="p-2 rounded-full hover:bg-white/10 transition"
                    aria-label="New quote"
                  >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-16 lg:py-24">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-6 hover:shadow-[var(--shadow-glow)] transition-shadow"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Donate strip */}
        <section className="container mx-auto px-4 pb-16">
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Heart className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold">Support ReadMe</h3>
                <p className="text-sm text-muted-foreground">
                  Adeyi Gbeminiyi · Opay · <span className="font-mono">9064887865</span>
                </p>
              </div>
            </div>
            <a href="sms:09064887865">
              <Button>Reach out</Button>
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
