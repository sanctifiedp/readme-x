import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Plus, Sparkles, Upload, Users, FileText, ShieldCheck, Heart, Check, X,
  Trash2, ExternalLink, BookOpen, MessageSquare, Archive, ArchiveRestore,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { SiteHeader } from "@/components/SiteHeader";
import { adminDashboard, uploadMaterial, generateQuestions, promoteToAdmin, revokeAdmin, getMyRoles, createCourse } from "@/lib/admin.functions";
import { createCourseFull, deleteCourse } from "@/lib/courses.functions";
import { listPendingDonations, decideDonation } from "@/lib/donations.functions";
import { listNotes, createNote, deleteNote } from "@/lib/notes.functions";
import { listRooms, createRoom, updateRoom, deleteRoom } from "@/lib/chat.functions";
import {
  listSchools, listDepartments, createSchool, updateSchool, deleteSchool,
  createDepartment, updateDepartment, deleteDepartment,
} from "@/lib/lookups.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — ReadMe" }] }),
  component: AdminPage,
});

function AdminPage() {
  const fetchAdmin = useServerFn(adminDashboard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"], queryFn: () => fetchAdmin(), retry: false,
  });

  if (isLoading) return <Center><Loader2 className="h-6 w-6 animate-spin text-primary" /></Center>;
  if (error) return <Center><span className="text-destructive">{(error as Error).message}</span></Center>;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-3xl font-bold">Admin panel</h1>
            <p className="text-sm text-muted-foreground">Manage exams, courses, notes, and donations.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Stat icon={Users} label="Students" value={data?.studentCount ?? 0} />
          <Stat icon={FileText} label="Courses" value={data?.courses.length ?? 0} />
          <Stat icon={Sparkles} label="Submitted attempts" value={data?.attemptCount ?? 0} />
        </div>

        <Tabs defaultValue="courses">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="courses">Course banks</TabsTrigger>
            <TabsTrigger value="ai">AI generation</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="chat">Chat rooms</TabsTrigger>
            <TabsTrigger value="lookups">Schools & Departments</TabsTrigger>
            <TabsTrigger value="donations">Donations</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="settings">AI settings</TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="mt-4"><CourseBanksTab courses={data?.courses ?? []} /></TabsContent>
          <TabsContent value="ai" className="mt-4"><CoursesTab courses={data?.courses ?? []} /></TabsContent>
          <TabsContent value="notes" className="mt-4"><NotesTab /></TabsContent>
          <TabsContent value="chat" className="mt-4"><ChatRoomsTab /></TabsContent>
          <TabsContent value="lookups" className="mt-4"><LookupsTab /></TabsContent>
          <TabsContent value="donations" className="mt-4"><DonationsTab /></TabsContent>
          <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
          <TabsContent value="settings" className="mt-4"><AISettingsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center">{children}</div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

/* ─── Course banks tab ───────────────────────────────── */

function CourseBanksTab({ courses }: { courses: AdminCourse[] }) {
  const createFn = useServerFn(createCourseFull);
  const delFn = useServerFn(deleteCourse);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-dashboard"] });

  const createMut = useMutation({
    mutationFn: (d: { code: string; title: string; description?: string; school?: string; department?: string; level?: string }) =>
      createFn({ data: d }),
    onSuccess: () => { toast.success("Course created"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Course deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Course question banks</h2>
        <CreateCourseFullDialog onSubmit={(d) => createMut.mutate(d)} pending={createMut.isPending} />
      </div>
      {courses.length === 0 ? (
        <Empty>No courses yet. Create one — each course holds up to 500 questions.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {courses.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">{c.code}</div>
                  <div className="font-semibold">{c.title}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{c.questionCount} / 500 questions</div>
                </div>
                <div className="flex flex-col gap-2">
                  <Link
                    to="/admin/course/$courseId"
                    params={{ courseId: c.id }}
                    className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    Edit questions
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this course and all its questions?")) delMut.mutate(c.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateCourseFullDialog({ onSubmit, pending }: { onSubmit: (d: { code: string; title: string; description?: string; school?: string; department?: string; level?: string }) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New course</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create course</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onSubmit({
              code: String(fd.get("code")),
              title: String(fd.get("title")),
              description: String(fd.get("description") ?? "") || undefined,
              school: String(fd.get("school") ?? "") || undefined,
              department: String(fd.get("department") ?? "") || undefined,
              level: String(fd.get("level") ?? "") || undefined,
            });
            setOpen(false);
          }}
          className="space-y-3"
        >
          <Field label="Course code" name="code" placeholder="CSC101" required />
          <Field label="Title" name="title" required />
          <div className="space-y-1.5"><Label htmlFor="d2">Description</Label><Textarea id="d2" name="description" rows={2} /></div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="School" name="school" />
            <Field label="Department" name="department" />
            <Field label="Level" name="level" />
          </div>
          <DialogFooter><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AISettingsTab() {
  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 space-y-2">
        <h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI hints</h2>
        <p className="text-sm text-muted-foreground">
          Hints are powered by Lovable AI — no setup required. Each question's hint is generated on first request and cached.
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-border p-5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary"><Sparkles className="h-3.5 w-3.5" /></span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Coming soon</span>
        </div>
        <h3 className="font-semibold">Grok AI integration</h3>
        <p className="text-sm text-muted-foreground">A future release will let you bring your own Grok API key to power deeper explanations and study summaries.</p>
        <div className="space-y-1.5 pt-2">
          <Label htmlFor="grok-key">Grok API key</Label>
          <Input id="grok-key" placeholder="grok-…" disabled />
          <p className="text-xs text-muted-foreground">Not active yet — placeholder for the upcoming integration.</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Courses tab (AI generation) ─────────────────────── */

type AdminCourse = { id: string; code: string; title: string; description: string | null; questionCount: number; materials: { id: string; title: string; createdAt: string }[] };

function CoursesTab({ courses }: { courses: AdminCourse[] }) {
  const createFn = useServerFn(createCourse);
  const uploadFn = useServerFn(uploadMaterial);
  const genFn = useServerFn(generateQuestions);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-dashboard"] });

  const createMut = useMutation({
    mutationFn: (d: { code: string; title: string; description: string }) => createFn({ data: d }),
    onSuccess: () => { toast.success("Course created"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const genMut = useMutation({
    mutationFn: (d: { materialId: string; count: number }) => genFn({ data: d }),
    onSuccess: (res) => { toast.success(`Generated ${res.inserted} questions`); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const uploadMut = useMutation({
    mutationFn: (d: { courseId: string; title: string; content: string }) => uploadFn({ data: d }),
    onSuccess: (res) => { toast.success("Material uploaded. Generating…"); genMut.mutate({ materialId: res.id, count: 20 }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Courses (AI question generation)</h2>
        <CreateCourseDialog onSubmit={(d) => createMut.mutate(d)} pending={createMut.isPending} />
      </div>
      {courses.length === 0 ? (
        <Empty>No courses yet.</Empty>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">{c.code}</div>
                  <div className="font-semibold">{c.title}</div>
                  {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
                  <div className="mt-2 text-xs text-muted-foreground">{c.questionCount} questions · {c.materials.length} materials</div>
                </div>
                <UploadMaterialDialog
                  courseId={c.id} courseCode={c.code}
                  onSubmit={(d) => uploadMut.mutate(d)}
                  pending={uploadMut.isPending || genMut.isPending}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateCourseDialog({ onSubmit, pending }: { onSubmit: (d: { code: string; title: string; description: string }) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-1" /> New course</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create course</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onSubmit({ code: String(fd.get("code")), title: String(fd.get("title")), description: String(fd.get("description") ?? "") });
            setOpen(false);
          }}
          className="space-y-3"
        >
          <Field label="Course code" name="code" placeholder="CSC101" required />
          <Field label="Title" name="title" required />
          <div className="space-y-1.5"><Label htmlFor="d">Description</Label><Textarea id="d" name="description" rows={3} /></div>
          <DialogFooter><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UploadMaterialDialog({ courseId, courseCode, onSubmit, pending }: { courseId: string; courseCode: string; onSubmit: (d: { courseId: string; title: string; content: string }) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1" /> Upload material</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Upload material for {courseCode}</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onSubmit({ courseId, title: String(fd.get("title")), content: String(fd.get("content")) });
            setOpen(false);
          }}
          className="space-y-3"
        >
          <Field label="Material title" name="title" required />
          <div className="space-y-1.5"><Label htmlFor="c">Paste material text</Label><Textarea id="c" name="content" rows={10} required minLength={50} /></div>
          <DialogFooter><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Upload & generate</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Notes tab ───────────────────────────────────────── */

function NotesTab() {
  const fn = useServerFn(listNotes);
  const createFn = useServerFn(createNote);
  const delFn = useServerFn(deleteNote);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-notes"], queryFn: () => fn({ data: {} }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-notes"] });

  const [uploading, setUploading] = useState(false);

  const createMut = useMutation({
    mutationFn: (d: { title: string; description?: string; school?: string; department?: string; level?: string; courseCode?: string; link?: string; filePath?: string }) => createFn({ data: d }),
    onSuccess: () => { toast.success("Note added"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file") as File | null;
    let filePath: string | undefined;
    if (file && file.size > 0) {
      setUploading(true);
      const ext = file.name.split(".").pop() || "bin";
      const path = `notes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("notes").upload(path, file, { contentType: file.type });
      setUploading(false);
      if (error) { toast.error(error.message); return; }
      filePath = path;
    }
    createMut.mutate({
      title: String(fd.get("title")),
      description: String(fd.get("description") ?? "") || undefined,
      school: String(fd.get("school") ?? "") || undefined,
      department: String(fd.get("department") ?? "") || undefined,
      level: String(fd.get("level") ?? "") || undefined,
      courseCode: String(fd.get("courseCode") ?? "") || undefined,
      link: String(fd.get("link") ?? "") || undefined,
      filePath,
    });
    form.reset();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-semibold">Add a note</h2>
        <Field label="Title" name="title" required />
        <div className="space-y-1.5"><Label htmlFor="nd">Description</Label><Textarea id="nd" name="description" rows={2} /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="School" name="school" />
          <Field label="Department" name="department" />
          <Field label="Level" name="level" />
          <Field label="Course code" name="courseCode" />
        </div>
        <Field label="External link (optional)" name="link" type="url" placeholder="https://…" />
        <div className="space-y-1.5">
          <Label htmlFor="file">Or upload file</Label>
          <Input id="file" name="file" type="file" />
        </div>
        <Button type="submit" disabled={createMut.isPending || uploading}>
          {(createMut.isPending || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Add note
        </Button>
      </form>

      <div className="grid gap-2">
        {(data ?? []).map((n) => (
          <div key={n.id} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium truncate">{n.title}</div>
              <div className="text-xs text-muted-foreground">
                {[n.school, n.department, n.level && `Level ${n.level}`, n.courseCode].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="flex gap-2">
              {n.link && <a href={n.link} target="_blank" rel="noreferrer" className="text-primary"><ExternalLink className="h-4 w-4" /></a>}
              {n.fileUrl && <a href={n.fileUrl} target="_blank" rel="noreferrer" className="text-primary"><FileText className="h-4 w-4" /></a>}
              <button onClick={() => { if (confirm("Delete?")) delMut.mutate(n.id); }}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Donations tab ──────────────────────────────────── */

function DonationsTab() {
  const fn = useServerFn(listPendingDonations);
  const decideFn = useServerFn(decideDonation);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-donations"], queryFn: () => fn() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-donations"] });

  const mut = useMutation({
    mutationFn: (d: { id: string; decision: "approved" | "rejected" }) => decideFn({ data: d }),
    onSuccess: () => { toast.success("Updated"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (data ?? []).filter((d) => d.status === "pending");
  const others = (data ?? []).filter((d) => d.status !== "pending");

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><Heart className="h-4 w-4 text-primary" /> Pending approval ({pending.length})</h2>
        {pending.length === 0 ? (
          <Empty>No donations awaiting review.</Empty>
        ) : (
          <div className="space-y-2">
            {pending.map((d) => (
              <div key={d.id} className="rounded-lg border border-border bg-card p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{d.donor_name} · <span className="text-primary">₦{Number(d.amount).toLocaleString()}</span></div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {d.reference && <>Ref: {d.reference} · </>}
                    {new Date(d.created_at).toLocaleString()}
                  </div>
                  {d.message && <p className="text-sm mt-1 text-muted-foreground">"{d.message}"</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => mut.mutate({ id: d.id, decision: "approved" })} disabled={mut.isPending}><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: d.id, decision: "rejected" })} disabled={mut.isPending}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Recently decided</h2>
          <div className="space-y-1 text-sm">
            {others.slice(0, 20).map((d) => (
              <div key={d.id} className="flex justify-between border-b border-border/40 py-1.5">
                <span>{d.donor_name} · ₦{Number(d.amount).toLocaleString()}</span>
                <span className={d.status === "approved" ? "text-primary" : "text-muted-foreground"}>{d.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── Users tab ────────────────────────────────────── */

function UsersTab() {
  const rolesFn = useServerFn(getMyRoles);
  const promoteFn = useServerFn(promoteToAdmin);
  const revokeFn = useServerFn(revokeAdmin);
  const { data: roles, isLoading } = useQuery({ queryKey: ["my-roles"], queryFn: () => rolesFn() });

  const promoteMut = useMutation({
    mutationFn: (email: string) => promoteFn({ data: { email } }),
    onSuccess: () => toast.success("User promoted to admin"),
    onError: (e: Error) => toast.error(e.message),
  });
  const revokeMut = useMutation({
    mutationFn: (email: string) => revokeFn({ data: { email } }),
    onSuccess: () => toast.success("Admin role revoked"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  if (!roles?.isSuperAdmin) {
    return <Empty>Only the super admin can promote or revoke admins.</Empty>;
  }

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h2 className="text-lg font-semibold mb-2">Promote to admin</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            promoteMut.mutate(String(fd.get("email")));
            (e.target as HTMLFormElement).reset();
          }}
        >
          <Input name="email" type="email" placeholder="user@email.com" required />
          <Button type="submit" disabled={promoteMut.isPending}>
            {promoteMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Promote
          </Button>
        </form>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-2">Revoke admin</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (!confirm(`Revoke admin from ${fd.get("email")}?`)) return;
            revokeMut.mutate(String(fd.get("email")));
            (e.target as HTMLFormElement).reset();
          }}
        >
          <Input name="email" type="email" placeholder="user@email.com" required />
          <Button type="submit" variant="outline" disabled={revokeMut.isPending}>
            {revokeMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Revoke
          </Button>
        </form>
      </div>
    </div>
  );
}

/* ─── Chat rooms tab ─────────────────────────────────── */

function ChatRoomsTab() {
  const listFn = useServerFn(listRooms);
  const createFn = useServerFn(createRoom);
  const updateFn = useServerFn(updateRoom);
  const delFn = useServerFn(deleteRoom);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-rooms"], queryFn: () => listFn() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-rooms"] });

  const createMut = useMutation({
    mutationFn: (d: { name: string; description?: string }) => createFn({ data: d }),
    onSuccess: () => { toast.success("Room created"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (d: { id: string; name?: string; description?: string; isArchived?: boolean }) => updateFn({ data: d }),
    onSuccess: () => { toast.success("Updated"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Room deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          createMut.mutate({
            name: String(fd.get("name")),
            description: String(fd.get("description") ?? "") || undefined,
          });
          (e.target as HTMLFormElement).reset();
        }}
        className="rounded-xl border border-border bg-card p-4 grid gap-2 md:grid-cols-[1fr_2fr_auto]"
      >
        <Input name="name" placeholder="Room name" required maxLength={80} />
        <Input name="description" placeholder="Description (optional)" maxLength={300} />
        <Button type="submit" disabled={createMut.isPending}>
          {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Create</>}
        </Button>
      </form>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : (data?.length ?? 0) === 0 ? (
        <Empty>No chat rooms yet.</Empty>
      ) : (
        <div className="grid gap-2">
          {data!.map((r) => {
            const isDefault = r.id === "00000000-0000-0000-0000-000000000001";
            return (
              <div key={r.id} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {r.name}
                      {r.is_archived && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">archived</span>}
                      {isDefault && <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">default</span>}
                    </div>
                    {r.description && <div className="text-xs text-muted-foreground truncate">{r.description}</div>}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => updateMut.mutate({ id: r.id, isArchived: !r.is_archived })}
                    disabled={updateMut.isPending}
                  >
                    {r.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => {
                      const name = prompt("New room name", r.name);
                      if (name && name.trim().length >= 2) updateMut.mutate({ id: r.id, name: name.trim() });
                    }}
                  >
                    Rename
                  </Button>
                  {!isDefault && (
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { if (confirm("Delete this room? All messages will be removed.")) delMut.mutate(r.id); }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Utilities ───────────────────────────────────── */

function Field({ label, name, ...props }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">{children}</div>;
}

/* ─── Schools & Departments tab ───────────────────────── */

function LookupsTab() {
  const qc = useQueryClient();
  const listSch = useServerFn(listSchools);
  const listDep = useServerFn(listDepartments);
  const createSch = useServerFn(createSchool);
  const updateSch = useServerFn(updateSchool);
  const deleteSch = useServerFn(deleteSchool);
  const createDep = useServerFn(createDepartment);
  const updateDep = useServerFn(updateDepartment);
  const deleteDep = useServerFn(deleteDepartment);

  const { data: schoolsData } = useQuery({ queryKey: ["schools"], queryFn: () => listSch() });
  const { data: depsData } = useQuery({ queryKey: ["departments"], queryFn: () => listDep({ data: {} }) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["schools"] });
    qc.invalidateQueries({ queryKey: ["departments"] });
  };

  const [newSchool, setNewSchool] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [newDept, setNewDept] = useState("");

  const addSch = useMutation({
    mutationFn: (name: string) => createSch({ data: { name } }),
    onSuccess: () => { toast.success("School added"); setNewSchool(""); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const renameSch = useMutation({
    mutationFn: (v: { id: string; name: string }) => updateSch({ data: v }),
    onSuccess: () => { toast.success("Renamed"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delSch = useMutation({
    mutationFn: (id: string) => deleteSch({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const addDep = useMutation({
    mutationFn: (v: { schoolId: string; name: string }) => createDep({ data: v }),
    onSuccess: () => { toast.success("Department added"); setNewDept(""); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const renameDep = useMutation({
    mutationFn: (v: { id: string; name: string }) => updateDep({ data: v }),
    onSuccess: () => { toast.success("Renamed"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delDep = useMutation({
    mutationFn: (id: string) => deleteDep({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const schools = schoolsData?.schools ?? [];
  const departments = depsData?.departments ?? [];

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h2 className="font-semibold">Schools</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); if (newSchool.trim()) addSch.mutate(newSchool.trim()); }}
          className="flex gap-2"
        >
          <Input value={newSchool} onChange={(e) => setNewSchool(e.target.value)} placeholder="School name" />
          <Button type="submit" disabled={addSch.isPending || !newSchool.trim()}>Add</Button>
        </form>
        <div className="space-y-1.5">
          {schools.length === 0 && <Empty>No schools yet.</Empty>}
          {schools.map((s) => (
            <div key={s.id} className={`flex items-center gap-2 rounded-md border p-2 ${selectedSchool === s.id ? "border-primary" : "border-border"}`}>
              <button onClick={() => setSelectedSchool(s.id)} className="flex-1 text-left text-sm">{s.name}</button>
              <Button size="sm" variant="ghost" onClick={() => {
                const v = prompt("Rename school", s.name);
                if (v && v.trim() && v !== s.name) renameSch.mutate({ id: s.id, name: v.trim() });
              }}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete school?")) delSch.mutate(s.id); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">
          Departments {selectedSchool ? `· ${schools.find((s) => s.id === selectedSchool)?.name}` : ""}
        </h2>
        {!selectedSchool ? (
          <Empty>Select a school on the left to manage its departments.</Empty>
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newDept.trim()) addDep.mutate({ schoolId: selectedSchool, name: newDept.trim() });
              }}
              className="flex gap-2"
            >
              <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Department name" />
              <Button type="submit" disabled={addDep.isPending || !newDept.trim()}>Add</Button>
            </form>
            <div className="space-y-1.5">
              {departments.filter((d) => d.school_id === selectedSchool).length === 0 && <Empty>No departments yet.</Empty>}
              {departments.filter((d) => d.school_id === selectedSchool).map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                  <span className="flex-1 text-sm">{d.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => {
                    const v = prompt("Rename department", d.name);
                    if (v && v.trim() && v !== d.name) renameDep.mutate({ id: d.id, name: v.trim() });
                  }}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete department?")) delDep.mutate(d.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
