"use client";

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export function SuggestionChips({ suggestions, onSelect, disabled }: SuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  const chipsKey = suggestions.join("|");

  return (
    <div key={chipsKey} className="flex flex-wrap gap-2" role="group" aria-label="Suggested responses">
      {suggestions.map((suggestion, index) => (
        <button
          key={`${index}-${suggestion}`}
          type="button"
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          className={[
            "px-3.5 py-1.5 rounded-full text-sm border transition-all duration-200 animate-chip-pop-in",
            disabled
              ? "bg-muted border-border text-muted-foreground/50 cursor-not-allowed"
              : "bg-card border-border text-muted-foreground hover:border-brand/40 hover:text-foreground hover:shadow-soft hover:-translate-y-px active:translate-y-0 cursor-pointer",
          ].join(" ")}
          style={{ animationDelay: `${index * 60}ms` }}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
