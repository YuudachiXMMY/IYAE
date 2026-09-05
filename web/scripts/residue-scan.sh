#!/usr/bin/env bash
# Residue scan — the Phase 2 design-system acceptance gate.
# Rejects legacy hardcoded colors outside the semantic-token system.
# Exits non-zero if any legacy literal is found outside the allowlist.
#
# Allowlist rationale:
#   - app/globals.css        : the token home (all raw values live here by design)
#   - components/ui/*        : shadcn CLI-generated primitives (token-driven, not hand-edited)
#   - R3F material files     : Three.js material/light colors need literal hex, not CSS vars
#       (components/home/TryOnViewer.tsx, components/ARViewer.tsx, components/DemoOutfitModel.tsx)
#   - lib/email-templates.ts : email HTML requires inline hex (clients strip CSS vars/Tailwind)
#   - lib/profile-options.ts : real fashion color-swatch DATA the user picks (not theme colors)
#
# Note: rgba() and text-white are NOT gated — translucent overlays/scrims and white-on-media
# are legitimate; only hardcoded palette literals (purple/rose/stone/status/hex/bg-white) are.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

HEX_ALLOW='app/globals.css|components/ui|components/home/TryOnViewer|components/ARViewer|components/DemoOutfitModel|lib/email-templates|lib/profile-options'
BGWHITE_ALLOW='over (image|media)|components/ui'
fail=0

check() { # <label> <grep-output>
  if [ -n "$2" ]; then printf '❌ %s\n%s\n\n' "$1" "$2"; fail=1; else printf '✅ %s\n' "$1"; fi
}

check "no purple-*"  "$(grep -rnE 'purple-[0-9]' app components lib --include='*.tsx' --include='*.ts')"
check "no rose-*"    "$(grep -rnE 'rose-[0-9]'   app components lib --include='*.tsx' --include='*.ts')"
check "no stone-*"   "$(grep -rnE 'stone-[0-9]'  app components lib --include='*.tsx' --include='*.ts')"
check "no status colors" "$(grep -rnE '(green|amber|blue|yellow|emerald)-[0-9]{2,3}' app components lib --include='*.tsx')"
check "no bg-white"  "$(grep -rn 'bg-white' app components lib --include='*.tsx' --include='*.ts' | grep -viE "$BGWHITE_ALLOW")"
check "no stray hex" "$(grep -rnE '#[0-9a-fA-F]{3,8}' app components lib --include='*.tsx' --include='*.ts' | grep -viE "$HEX_ALLOW")"

if [ "$fail" -ne 0 ]; then
  echo ""; echo "Residue scan FAILED — migrate the literals above to semantic tokens (see web/CLAUDE.md Design System)."
  exit 1
fi
echo ""; echo "Residue scan passed — no legacy color literals outside the allowlist."
