"use client";

import { useRef, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LocalImagePickerProps {
  onSelect: (dataUrl: string) => void;
  accept?: string;
  maxSizeMB?: number;
  maxDimension?: number;
  quality?: number;
  className?: string;
  children?: ReactNode;
  /**
   * Accessible name for the control. Required in spirit: the visual content is an icon and
   * some prose inside a button, which on its own tells a screen-reader user nothing about
   * what activating it does.
   */
  label?: string;
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
  label = "Choose an image",
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

  // A real <button>, not a <div onClick>. The picker used to be a plain div wrapping a
  // `hidden` + `aria-hidden` file input, so it was reachable by neither keyboard nor screen
  // reader — and since choosing an image is mandatory to create a community post, a
  // keyboard-only user could not post at all. A button is focusable, activates on Enter and
  // Space without extra handlers, and is announced.
  //
  // THIS IS THE BUTTON. Call sites must pass non-interactive children (text, icons, a styled
  // span) and put the visual button styling on `className` — several sites originally nested
  // a shadcn <Button> inside here, which put a real <button> node inside another one: two
  // separate tab stops and two announcements for one action, which is worse than the
  // unreachable div it replaced. `buttonVariants` from components/ui/button is the way to get
  // the pill look onto `className` without a nested control.
  return (
    <button
      type="button"
      className={cn("cursor-pointer", className)}
      onClick={handleClick}
      aria-label={label}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        // Kept out of the accessibility tree deliberately: the button above is the labelled
        // control, and exposing both would announce the same thing twice.
        aria-hidden="true"
        tabIndex={-1}
      />
      {children}
    </button>
  );
}
