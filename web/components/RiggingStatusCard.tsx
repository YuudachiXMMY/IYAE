"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RiggingStatusBadge } from "@/components/RiggingStatusBadge";
import { useRiggingStatus } from "@/lib/hooks/useRiggingStatus";

interface RiggingStatusCardProps {
  productId: number;
}

const TOPOLOGY_FAILURE_CODE = "TOPOLOGY_REPAIR_REQUIRED";

function getFailureHint(failureCode: string | null): string {
  if (failureCode === TOPOLOGY_FAILURE_CODE) {
    return "The garment mesh has topology issues. Please repair and re-upload.";
  }
  return "An unexpected error occurred during rigging. Check the mesh and try again.";
}

export function RiggingStatusCard({ productId }: RiggingStatusCardProps) {
  const {
    status,
    riggedGlbUrl,
    errorMessage,
    failureCode,
    attemptCount,
    isLoading,
    isActionLoading,
    actionError,
    clearActionError,
    triggerRigging,
    retryRigging,
  } = useRiggingStatus(productId);

  return (
    <Card className="rounded-card shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-foreground">
            Garment Rigging
          </CardTitle>
          {isLoading && !status ? (
            <Skeleton className="h-6 w-28 rounded-md" />
          ) : (
            <RiggingStatusBadge
              status={status ?? "NONE"}
              className="px-3 py-1 text-sm"
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4" role="status" aria-live="polite" aria-label="Garment rigging status">
        {/* READY: rigged GLB link */}
        {status === "READY" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Rigged GLB ready — garment can now be fitted to avatars.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {riggedGlbUrl && (
                <a
                  href={riggedGlbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors w-fit"
                >
                  <span aria-hidden="true">⬇</span>
                  Download Rigged GLB
                </a>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void triggerRigging()}
                disabled={isActionLoading}
              >
                {isActionLoading ? "Triggering..." : "Re-trigger Rigging"}
              </Button>
            </div>
          </div>
        )}

        {/* RUNNING: indeterminate progress */}
        {status === "RUNNING" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Processing garment fitting...</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 animate-[slide_1.5s_ease-in-out_infinite] rounded-full bg-info" />
            </div>
          </div>
        )}

        {/* PENDING: queued message */}
        {status === "PENDING" && (
          <p className="text-sm text-muted-foreground">
            Queued for rigging — processing will begin shortly.
          </p>
        )}

        {/* FAILED: error details + retry */}
        {status === "FAILED" && (
          <div className="space-y-3">
            {errorMessage && (
              <p className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{getFailureHint(failureCode)}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void retryRigging()}
              disabled={isActionLoading}
              className="border-red-200 text-red-700 hover:bg-red-50"
            >
              Retry Rigging
            </Button>
          </div>
        )}

        {/* NONE: start rigging */}
        {(status === "NONE" || status === null) && !isLoading && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              No rigging task found. Start rigging to enable avatar try-on for this garment.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void triggerRigging()}
              disabled={isActionLoading}
            >
              Start Rigging
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

        {/* Footer: attempt count */}
        {attemptCount > 0 && (
          <div className="pt-1 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Attempts: {attemptCount}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
