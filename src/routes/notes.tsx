import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Loader2, Search, ExternalLink, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { listNotes } from "@/lib/notes.functions";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Study notes — ReadMe" },
      { name: "description", content: "Browse and download study notes shared by admins." },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const fn = useServerFn(listNotes);
  const [filters, setFilters] = useState({ q: "", school: "", department: "", level: "" });
  const { data, isLoading } = useQuery({
    queryKey: ["notes", filters],
    queryFn: () => fn({ data: filters }),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-6xl">
        <h1 className="text-3xl font-bold tracking-tight">Study notes</h1>
        <p className="text-muted-foreground mt-1">Search by school, department, level, or course code.</p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-4 grid gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search…" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          </div>
          <Input placeholder="School" value={filters.school} onChange={(e) => setFilters((f) => ({ ...f, school: e.target.value }))} />
          <Input placeholder="Department" value={filters.department} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))} />
          <Input placeholder="Level" value={filters.level} onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))} />
        </div>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (data?.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
              No notes match your filters yet.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data!.map((n) => (
                <div key={n.id} className="rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{n.title}</h3>
                      {n.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                        {n.courseCode && <Tag>{n.courseCode}</Tag>}
                        {n.school && <Tag>{n.school}</Tag>}
                        {n.department && <Tag>{n.department}</Tag>}
                        {n.level && <Tag>Level {n.level}</Tag>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-sm">
                        {n.link && (
                          <a href={n.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            <ExternalLink className="h-3.5 w-3.5" /> Open link
                          </a>
                        )}
                        {n.fileUrl && (
                          <a href={n.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            <Download className="h-3.5 w-3.5" /> Download file
                          </a>
                        )}
                      </div>
                    </div>
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
