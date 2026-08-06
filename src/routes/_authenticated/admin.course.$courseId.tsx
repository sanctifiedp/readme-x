import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Plus, Trash2, Check, ImagePlus, X, ArrowUp, ArrowDown,
  Pencil, AlertTriangle, Columns,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SiteHeader } from "@/components/SiteHeader";
import { QuestionImage } from "@/components/QuestionImage";
import {
  getCourseBank, addCourseQuestion, deleteCourseQuestion,
  updateCourseQuestion, checkQuestionDuplicates,
} from "@/lib/courses.functions";
import { diffWords } from "@/lib/question-similarity";

export const Route = createFileRoute("/_authenticated/admin/course/$courseId")({
  head: () => ({ meta: [{ title: "Edit course bank — ReadMe" }] }),
  component: CourseBankEditor,
});

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";

/** Draft shape — `questionType` keeps room for future formats (true/false, matching, ...). */
interface Draft {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  questionType: "mcq_single";
  imageDataUrl: string | null;   // new upload
  existingImageUrl: string | null; // already stored (edit mode)
  removeImage: boolean;
}

const emptyDraft = (): Draft => ({
  prompt: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
  questionType: "mcq_single",
  imageDataUrl: null,
  existingImageUrl: null,
  removeImage: false,
});

function validate(d: Draft): string[] {
  const errs: string[] = [];
  if (d.prompt.trim().length < 3) errs.push("Question text is required (min 3 characters).");
  const filled = d.options.map((o) => o.trim());
  if (filled.length < MIN_OPTIONS) errs.push("At least 2 options are required.");
  if (filled.some((o) => !o)) errs.push("Every option needs text.");
  const lower = filled.map((o) => o.toLowerCase()).filter(Boolean);
  if (new Set(lower).size !== lower.length) errs.push("Options must be unique.");
  if (d.correctIndex < 0 || d.correctIndex >= d.options.length) errs.push("Select exactly one correct answer.");
  return errs;
}

type DupMatch = {
  id: string; prompt: string; options: string[]; correctIndex: number;
  explanation: string | null; imageUrl: string | null;
  similarity: number; promptSimilarity: number; optionsSimilarity: number; sameCorrectAnswer: boolean;
};

function CourseBankEditor() {
  const { courseId } = Route.useParams();
  const getFn = useServerFn(getCourseBank);
  const addFn = useServerFn(addCourseQuestion);
  const updateFn = useServerFn(updateCourseQuestion);
  const delFn = useServerFn(deleteCourseQuestion);
  const dupFn = useServerFn(checkQuestionDuplicates);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["course-bank", courseId],
    queryFn: () => getFn({ data: { courseId } }),
    retry: false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["course-bank", courseId] });

  const draftKey = `readme:qdraft:${courseId}`;
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dup, setDup] = useState<{ matches: DupMatch[] } | null>(null);
  const [compare, setCompare] = useState<DupMatch | null>(null);

  // Draft preservation while editing a new question (never for edit mode).
  useEffect(() => {
    const raw = localStorage.getItem(draftKey);
    if (raw) {
      try { setDraft({ ...emptyDraft(), ...JSON.parse(raw) }); } catch { /* ignore */ }
    }
  }, [draftKey]);
  useEffect(() => {
    if (editingId) return;
    const { imageDataUrl: _img, ...rest } = draft;
    localStorage.setItem(draftKey, JSON.stringify(rest));
  }, [draft, editingId, draftKey]);

  const errors = useMemo(() => validate(draft), [draft]);
  const valid = errors.length === 0;

  const resetEditor = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    localStorage.removeItem(draftKey);
  };

  const setOption = (i: number, v: string) =>
    setDraft((d) => ({ ...d, options: d.options.map((o, j) => (j === i ? v : o)) }));

  const addOption = () =>
    setDraft((d) => (d.options.length >= MAX_OPTIONS ? d : { ...d, options: [...d.options, ""] }));

  const removeOption = (i: number) =>
    setDraft((d) => {
      if (d.options.length <= MIN_OPTIONS) return d;
      const options = d.options.filter((_, j) => j !== i);
      let correctIndex = d.correctIndex;
      if (i === d.correctIndex) correctIndex = 0;
      else if (i < d.correctIndex) correctIndex -= 1;
      return { ...d, options, correctIndex: Math.min(correctIndex, options.length - 1) };
    });

  const moveOption = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.options.length) return d;
      const options = [...d.options];
      [options[i], options[j]] = [options[j]!, options[i]!];
      let correctIndex = d.correctIndex;
      if (d.correctIndex === i) correctIndex = j;
      else if (d.correctIndex === j) correctIndex = i;
      return { ...d, options, correctIndex };
    });

  const pickImage = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be 5MB or smaller."); return; }
    const reader = new FileReader();
    reader.onload = () =>
      setDraft((d) => ({ ...d, imageDataUrl: String(reader.result), removeImage: false }));
    reader.readAsDataURL(file);
  };

  const payload = () => ({
    courseId,
    prompt: draft.prompt.trim(),
    options: draft.options.map((o) => o.trim()),
    correctIndex: draft.correctIndex,
    explanation: draft.explanation.trim() || null,
    questionType: draft.questionType,
    imageDataUrl: draft.imageDataUrl,
  });

  const saveMut = useMutation({
    mutationFn: async (opts: { replaceQuestionId?: string | null; skipDupCheck?: boolean }) => {
      if (editingId) {
        await updateFn({ data: { ...payload(), id: editingId, removeImage: draft.removeImage } });
        return { mode: "updated" as const };
      }
      if (!opts.skipDupCheck && !opts.replaceQuestionId) {
        const res = await dupFn({
          data: {
            courseId,
            prompt: draft.prompt.trim(),
            options: draft.options.map((o) => o.trim()),
            correctIndex: draft.correctIndex,
            hasImage: !!draft.imageDataUrl,
          },
        });
        if (res.matches.length > 0) return { mode: "duplicate" as const, matches: res.matches as DupMatch[] };
      }
      await addFn({ data: { ...payload(), replaceQuestionId: opts.replaceQuestionId ?? null } });
      return { mode: opts.replaceQuestionId ? ("replaced" as const) : ("added" as const) };
    },
    onSuccess: (res) => {
      if (res.mode === "duplicate") { setDup({ matches: res.matches }); return; }
      toast.success(
        res.mode === "updated" ? "Question updated"
        : res.mode === "replaced" ? "Existing question replaced"
        : "Question added",
      );
      setDup(null);
      setCompare(null);
      resetEditor();
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (q: {
    id: string; prompt: string; options: string[]; correct_index: number;
    explanation: string | null; imageUrl: string | null;
  }) => {
    setEditingId(q.id);
    setDraft({
      prompt: q.prompt,
      options: q.options.length ? [...q.options] : ["", ""],
      correctIndex: q.correct_index,
      explanation: q.explanation ?? "",
      questionType: "mcq_single",
      imageDataUrl: null,
      existingImageUrl: q.imageUrl,
      removeImage: false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
  const previewImage = draft.imageDataUrl ?? (draft.removeImage ? null : draft.existingImageUrl);
  const canSave = valid && (editingId || remaining > 0);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-5xl space-y-6">
        <Link to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to admin
        </Link>

        <div>
          <div className="font-mono text-xs text-muted-foreground">{data!.course.code}</div>
          <h1 className="text-2xl sm:text-3xl font-bold break-words">{data!.course.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data!.questions.length} / {data!.max} questions · {remaining} slots remaining
          </p>
        </div>

        {editingId || remaining > 0 ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
            {/* ---------------- Editor ---------------- */}
            <form
              onSubmit={(e) => { e.preventDefault(); saveMut.mutate({}); }}
              className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold flex items-center gap-2">
                  {editingId ? <><Pencil className="h-4 w-4" /> Edit question</> : <><Plus className="h-4 w-4" /> Add question</>}
                </h2>
                {editingId && (
                  <Button type="button" variant="ghost" size="sm" onClick={resetEditor}>Cancel edit</Button>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prompt">Question</Label>
                <Textarea
                  id="prompt"
                  rows={6}
                  className="min-h-32 text-base leading-relaxed"
                  value={draft.prompt}
                  onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
                  placeholder="Type the full question here…"
                />
              </div>

              {/* Image */}
              <div className="space-y-2">
                <Label>Image (optional)</Label>
                {previewImage ? (
                  <div className="space-y-2">
                    <div className="overflow-hidden rounded-lg border border-border bg-muted/30 max-w-sm">
                      <img src={previewImage} alt="Question preview" className="h-auto w-full object-contain" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex">
                        <input type="file" accept={ACCEPT} className="sr-only"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); }} />
                        <span className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm cursor-pointer hover:border-primary">
                          Replace image
                        </span>
                      </label>
                      <Button type="button" variant="outline" className="min-h-11"
                        onClick={() => setDraft((d) => ({ ...d, imageDataUrl: null, removeImage: true }))}>
                        <X className="h-4 w-4 mr-1" /> Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:border-primary">
                    <input type="file" accept={ACCEPT} className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); }} />
                    <ImagePlus className="h-4 w-4" /> Upload PNG, JPG, JPEG or WebP (max 5MB)
                  </label>
                )}
              </div>

              {/* Options */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Options ({draft.options.length}/{MAX_OPTIONS})</Label>
                  <Button type="button" variant="outline" size="sm"
                    disabled={draft.options.length >= MAX_OPTIONS} onClick={addOption}>
                    <Plus className="h-4 w-4 mr-1" /> Add option
                  </Button>
                </div>
                {draft.options.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, correctIndex: i }))}
                      className={`h-11 w-11 shrink-0 rounded-md border flex items-center justify-center ${
                        draft.correctIndex === i
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary"
                      }`}
                      title="Mark as correct answer"
                    >
                      {draft.correctIndex === i ? <Check className="h-4 w-4" /> : String.fromCharCode(65 + i)}
                    </button>
                    <Input
                      value={opt}
                      onChange={(e) => setOption(i, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      className="min-h-11"
                    />
                    <div className="flex flex-col">
                      <button type="button" onClick={() => moveOption(i, -1)} disabled={i === 0}
                        className="text-muted-foreground hover:text-primary disabled:opacity-30" aria-label="Move option up">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => moveOption(i, 1)} disabled={i === draft.options.length - 1}
                        className="text-muted-foreground hover:text-primary disabled:opacity-30" aria-label="Move option down">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button type="button" onClick={() => removeOption(i)}
                      disabled={draft.options.length <= MIN_OPTIONS}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-30" aria-label="Remove option">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Between 2 and 6 options. Tap a letter to mark the single correct answer.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="explanation">Explanation (optional)</Label>
                <Textarea id="explanation" rows={3} value={draft.explanation}
                  onChange={(e) => setDraft((d) => ({ ...d, explanation: e.target.value }))}
                  placeholder="Why is this the correct answer?" />
              </div>

              {errors.length > 0 && (
                <ul className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive space-y-1">
                  {errors.map((e) => <li key={e}>• {e}</li>)}
                </ul>
              )}

              <Button type="submit" disabled={!canSave || saveMut.isPending} className="min-h-11 w-full sm:w-auto">
                {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? "Save changes" : "Add question"}
              </Button>
            </form>

            {/* ---------------- Live preview ---------------- */}
            <aside className="rounded-xl border border-border bg-muted/20 p-4 sm:p-5 space-y-3 lg:sticky lg:top-20 h-fit">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Student preview</div>
              <p className="text-base font-medium leading-relaxed break-words">
                {draft.prompt.trim() || "Your question will appear here…"}
              </p>
              <QuestionImage url={previewImage} alt="Question preview" />
              <div className="space-y-2">
                {draft.options.map((o, i) => (
                  <div key={i}
                    className={`rounded-lg border px-3 py-2 text-sm break-words ${
                      draft.correctIndex === i ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}>
                    <span className="font-mono text-xs text-muted-foreground mr-2">{String.fromCharCode(65 + i)}</span>
                    {o.trim() || <span className="text-muted-foreground">Empty option</span>}
                  </div>
                ))}
              </div>
              {draft.explanation.trim() && (
                <p className="text-xs text-muted-foreground border-t border-border pt-2">
                  <span className="font-medium text-foreground">Explanation: </span>{draft.explanation}
                </p>
              )}
            </aside>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            This course is at the 500-question maximum.
          </div>
        )}

        {/* ---------------- Bank list ---------------- */}
        <div className="space-y-2">
          <h2 className="font-semibold">Questions ({data!.questions.length})</h2>
          {data!.questions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No questions yet.</div>
          ) : (
            data!.questions.map((q, idx) => (
              <div key={q.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">Q{idx + 1}</div>
                    <div className="font-medium mt-1 break-words">{q.prompt}</div>
                    {q.imageUrl && <QuestionImage url={q.imageUrl} />}
                    <ul className="mt-2 text-sm space-y-1">
                      {q.options.map((o, i) => (
                        <li key={i} className={i === q.correct_index ? "text-primary font-medium break-words" : "text-muted-foreground break-words"}>
                          {String.fromCharCode(65 + i)}. {o} {i === q.correct_index && " ✓"}
                        </li>
                      ))}
                    </ul>
                    {q.explanation && (
                      <p className="mt-2 text-xs text-muted-foreground break-words">
                        <span className="font-medium text-foreground">Explanation: </span>{q.explanation}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 sm:flex-col shrink-0">
                    <button onClick={() => startEdit(q)} aria-label="Edit question">
                      <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                    </button>
                    <button onClick={() => { if (confirm("Delete this question?")) delMut.mutate(q.id); }} aria-label="Delete question">
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* ---------------- Duplicate warning ---------------- */}
      <Dialog open={!!dup} onOpenChange={(o) => { if (!o) { setDup(null); setCompare(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-left">
              <AlertTriangle className="h-5 w-5 text-primary shrink-0" /> Possible duplicate question detected
            </DialogTitle>
            <DialogDescription className="text-left">
              A very similar question already exists in this question bank. Nothing has been saved yet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {dup?.matches.map((m) => (
              <div key={m.id} className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-primary">{m.similarity}% similar</span>
                  <span className="text-xs text-muted-foreground">
                    text {m.promptSimilarity}% · options {m.optionsSimilarity}%
                    {m.sameCorrectAnswer ? " · same answer" : ""}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md bg-muted/40 p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Existing question</div>
                    <p className="text-sm break-words">{m.prompt}</p>
                  </div>
                  <div className="rounded-md bg-primary/5 p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">New question</div>
                    <p className="text-sm break-words">{draft.prompt}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="min-h-10" onClick={() => setCompare(m)}>
                    <Columns className="h-4 w-4 mr-1" /> Side-by-side
                  </Button>
                  <Button
                    variant="outline" size="sm" className="min-h-10"
                    disabled={saveMut.isPending}
                    onClick={() => {
                      if (confirm("Replace the existing question with this new one? This cannot be undone.")) {
                        saveMut.mutate({ replaceQuestionId: m.id });
                      }
                    }}
                  >
                    Replace existing
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button className="min-h-11" disabled={saveMut.isPending}
                onClick={() => saveMut.mutate({ skipDupCheck: true })}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Keep both
              </Button>
              <Button variant="ghost" className="min-h-11" onClick={() => { setDup(null); setCompare(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------------- Side-by-side comparison ---------------- */}
      <Dialog open={!!compare} onOpenChange={(o) => { if (!o) setCompare(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-left">Side-by-side comparison</DialogTitle>
            <DialogDescription className="text-left">
              Differences in wording are highlighted below each question.
            </DialogDescription>
          </DialogHeader>
          {compare && (() => {
            const diff = diffWords(compare.prompt, draft.prompt);
            const cols = [
              {
                key: "existing", label: `Existing question (${compare.similarity}% similar)`,
                prompt: compare.prompt, options: compare.options, correctIndex: compare.correctIndex,
                explanation: compare.explanation, imageUrl: compare.imageUrl, unique: diff.onlyA,
              },
              {
                key: "new", label: "New question",
                prompt: draft.prompt, options: draft.options, correctIndex: draft.correctIndex,
                explanation: draft.explanation || null, imageUrl: previewImage, unique: diff.onlyB,
              },
            ];
            return (
              <div className="grid gap-4 sm:grid-cols-2">
                {cols.map((c) => (
                  <div key={c.key} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">{c.label}</div>
                    <p className="text-sm font-medium break-words">{c.prompt}</p>
                    <QuestionImage url={c.imageUrl} />
                    <ul className="space-y-1 text-sm">
                      {c.options.map((o, i) => (
                        <li key={i} className={i === c.correctIndex ? "text-primary font-medium break-words" : "text-muted-foreground break-words"}>
                          {String.fromCharCode(65 + i)}. {o} {i === c.correctIndex && "✓"}
                        </li>
                      ))}
                    </ul>
                    {c.explanation && (
                      <p className="text-xs text-muted-foreground break-words">
                        <span className="font-medium text-foreground">Explanation: </span>{c.explanation}
                      </p>
                    )}
                    {c.unique.length > 0 && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Only here: </span>
                        {c.unique.slice(0, 12).map((w) => (
                          <span key={w} className="mr-1 rounded bg-primary/10 px-1 text-primary">{w}</span>
                        ))}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
