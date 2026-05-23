import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Heart, Loader2, MessageCircle, Users, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { listDonors, submitDonation } from "@/lib/donations.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/donate")({
  head: () => ({
    meta: [
      { title: "Donate — Support ReadMe" },
      { name: "description", content: "Help keep ReadMe free for students. Donate and get recognised in our public donor list." },
      { property: "og:title", content: "Donate — Support ReadMe" },
      { property: "og:description", content: "Help keep ReadMe free for students." },
    ],
  }),
  component: DonatePage,
});

const ACCOUNT = { bank: "Opay", number: "9064887865", name: "Adeyi Gbeminiyi" };

function DonatePage() {
  const listFn = useServerFn(listDonors);
  const submitFn = useServerFn(submitDonation);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["donors"], queryFn: () => listFn() });

  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const mut = useMutation({
    mutationFn: (d: { donorName: string; amount: number; reference?: string; message?: string }) => submitFn({ data: d }),
    onSuccess: () => {
      toast.success("Thanks! Your donation will appear once an admin approves it.");
      qc.invalidateQueries({ queryKey: ["donors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="container mx-auto px-4 py-14 max-w-4xl text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
              <Heart className="h-6 w-6" />
            </span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Help keep ReadMe free</h1>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              ReadMe is built and maintained for students. Your donation goes directly to running the
              platform and growing what it can do for your school.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary">
                <Users className="h-4 w-4" /> {isLoading ? "…" : data?.uniqueCount ?? 0} donors so far
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{data?.total ?? 0} total contributions</span>
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 py-10 grid gap-8 lg:grid-cols-2 max-w-5xl">
          {/* Why */}
          <section className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-semibold mb-3">Why we collect donations</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Keeping ReadMe online — hosting, database, and storage costs.</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> AI-generated practice questions from your uploaded study materials.</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Adding new features students ask for — notes, group chat, mobile support.</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Supporting more schools and departments, no fee required from students.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-semibold mb-3">How to donate</h2>
              <div className="space-y-2 text-sm">
                <DetailRow label="Bank" value={ACCOUNT.bank} onCopy={copy} />
                <DetailRow label="Account number" value={ACCOUNT.number} onCopy={copy} />
                <DetailRow label="Account name" value={ACCOUNT.name} onCopy={copy} />
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                After sending, fill in the short form so an admin can verify and add you to the donor list.
              </p>
              <a href="https://wa.me/2349064887865" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-sm text-primary hover:underline">
                <MessageCircle className="h-4 w-4" /> Send proof on WhatsApp
              </a>
            </div>
          </section>

          {/* Form */}
          <section>
            <div className="rounded-2xl border border-border bg-card p-6 sticky top-20">
              <h2 className="text-xl font-semibold mb-1">Log your donation</h2>
              <p className="text-sm text-muted-foreground mb-4">An admin will confirm and publish your name to the donor wall.</p>

              {!signedIn ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Please <Link to="/auth" className="text-primary underline">sign in</Link> to log a donation.
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    mut.mutate({
                      donorName: String(fd.get("donorName")),
                      amount: Number(fd.get("amount")),
                      reference: String(fd.get("reference") ?? "") || undefined,
                      message: String(fd.get("message") ?? "") || undefined,
                    });
                    (e.target as HTMLFormElement).reset();
                  }}
                  className="space-y-3"
                >
                  <Field label="Display name (shown publicly)" name="donorName" required maxLength={120} />
                  <Field label="Amount (₦)" name="amount" type="number" required min={1} step="any" />
                  <Field label="Transaction reference (optional)" name="reference" maxLength={200} />
                  <div className="space-y-1.5">
                    <Label htmlFor="message">Short message (optional)</Label>
                    <Textarea id="message" name="message" rows={3} maxLength={500} />
                  </div>
                  <Button type="submit" className="w-full" disabled={mut.isPending}>
                    {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Submit for approval
                  </Button>
                </form>
              )}
            </div>
          </section>
        </div>

        {/* Donor wall */}
        <section className="container mx-auto px-4 pb-16 max-w-5xl">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-2xl font-semibold">Our donors</h2>
            <span className="text-sm text-muted-foreground">Sorted by number of contributions</span>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (data?.donors.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
              No donors yet — be the first to support ReadMe.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {data!.donors.map((d, i) => (
                <div key={d.name} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full font-bold ${
                    i < 3 ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                  }`}>
                    {d.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.count} donation{d.count > 1 ? "s" : ""}
                    </div>
                  </div>
                  {d.count > 1 && <span className="text-xs font-semibold text-primary">×{d.count}</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({ label, name, ...props }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

function DetailRow({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-mono">
        {value}
        <button onClick={() => onCopy(value)} className="text-muted-foreground hover:text-primary"><Copy className="h-3.5 w-3.5" /></button>
      </span>
    </div>
  );
}
