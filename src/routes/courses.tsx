import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Loader2, Search, Filter, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { listCoursesPublic } from "@/lib/courses.functions";
import { listMyBookmarkIds, toggleBookmark } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";
import { SchoolDepartmentPicker } from "@/components/SchoolDepartmentPicker";

export const Route = createFileRoute("/courses")({
  head: () => ({
    meta: [
      { title: "Browse courses — ReadMe" },
      { name: "description", content: "Find your course and start timed practice from its question bank." },
    ],
  }),
  component: CoursesPage,
});

function CoursesPage() {
  const fn = useServerFn(listCoursesPublic);
  const bookmarksFn = useServerFn(listMyBookmarkIds);
  const toggleFn = useServerFn(toggleBookmark);
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ q: "", school: "", department: "", level: "" });
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["courses-public", filters],
    queryFn: () => fn({ data: filters }),
  });

  const { data: bookmarkIds } = useQuery({
    queryKey: ["my-bookmark-ids"],
    queryFn: () => bookmarksFn(),
    enabled: signedIn,
  });
  const bookmarked = new Set(bookmarkIds ?? []);

  const toggleMut = useMutation({
    mutationFn: (courseId: string) => toggleFn({ data: { courseId } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-bookmark-ids"] });
      qc.invalidateQueries({ queryKey: ["my-bookmarks"] });
      toast.success(res.bookmarked ? "Saved" : "Removed from saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-6xl">
        <h1 className="text-3xl font-bold tracking-tight">Browse courses</h1>
        <p className="text-muted-foreground mt-1">Search by your school, department, level, or course code.</p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-4 grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search code or title…" value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-3">
            <SchoolDepartmentPicker
              schoolValue={filters.school}
              departmentValue={filters.department}
              onSchoolChange={(v) => setFilters((f) => ({ ...f, school: v }))}
              onDepartmentChange={(v) => setFilters((f) => ({ ...f, department: v }))}
              includeEmpty={{ label: "Any" }}
              layout="grid"
            />
          </div>
          <Input placeholder="Level (100, 200…)" value={filters.level} onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))} />
        </div>


        <div className="mt-6">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (data?.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No courses match your filters yet.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data!.map((c) => {
                const isSaved = bookmarked.has(c.id);
                return (
                  <div key={c.id} className="rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <BookOpen className="h-5 w-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs text-muted-foreground">{c.code}</div>
                        <h3 className="font-semibold">{c.title}</h3>
                        {c.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                          {c.school && <Tag>{c.school}</Tag>}
                          {c.department && <Tag>{c.department}</Tag>}
                          {c.level && <Tag>Level {c.level}</Tag>}
                          <Tag>{c.questionCount} questions</Tag>
                        </div>
                      </div>
                      {signedIn && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={isSaved ? "Remove from saved" : "Save course"}
                          onClick={() => toggleMut.mutate(c.id)}
                          disabled={toggleMut.isPending}
                        >
                          <Star className={`h-5 w-5 ${isSaved ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                        </Button>
                      )}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Link to="/practice/$courseId" params={{ courseId: c.id }}>
                        <Button size="sm" disabled={c.questionCount === 0}>
                          {c.questionCount === 0 ? "No questions yet" : "Start practice"}
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{children}</span>;
}
