import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { SchoolDepartmentPicker } from "@/components/SchoolDepartmentPicker";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ReadMe" },
      { name: "description", content: "Sign in or create a ReadMe account to take exams and chat with classmates." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [unameState, setUnameState] = useState<{ ok: boolean; msg: string } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  // Live username availability
  useEffect(() => {
    const uname = username.trim().toLowerCase();
    if (!uname) { setUnameState(null); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
      setUnameState({ ok: false, msg: "3–20 characters: letters, numbers or underscores." });
      return;
    }
    let alive = true;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await checkUsernamePublic({ data: { username: uname } });
        if (alive) setUnameState({ ok: res.available, msg: res.available ? "Available" : (res.reason ?? "Taken") });
      } catch {
        if (alive) setUnameState(null);
      } finally {
        if (alive) setChecking(false);
      }
    }, 400);
    return () => { alive = false; clearTimeout(t); setChecking(false); };
  }, [username]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const uname = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
      toast.error("Pick a username with 3–20 letters, numbers or underscores.");
      return;
    }
    if (unameState && !unameState.ok) {
      toast.error(unameState.msg);
      return;
    }
    setLoading(true);
    // Final server-side uniqueness check right before signup
    try {
      const check = await checkUsernamePublic({ data: { username: uname } });
      if (!check.available) {
        setLoading(false);
        setUnameState({ ok: false, msg: check.reason ?? "That username is taken." });
        toast.error(check.reason ?? "That username is taken.");
        return;
      }
    } catch {
      /* fall through — the trigger keeps usernames unique */
    }

    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    const full_name = String(fd.get("full_name")).trim();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: { full_name, username: uname },
      },
    });

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. Check your email to verify — you can start practising right away.");
    setTab("signin");
  };



  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 font-bold text-2xl mb-6">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </span>
          ReadMe
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-5">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="si-pw">Password</Label>
                  <Input id="si-pw" name="password" type="password" required autoComplete="current-password" minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Sign in
                </Button>
                <p className="text-center text-sm">
                  <Link to="/forgot-password" className="text-muted-foreground hover:text-primary">
                    Forgot your password?
                  </Link>
                </p>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-5">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="su-name">Full name</Label>
                  <Input id="su-name" name="full_name" required minLength={2} maxLength={120} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-username">Username</Label>
                  <Input
                    id="su-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                    placeholder="e.g. ada_101"
                    autoComplete="username"
                    required
                  />
                  {checking ? (
                    <p className="text-xs text-muted-foreground">Checking availability…</p>
                  ) : unameState ? (
                    <p className={`text-xs ${unameState.ok ? "text-success" : "text-destructive"}`}>{unameState.msg}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">3–20 characters: letters, numbers or underscores.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-pw">Password</Label>
                  <Input id="su-pw" name="password" type="password" required minLength={6} autoComplete="new-password" />
                </div>
                <p className="text-xs text-muted-foreground">
                  We'll ask for your school, faculty, department and level right after you verify your email.
                </p>


                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          <Link to="/" className="hover:text-primary">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
