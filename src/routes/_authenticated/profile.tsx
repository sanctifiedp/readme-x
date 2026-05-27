import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Loader2, Trash2, AlertTriangle, KeyRound, Bookmark } from "lucide-react";
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
import { getMyProfile, updateMyProfile, deleteMyAccount, listMyBookmarks } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — ReadMe" },
      { name: "description", content: "Manage your ReadMe profile, password, saved courses, and account." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchBookmarks = useServerFn(listMyBookmarks);
  const updateFn = useServerFn(updateMyProfile);
  const deleteFn = useServerFn(deleteMyAccount);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const { data: bookmarks } = useQuery({
    queryKey: ["my-bookmarks"],
    queryFn: () => fetchBookmarks(),
  });

  const [form, setForm] = useState({
    full_name: "",
    matric_no: "",
    school: "",
    department: "",
    level: "",
  });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        matric_no: profile.matric_no ?? "",
        school: profile.school ?? "",
        department: profile.department ?? "",
        level: profile.level ?? "",
      });
    }
  }, [profile]);

  const saveMut = useMutation({
    mutationFn: (data: typeof form) => updateFn({ data }),
    onSuccess: () => {
      toast.success("Profile updated");
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
    setPw({ current: "", next: "", confirm: "" });
    toast.success("Password updated");
  };

  const handleDelete = async () => {
    if (confirmText !== "DELETE") {
      toast.error('Type DELETE to confirm');
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
      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Your profile</h1>
          <p className="text-muted-foreground text-sm mt-1">{profile?.email}</p>
        </div>

        {/* Profile details */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Details</h2>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); saveMut.mutate(form); }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="matric_no">Matric / Student no.</Label>
                  <Input id="matric_no" value={form.matric_no}
                    onChange={(e) => setForm((f) => ({ ...f, matric_no: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="level">Level</Label>
                  <Input id="level" value={form.level}
                    onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="school">School</Label>
                <Input id="school" value={form.school}
                  onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="department">Department</Label>
                <Input id="department" value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
              </div>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save changes
              </Button>
            </form>
          )}
        </section>

        {/* Change password */}
        <section className="rounded-2xl border border-border bg-card p-6">
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
            <Button type="submit" disabled={busy} variant="outline">Update password</Button>
          </form>
        </section>

        {/* Bookmarks */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Bookmark className="h-5 w-5" /> Saved courses</h2>
          {!bookmarks || bookmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground">You haven't saved any courses yet. Tap the star on any course to save it.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {bookmarks.map((c) => (
                <Link key={c.id} to="/practice/$courseId" params={{ courseId: c.id }}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-primary transition">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-muted-foreground">{c.code}</div>
                    <div className="font-medium truncate text-sm">{c.title}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Danger zone */}
        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Danger zone
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Permanently delete your account, profile, exam history, bookmarks, and messages. This cannot be undone.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
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
