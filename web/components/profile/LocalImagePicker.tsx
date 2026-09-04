"use client";

import { useRef, useCallback, type ReactNode } from "react";
import { toast } from "sonner";

interface LocalImagePickerProps {
  onSelect: (dataUrl: string) => void;
  accept?: string;
  maxSizeMB?: number;
  maxDimension?: number;
  quality?: number;
  className?: string;
  children?: ReactNode;
}

function compressImage(
  dataUrl: string,
  maxDim: number,
  qual: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", qual));
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}

export function LocalImagePicker({
  onSelect,
  accept = "image/jpeg,image/png,image/webp",
  maxSizeMB = 5,
  maxDimension = 800,
  quality = 0.7,
  className,
  children,
}: LocalImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset so the same file can be re-selected
      e.target.value = "";

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Please select a JPEG, PNG, or WebP image");
        return;
      }

      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        toast.error(`Image must be under ${maxSizeMB}MB`);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawDataUrl = event.target?.result as string;
        if (!rawDataUrl) {
          toast.error("Failed to load image");
          return;
        }
        try {
          const compressed = await compressImage(rawDataUrl, maxDimension, quality);
          onSelect(compressed);
        } catch {
          toast.error("Failed to load image");
        }
      };
      reader.onerror = () => {
        toast.error("Failed to load image");
      };
      reader.readAsDataURL(file);
    },
    [maxSizeMB, maxDimension, quality, onSelect]
  );

  return (
    <div className={className} onClick={handleClick}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
