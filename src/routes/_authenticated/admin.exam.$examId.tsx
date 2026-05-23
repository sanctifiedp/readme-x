import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SiteHeader } from "@/components/SiteHeader";
import { getExamForAdmin, addExamQuestion, deleteExamQuestion } from "@/lib/exams.functions";

export const Route = createFileRoute("/_authenticated/admin/exam/$examId")({
  head: () => ({ meta: [{ title: "Edit exam — ReadMe" }] }),
  component: ExamEditor,
});

function ExamEditor() {
  const { examId } = Route.useParams();
  const getFn = useServerFn(getExamForAdmin);
  const addFn = useServerFn(addExamQuestion);
  const delFn = useServerFn(deleteExamQuestion);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-exam", examId],
    queryFn: () => getFn({ data: { examId } }),
    retry: false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-exam", examId] });

  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);

  const addMut = useMutation({
    mutationFn: (d: { prompt: string }) =>
      addFn({ data: { examId, prompt: d.prompt, options, correctIndex: correct } }),
    onSuccess: () => {
      toast.success("Question added");
      setOptions(["", "", "", ""]);
      setCorrect(0);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return (
    <div className="min-h-screen flex flex-col"><SiteHeader />
      <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex flex-col"><SiteHeader />
      <div className="flex-1 flex items-center justify-center text-destructive">{(error as Error).message}</div>
    </div>
  );

  const remaining = data!.max - data!.questions.length;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <Link to="/_authenticated/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to admin
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{data!.exam.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data!.questions.length} / {data!.max} questions · {remaining} slots remaining
          </p>
        </div>

        {remaining > 0 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const prompt = String(fd.get("prompt"));
              if (options.some((o) => !o.trim())) { toast.error("All 4 options required"); return; }
              addMut.mutate({ prompt });
              (e.target as HTMLFormElement).reset();
            }}
            className="rounded-xl border border-border bg-card p-5 space-y-3"
          >
            <h2 className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Add question</h2>
            <div className="space-y-1.5">
              <Label htmlFor="prompt">Question</Label>
              <Textarea id="prompt" name="prompt" rows={2} required minLength={3} />
            </div>
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setCorrect(i)}
                  className={`h-8 w-8 rounded-md border flex items-center justify-center shrink-0 ${
                    correct === i ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"
                  }`}
                  title="Mark as correct"
                >
                  {correct === i ? <Check className="h-4 w-4" /> : String.fromCharCode(65 + i)}
                </button>
                <Input
                  value={opt}
                  onChange={(e) => setOptions((o) => o.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  required
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Click a letter to mark the correct option.</p>
            <Button type="submit" disabled={addMut.isPending}>
              {addMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add question
            </Button>
          </form>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            This exam is at the 90-question maximum.
          </div>
        )}

        <div className="space-y-2">
          <h2 className="font-semibold">Questions ({data!.questions.length})</h2>
          {data!.questions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No questions yet.</div>
          ) : (
            data!.questions.map((q, idx) => (
              <div key={q.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Q{idx + 1}</div>
                    <div className="font-medium mt-1">{q.prompt}</div>
                    <ul className="mt-2 text-sm space-y-1">
                      {(q.options as string[]).map((o, i) => (
                        <li key={i} className={i === q.correct_index ? "text-primary font-medium" : "text-muted-foreground"}>
                          {String.fromCharCode(65 + i)}. {o} {i === q.correct_index && " ✓"}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button onClick={() => { if (confirm("Delete this question?")) delMut.mutate(q.id); }}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
