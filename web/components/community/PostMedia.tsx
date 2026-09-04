"use client";

interface PostMediaProps {
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: string;
}

function parseGradient(image: string): { from: string; to: string } | null {
  if (!image.startsWith("gradient:")) return null;
  const [from, to] = image.slice(9).split(",");
  return { from, to };
}

export function PostMedia({
  src,
  alt,
  className = "",
  aspectRatio = "4/5",
}: PostMediaProps) {
  const gradient = parseGradient(src);

  if (gradient) {
    return (
      <div
        className={`w-full bg-muted ${className}`}
        style={{
          aspectRatio,
          background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
        }}
        role="img"
        aria-label={alt}
      />
    );
  }

  return (
    <div
      className={`w-full bg-muted overflow-hidden ${className}`}
      style={{ aspectRatio }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
