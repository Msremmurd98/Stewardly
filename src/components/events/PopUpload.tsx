import { useEffect, useRef, useState } from "react";
import { FileText, RefreshCw, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { POP_ACCEPT, POP_MAX_BYTES, validatePopFile } from "@/lib/events";

interface PopUploadProps {
  file: File | null;
  onChange: (file: File | null) => void;
  /** Error from the parent form (e.g. "required" on submit). */
  error?: string;
  disabled?: boolean;
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Nothing is uploaded here - the chosen file is only validated and previewed.
 * It is uploaded on submit, so replacing it before submission leaves no
 * orphaned files behind.
 */
export function PopUpload({ file, onChange, error, disabled }: PopUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFiles(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    const problem = validatePopFile(picked);
    if (problem) {
      setLocalError(problem);
      // keep the previously accepted file (if any)
    } else {
      setLocalError(null);
      onChange(picked);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  const shownError = localError ?? error;

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-foreground">
        Proof of payment <span className="text-danger">*</span>
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={POP_ACCEPT}
        className="sr-only"
        aria-label="Upload proof of payment"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {!file ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center disabled:opacity-50"
        >
          <UploadCloud className="h-6 w-6 text-muted" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">Upload receipt</span>
          <span className="text-xs text-muted">
            JPG, PNG, WEBP or PDF · max {formatSize(POP_MAX_BYTES)}
          </span>
        </button>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-3">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Proof of payment preview"
              className="max-h-64 w-full rounded-xl object-contain bg-background"
            />
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-background px-4 py-5">
              <FileText className="h-6 w-6 shrink-0 text-muted" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">PDF document</span>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted">{formatSize(file.size)}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCw className="h-4 w-4" />
              Replace
            </Button>
          </div>
        </div>
      )}

      {shownError && (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {shownError}
        </p>
      )}
    </div>
  );
}
