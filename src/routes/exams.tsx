import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Loader2, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { listExams } from "@/lib/exams.functions";

export const Route = createFileRoute("/exams")({
  head: () => ({
    meta: [
      { title: "Browse exams — ReadMe" },
      { name: "description", content: "Find and take CBT exams by school, department, and level." },
    ],
  }),
  component: ExamsPage,
});

function ExamsPage() {
  const fn = useServerFn(listExams);
  const [filters, setFilters] = useState({ q: "", school: "", department: "", level: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["exams", filters],
    queryFn: () => fn({ data: filters }),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-6xl">
        <h1 className="text-3xl font-bold tracking-tight">Browse exams</h1>
        <p className="text-muted-foreground mt-1">Search by your school, department, or level.</p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-4 grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search title…" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          </div>
          <Input placeholder="School" value={filters.school} onChange={(e) => setFilters((f) => ({ ...f, school: e.target.value }))} />
          <Input placeholder="Department" value={filters.department} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))} />
          <Input placeholder="Level (e.g. 100, 200)" value={filters.level} onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))} />
        </div>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (data?.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No exams match your filters yet.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data!.map((e) => (
                <div key={e.id} className="rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{e.title}</h3>
                      {e.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                        {e.school && <Tag>{e.school}</Tag>}
                        {e.department && <Tag>{e.department}</Tag>}
                        {e.level && <Tag>Level {e.level}</Tag>}
                        <Tag>{e.questionCount} questions</Tag>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Link to="/take/$examId" params={{ examId: e.id }}>
                      <Button size="sm" disabled={e.questionCount === 0}>
                        {e.questionCount === 0 ? "No questions yet" : "Take exam"}
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
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
