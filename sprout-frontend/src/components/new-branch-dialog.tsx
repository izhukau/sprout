"use client";

import { Loader2, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type NewBranchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description: string;
    files: File[];
  }) => Promise<void>;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function NewBranchDialog({
  open,
  onOpenChange,
  onSubmit,
}: NewBranchDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const reset = useCallback(() => {
    setTitle("");
    setDescription("");
    setFiles([]);
    setError(null);
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (selected) {
      setFiles((prev) => [...prev, ...Array.from(selected)]);
    }
    // Reset so re-selecting the same file works
    e.target.value = "";
  }

  function handleRemoveFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    const dropped = Array.from(e.dataTransfer.files).filter((file) =>
      /\.(pdf|txt|md)$/i.test(file.name),
    );
    if (dropped.length > 0) {
      setFiles((prev) => [...prev, ...dropped]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        files,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create branch");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-[rgba(46,232,74,0.15)] bg-[rgba(17,34,20,0.85)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-[16px]">
        {/* Gradient overlay */}
        <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-b from-white/[0.04] to-transparent" />

        <DialogHeader className="relative">
          <DialogTitle className="text-white">New Branch</DialogTitle>
          <DialogDescription className="text-[#b0b8b4]">
            Define a topic to start a new learning path.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="relative flex flex-col gap-4"
        >
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="branch-title" className="text-[#b0b8b4]">
              Topic
            </Label>
            <Input
              id="branch-title"
              placeholder="e.g. Machine Learning Fundamentals"
              required
              disabled={isSubmitting}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-[#1e3d24] bg-[#0d2010] text-white placeholder:text-[#4a5a4e] focus-visible:ring-[#2EE84A]/50"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="branch-description" className="text-[#b0b8b4]">
              Description <span className="text-[#4a5a4e]">(optional)</span>
            </Label>
            <Textarea
              id="branch-description"
              placeholder="What do you want to learn? Any specific goals?"
              disabled={isSubmitting}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-20 border-[#1e3d24] bg-[#0d2010] text-white placeholder:text-[#4a5a4e] focus-visible:ring-[#2EE84A]/50"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-[#b0b8b4]">
              Files <span className="text-[#4a5a4e]">(optional)</span>
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={handleFilesSelected}
            />
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-5 text-sm transition-colors disabled:opacity-50",
                isDragging
                  ? "border-[#2EE84A] bg-[rgba(46,232,74,0.08)] text-[#2EE84A]"
                  : "border-[rgba(46,232,74,0.2)] bg-[rgba(13,32,16,0.5)] text-[#4a5a4e] hover:border-[rgba(46,232,74,0.4)] hover:text-[#b0b8b4]",
              )}
            >
              <Upload className="h-5 w-5" />
              <span>
                {isDragging
                  ? "Drop files here"
                  : "Drag & drop or click to upload (PDF, TXT, MD)"}
              </span>
            </button>

            {files.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded-md border border-[#1e3d24] bg-[#0d2010] px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-white/70">
                      {file.name}
                    </span>
                    <span className="shrink-0 text-xs text-[#4a5a4e]">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleRemoveFile(index)}
                      className="shrink-0 rounded-sm p-0.5 text-[#4a5a4e] transition-colors hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter className="relative">
            <Button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="w-full bg-[#2EE84A] font-semibold text-[#0A1A0F] hover:bg-[#3DBF5A] disabled:opacity-50 sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Branch"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
