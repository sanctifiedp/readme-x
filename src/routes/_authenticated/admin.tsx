import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Upload, Users, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { SiteHeader } from "@/components/SiteHeader";
import { adminDashboard, createCourse, uploadMaterial, generateQuestions, promoteToAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — ReadMe" }] }),
  component: AdminPage,
});

function AdminPage() {
  const fetchAdmin = useServerFn(adminDashboard);
  const createFn = useServerFn(createCourse);
  const uploadFn = useServerFn(uploadMaterial);
  const genFn = useServerFn(generateQuestions);
  const promoteFn = useServerFn(promoteToAdmin);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => fetchAdmin(),
    retry: false,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-dashboard"] });

  const createMut = useMutation({
    mutationFn: (d: { code: string; title: string; description: string }) => createFn({ data: d }),
    onSuccess: () => { toast.success("Course created"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const uploadMut = useMutation({
    mutationFn: (d: { courseId: string; title: string; content: string }) => uploadFn({ data: d }),
    onSuccess: (res) => {
      toast.success("Material uploaded. Generating questions…");
      genMut.mutate({ materialId: res.id, count: 20 });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const genMut = useMutation({
    mutationFn: (d: { materialId: string; count: number }) => genFn({ data: d }),
    onSuccess: (res) => { toast.success(`Generated ${res.inserted} questions`); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const promoteMut = useMutation({
    mutationFn: (email: string) => promoteFn({ data: { email } }),
    onSuccess: () => toast.success("User promoted to admin"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center text-destructive">
          {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-3xl font-bold">Admin panel</h1>
            <p className="text-sm text-muted-foreground">Manage courses, upload material, generate questions.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Stat icon={Users} label="Students" value={data?.studentCount ?? 0} />
          <Stat icon={FileText} label="Courses" value={data?.courses.length ?? 0} />
          <Stat icon={Sparkles} label="Submitted attempts" value={data?.attemptCount ?? 0} />
        </div>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Courses</h2>
            <CreateCourseDialog onSubmit={(d) => createMut.mutate(d)} pending={createMut.isPending} />
          </div>

          {data?.courses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              No courses yet. Create your first one.
            </div>
          ) : (
            <div className="space-y-3">
              {data?.courses.map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-muted-foreground">{c.code}</div>
                      <div className="font-semibold">{c.title}</div>
                      {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
                      <div className="mt-2 text-xs text-muted-foreground">
                        {c.questionCount} questions · {c.materials.length} materials
                      </div>
                    </div>
                    <UploadMaterialDialog
                      courseId={c.id}
                      courseCode={c.code}
                      onSubmit={(d) => uploadMut.mutate(d)}
                      pending={uploadMut.isPending || genMut.isPending}
                    />
                  </div>
                  {c.materials.length > 0 && (
                    <ul className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground space-y-1">
                      {c.materials.map((m) => (
                        <li key={m.id} className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5" />
                          <span>{m.title}</span>
                          <span className="text-xs opacity-70">· {new Date(m.createdAt).toLocaleDateString()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Promote a user to admin</h2>
          <form
            className="flex gap-2 max-w-md"
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
        </section>
      </main>
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

function CreateCourseDialog({ onSubmit, pending }: { onSubmit: (d: { code: string; title: string; description: string }) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" /> New course</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create a course</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onSubmit({
              code: String(fd.get("code")),
              title: String(fd.get("title")),
              description: String(fd.get("description") ?? ""),
            });
            setOpen(false);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="code">Course code</Label>
            <Input id="code" name="code" placeholder="CSC101" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UploadMaterialDialog({
  courseId, courseCode, onSubmit, pending,
}: { courseId: string; courseCode: string; onSubmit: (d: { courseId: string; title: string; content: string }) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="h-4 w-4" /> Upload material
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload material for {courseCode}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onSubmit({
              courseId,
              title: String(fd.get("title")),
              content: String(fd.get("content")),
            });
            setOpen(false);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="m-title">Material title</Label>
            <Input id="m-title" name="title" placeholder="Chapter 1 — Introduction" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-content">Paste material text</Label>
            <Textarea id="m-content" name="content" rows={12} placeholder="Paste the course notes or chapter content here…" required minLength={50} />
            <p className="text-xs text-muted-foreground">
              <Sparkles className="inline h-3 w-3 mr-1" />
              AI will generate ~20 multiple-choice questions from this text.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload & generate questions
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
