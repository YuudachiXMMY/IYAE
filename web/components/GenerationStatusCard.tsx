"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GenerationStatusBadge } from "@/components/GenerationStatusBadge";
import { useGenerationStatus } from "@/lib/hooks/useGenerationStatus";

interface GenerationStatusCardProps {
  productId: number;
}

export function GenerationStatusCard({ productId }: GenerationStatusCardProps) {
  const { status, loading, actionError, clearActionError, retry, regenerate } = useGenerationStatus(productId, true);

  return (
    <Card className="rounded-card shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">
          3D Model Generation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status badge — large */}
        <div className="flex items-center gap-3" role="status" aria-live="polite" aria-label="3D model generation status">
          {loading && !status ? (
            <Skeleton className="h-6 w-28 rounded-md" />
          ) : (
            <GenerationStatusBadge
              status={status?.status ?? null}
              className="px-3 py-1 text-sm"
            />
          )}
          {status && status.retryCount > 0 && (
            <span className="text-xs text-muted-foreground">
              Retries: {status.retryCount}
            </span>
          )}
        </div>

        {/* READY: download links */}
        {status?.status === "READY" && (
          <div className="space-y-2">
            {status.glbUrl && (
              <a
                href={status.glbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors w-fit"
              >
                <span aria-hidden="true">⬇</span>
                Download GLB
              </a>
            )}
            {status.usdzUrl && (
              <a
                href={status.usdzUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors w-fit"
              >
                <span aria-hidden="true">⬇</span>
                Download USDZ
              </a>
            )}
          </div>
        )}

        {/* FAILED: error message + retry */}
        {status?.status === "FAILED" && (
          <div className="space-y-3">
            {status.errorMessage && (
              <p className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {status.errorMessage}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void retry()}
              className="border-red-200 text-red-700 hover:bg-red-50"
            >
              Retry Generation
            </Button>
          </div>
        )}

        {/* Action error */}
        {actionError && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <p className="flex-1 text-sm text-destructive">{actionError}</p>
            <button
              onClick={clearActionError}
              className="shrink-0 text-destructive/60 hover:text-destructive text-sm leading-none"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Regenerate button — always visible */}
        <div className="pt-1 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void regenerate()}
            className="text-muted-foreground"
          >
            Regenerate 3D Model
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
