import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadMyAvatar, removeMyAvatar } from "@/lib/account.functions";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 3 * 1024 * 1024;

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

export function AvatarUploader({
  currentUrl,
  name,
  hasAvatar,
}: {
  currentUrl: string | null | undefined;
  name?: string | null;
  hasAvatar?: boolean;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const uploadFn = useServerFn(uploadMyAvatar);
  const removeFn = useServerFn(removeMyAvatar);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-profile"] });
    qc.invalidateQueries({ queryKey: ["public-profile"] });
    qc.invalidateQueries({ queryKey: ["dashboard-v2"] });
  };

  const uploadMut = useMutation({
    mutationFn: (payload: string) => uploadFn({ data: { dataUrl: payload } }),
    onSuccess: () => {
      toast.success("Profile picture updated");
      setPreview(null);
      setDataUrl(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: () => removeFn(),
    onSuccess: () => {
      toast.success("Profile picture removed");
      setPreview(null);
      setDataUrl(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onPick = (file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      toast.error("Please choose a PNG, JPEG, WebP or GIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be 3MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      setDataUrl(result);
      setPreview(result);
    };
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsDataURL(file);
  };

  const busy = uploadMut.isPending || removeMut.isPending;
  const shown = preview ?? currentUrl ?? undefined;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <Avatar className="h-20 w-20 shrink-0 border border-border">
        <AvatarImage src={shown} alt={name ?? "Your profile picture"} />
        <AvatarFallback className="text-lg">{initials(name)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="text-sm font-medium flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4" /> Profile picture
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG, WebP or GIF · up to 3MB. Shown across ReadMe and on your public profile.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED.join(",")}
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 gap-1.5"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> {currentUrl || preview ? "Choose another" : "Upload image"}
          </Button>
          {dataUrl && (
            <Button
              type="button"
              size="sm"
              className="min-h-10 gap-1.5"
              disabled={busy}
              onClick={() => uploadMut.mutate(dataUrl)}
            >
              {uploadMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save picture
            </Button>
          )}
          {dataUrl && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-10"
              disabled={busy}
              onClick={() => { setDataUrl(null); setPreview(null); }}
            >
              Cancel
            </Button>
          )}
          {hasAvatar && !dataUrl && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-10 gap-1.5 text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => removeMut.mutate()}
            >
              {removeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove
            </Button>
          )}
        </div>
        {dataUrl && <p className="text-xs text-primary">Preview shown — tap "Save picture" to apply.</p>}
      </div>
    </div>
  );
}
