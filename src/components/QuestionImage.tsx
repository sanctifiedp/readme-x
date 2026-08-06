import { useState } from "react";
import { X } from "lucide-react";

/** Question illustration: responsive, aspect-preserving, tap to enlarge on any device. */
export function QuestionImage({ url, alt = "Question image" }: { url: string | null | undefined; alt?: string }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 block w-full max-w-md overflow-hidden rounded-xl border border-border bg-muted/30"
        aria-label="Enlarge question image"
      >
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-auto w-full object-contain"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-full border border-border bg-card p-2"
            aria-label="Close image"
          >
            <X className="h-4 w-4" />
          </button>
          <img src={url} alt={alt} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </>
  );
}
