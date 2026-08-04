import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, AlertTriangle, KeyRound, User, AtSign, Lock } from "lucide-react";
import { AvatarUploader } from "@/components/AvatarUploader";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyProfile,
  updateMyProfile,
  deleteMyAccount,
  checkUsernameAvailable,
} from "@/lib/account.functions";
import { SchoolDepartmentPicker } from "@/components/SchoolDepartmentPicker";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ReadMe" },
      { name: "description", content: "Manage your ReadMe account, username, academic details, and password." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const updateFn = useServerFn(updateMyProfile);
  const deleteFn = useServerFn(deleteMyAccount);
  const checkUsername = useServerFn(checkUsernameAvailable);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    
    matric_no: "",
    school: "",
    faculty: "",
    department: "",
    level: "",
  });
  const [usernameStatus, setUsernameStatus] = useState<{ checking: boolean; available?: boolean; reason?: string }>({ checking: false });
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const schoolLocked = !!profile?.schoolLock?.locked;
  const levelLocked = !!profile?.levelLock?.locked;
  const formatLockDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "";

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        username: profile.username ?? "",
        
        matric_no: profile.matric_no ?? "",
        school: profile.school ?? "",
        faculty: profile.faculty ?? "",
        department: profile.department ?? "",
        level: profile.level ?? "",
      });
    }
  }, [profile]);

  // Debounced username availability check
  useEffect(() => {
    if (!form.username || form.username === profile?.username) {
      setUsernameStatus({ checking: false });
      return;
    }
    setUsernameStatus({ checking: true });
    const t = setTimeout(async () => {
      try {
        const res = await checkUsername({ data: { username: form.username } });
        setUsernameStatus({ checking: false, available: res.available, reason: res.reason });
      } catch {
        setUsernameStatus({ checking: false });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.username, profile?.username, checkUsername]);

  const saveMut = useMutation({
    mutationFn: (data: typeof form) => updateFn({ data }),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next.length < 6) return toast.error("New password must be at least 6 characters");
    if (pw.next !== pw.confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPw({ next: "", confirm: "" });
    toast.success("Password updated");
  };

  const handleDelete = async () => {
    if (confirmText !== "DELETE") {
      toast.error("Type DELETE to confirm");
      return;
    }
    setBusy(true);
    try {
      await deleteFn({ data: { confirm: "DELETE" } });
      await supabase.auth.signOut();
      toast.success("Your account has been deleted");
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 sm:py-10 max-w-3xl space-y-6 sm:space-y-8">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1 break-words">{profile?.email}</p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <AvatarUploader
            currentUrl={profile?.avatar_url}
            name={profile?.full_name ?? profile?.username}
            hasAvatar={!!profile?.has_avatar}
          />
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><User className="h-5 w-5" /> Account</h2>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (form.username && usernameStatus.available === false) {
                  toast.error(usernameStatus.reason ?? "Username unavailable");
                  return;
                }
                saveMut.mutate(form);
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Display name</Label>
                <Input id="full_name" value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="username" className="flex items-center gap-1"><AtSign className="h-3.5 w-3.5" /> Username</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                  <Input id="username" value={form.username} className="pl-7"
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") }))}
                    placeholder="your_handle" maxLength={20} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {usernameStatus.checking && "Checking availability…"}
                  {!usernameStatus.checking && form.username && form.username !== profile?.username && usernameStatus.available === true && (
                    <span className="text-primary">@{form.username} is available.</span>
                  )}
                  {!usernameStatus.checking && usernameStatus.available === false && (
                    <span className="text-destructive">{usernameStatus.reason}</span>
                  )}
                  {(!form.username || form.username === profile?.username) && "3–20 letters, numbers, or underscores. Your public profile is /u/username."}
                </p>
              </div>




              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="matric_no">Matric / Student no.</Label>
                  <Input id="matric_no" value={form.matric_no}
                    onChange={(e) => setForm((f) => ({ ...f, matric_no: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="level">Academic Level *</Label>
                  <Input id="level" value={form.level} required placeholder="e.g. 200"
                    disabled={levelLocked}
                    onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} />
                  {levelLocked && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3" /> You can change your academic level again on{" "}
                      {formatLockDate(profile?.levelLock?.unlocksAt)}.
                    </p>
                  )}
                </div>
              </div>

              <SchoolDepartmentPicker
                schoolValue={form.school}
                departmentValue={form.department}
                onSchoolChange={(v) => setForm((f) => ({ ...f, school: v }))}
                onDepartmentChange={(v) => setForm((f) => ({ ...f, department: v }))}
                required
                schoolDisabled={schoolLocked}
                schoolHint={schoolLocked ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3" /> You can change your school again on{" "}
                    {formatLockDate(profile?.schoolLock?.unlocksAt)}.
                  </p>
                ) : undefined}
              />

              <div className="space-y-1.5">
                <Label htmlFor="faculty">Faculty / College (Optional)</Label>
                <Input id="faculty" value={form.faculty} placeholder="e.g. College of Science"
                  onChange={(e) => setForm((f) => ({ ...f, faculty: e.target.value }))} />
              </div>


              <Button type="submit" disabled={saveMut.isPending} className="w-full min-h-11 sm:w-auto">
                {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save changes
              </Button>
            </form>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><KeyRound className="h-5 w-5" /> Change password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div className="space-y-1.5">
              <Label htmlFor="next-pw">New password</Label>
              <Input id="next-pw" type="password" minLength={6} value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw">Confirm new password</Label>
              <Input id="confirm-pw" type="password" minLength={6} value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} required />
            </div>
            <Button type="submit" disabled={busy} variant="outline" className="w-full min-h-11 sm:w-auto">Update password</Button>
          </form>
        </section>

        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Danger zone
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Permanently delete your account, profile, exam history, bookmarks, and messages. This cannot be undone.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full min-h-11 gap-2 sm:w-auto">
                <Trash2 className="h-4 w-4" /> Delete my account
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes your profile and all related data. To confirm,
                  type <span className="font-mono font-semibold">DELETE</span> below.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy || confirmText !== "DELETE"}
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
