import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MailWarning, CheckCircle2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/SiteHeader";
import { SchoolDepartmentPicker } from "@/components/SchoolDepartmentPicker";
import { getMyProfile, updateMyProfile, checkUsernameAvailable } from "@/lib/account.functions";
import { useSessionUser } from "@/hooks/useSessionUser";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Complete your profile — ReadMe" },
      { name: "description", content: "Add your school, faculty, department and level so ReadMe can personalise your practice." },
      { property: "og:title", content: "Complete your profile — ReadMe" },
      { property: "og:description", content: "Finish setting up your ReadMe academic profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const session = useSessionUser();
  const profileFn = useServerFn(getMyProfile);
  const saveFn = useServerFn(updateMyProfile);
  const checkFn = useServerFn(checkUsernameAvailable);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => profileFn(),
  });

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [matric, setMatric] = useState("");
  const [school, setSchool] = useState("");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const [unameState, setUnameState] = useState<{ ok: boolean; msg: string } | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setUsername(profile.username ?? "");
    setMatric(profile.matric_no ?? "");
    setSchool(profile.school ?? "");
    setFaculty(profile.faculty ?? "");
    setDepartment(profile.department ?? "");
    setLevel(profile.level ?? "");
  }, [profile]);

  // Live username check when the profile has none yet
  useEffect(() => {
    const uname = username.trim().toLowerCase();
    if (!uname || uname === (profile?.username ?? "").toLowerCase()) { setUnameState(null); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
      setUnameState({ ok: false, msg: "3–20 characters: letters, numbers or underscores." });
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const res = await checkFn({ data: { username: uname } });
        if (alive) setUnameState({ ok: res.available, msg: res.available ? "Available" : (res.reason ?? "Taken") });
      } catch { /* ignore */ }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [username, profile?.username, checkFn]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          full_name: fullName.trim(),
          username: username.trim() ? username.trim().toLowerCase() : undefined,
          matric_no: matric.trim(),
          school: school.trim(),
          faculty: faculty.trim(),
          department: department.trim(),
          level: level.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Profile saved");
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resend = async () => {
    if (!session.email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: session.email,
      options: { emailRedirectTo: `${window.location.origin}/onboarding` },
    });
    setResending(false);
    if (error) toast.error(error.message);
    else toast.success("Verification email sent.");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col"><SiteHeader />
        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </div>
    );
  }

  const canSave =
    fullName.trim().length > 1 &&
    school.trim() && department.trim() && level.trim() &&
    (unameState === null || unameState.ok);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-primary" /> Complete your profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            We only need what's missing. This powers personalised courses, leaderboards and tournaments.
          </p>
        </div>

        <div className={`rounded-xl border p-4 text-sm flex items-start gap-2 ${
          session.verified ? "border-success/40 bg-success/10" : "border-primary/30 bg-primary/5"
        }`}>
          {session.verified
            ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
            : <MailWarning className="h-4 w-4 mt-0.5 text-primary shrink-0" />}
          <div className="flex-1">
            {session.verified ? (
              <span>Email verified — XP, badges, streaks and leaderboards are unlocked.</span>
            ) : (
              <span>
                Your email isn't verified yet. You can still browse and practise, but XP, badges,
                streaks, leaderboards and saved exam history stay locked until you confirm it.
              </span>
            )}
          </div>
          {!session.verified && (
            <button
              onClick={resend}
              disabled={resending}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 font-medium hover:bg-accent disabled:opacity-60"
            >
              {resending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Resend
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="ob-name">Full name</Label>
            <Input id="ob-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ob-username">Username</Label>
            <Input
              id="ob-username"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              placeholder="e.g. ada_101"
            />
            {unameState && (
              <p className={`text-xs ${unameState.ok ? "text-success" : "text-destructive"}`}>{unameState.msg}</p>
            )}
            <p className="text-xs text-muted-foreground">Your public profile: /u/{username.trim().toLowerCase() || "username"}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ob-matric">Matric / Student number</Label>
              <Input id="ob-matric" value={matric} onChange={(e) => setMatric(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-level">Level</Label>
              <Input id="ob-level" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="100" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ob-faculty">Faculty</Label>
            <Input id="ob-faculty" value={faculty} onChange={(e) => setFaculty(e.target.value)} placeholder="e.g. Science" />
          </div>

          <SchoolDepartmentPicker
            schoolValue={school}
            departmentValue={department}
            onSchoolChange={setSchool}
            onDepartmentChange={setDepartment}
          />

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save and continue
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/courses">Skip for now</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
