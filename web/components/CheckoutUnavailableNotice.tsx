"use client";

/**
 * Shown wherever a payment would have started while payment collection is off.
 *
 * One component rather than three copies of the sentence, because the three surfaces that can
 * begin a purchase (cart, checkout page, resale buy-now) have to say the same thing — and
 * because the previous behaviour was worse than any wording: the order was written `PAID` and
 * nobody was charged.
 */
export function CheckoutUnavailableNotice({
  variant = "default",
  onRetry,
}: {
  /** "error" when the flag could not be read at all, so the state is unknown rather than off. */
  variant?: "default" | "error";
  onRetry?: () => void;
}) {
  if (variant === "error") {
    return (
      <div
        role="alert"
        className="mt-6 rounded-2xl border border-border bg-muted p-4 text-sm text-foreground"
      >
        <p>We couldn&apos;t check whether checkout is available right now.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 font-medium text-brand underline hover:no-underline"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mt-6 rounded-2xl border border-border bg-muted p-4 text-sm text-foreground"
    >
      <p className="font-medium">Checkout isn&apos;t open yet</p>
      <p className="mt-1 text-muted-foreground">
        We&apos;re not taking payments at the moment. Your bag is saved — you can come back and
        check out once orders open.
      </p>
    </div>
  );
}
