"use client";

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ImageUploaderProps {
  currentUrl?: string | null;
  onUpload: (url: string) => void;
  className?: string;
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const token = typeof window !== "undefined" ? localStorage.getItem("clossette_token") : null;
  const res = await fetch("/api/designer/products/upload/image", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = (await res.json()) as { url: string };
  return data.url;
}

function validateFile(file: File): string | null {
  const accepted = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!accepted.includes(file.type)) {
    return "Only JPEG, PNG, and WebP images are accepted.";
  }
  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    return "File exceeds the 10 MB size limit.";
  }
  return null;
}

export function ImageUploader({ currentUrl, onUpload, className }: ImageUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);

      // Local preview immediately
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      setUploading(true);
      try {
        const uploadedUrl = await uploadImage(file);
        onUpload(uploadedUrl);
        setPreviewUrl(uploadedUrl);
        URL.revokeObjectURL(objectUrl);
      } catch {
        setError("Upload failed. Please try again.");
        setPreviewUrl(currentUrl ?? null);
        URL.revokeObjectURL(objectUrl);
      } finally {
        setUploading(false);
      }
    },
    [currentUrl, onUpload],
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload image — click or drag and drop"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-colors",
          "min-h-[200px] p-6 text-center",
          isDragOver
            ? "border-foreground/30 bg-muted"
            : "border-border bg-muted/50 hover:border-foreground/20 hover:bg-muted",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        {previewUrl ? (
          <div className="relative w-full aspect-[4/3] overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Product image preview"
              className="absolute inset-0 h-full w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <p className="text-sm font-medium text-muted-foreground">
              Drag &amp; drop or click to browse
            </p>
            <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP · max 10 MB</p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-card/70">
            <span className="text-sm font-medium text-muted-foreground animate-pulse">
              Uploading...
            </span>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="sr-only"
        onChange={handleInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Change button if preview exists */}
      {previewUrl && !uploading && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="text-muted-foreground"
        >
          Change Image
        </Button>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
