#!/usr/bin/env bash
#
# fetch-smplx-models.sh — install SMPL-X model files the worker needs when
# AVATAR_GENERATION_PROVIDER=smplx. These files are NOT in git (license
# forbids redistribution; see smplx_models/README.md).
#
# Usage:
#   ./scripts/fetch-smplx-models.sh <models_smplx_v1_1.zip>   # from the archive
#   ./scripts/fetch-smplx-models.sh <extracted-dir>           # from a folder
#   ./scripts/fetch-smplx-models.sh --check                   # verify only
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$REPO_ROOT/smplx_models/smplx/models/smplx"
GENDERS=(NEUTRAL MALE FEMALE)
DL_URL="https://smpl-x.is.tue.mpg.de/download.php"

is_lfs_pointer() {
  # SMPL-X .npz are >100MB; a <1KB file starting with the LFS header is a stub.
  local f="$1"
  [ -f "$f" ] || return 1
  [ "$(wc -c < "$f")" -lt 1024 ] || return 1
  head -c 64 "$f" | grep -q "git-lfs.github.com/spec" 2>/dev/null
}

check() {
  local ok=1
  for g in "${GENDERS[@]}"; do
    local f="$DEST/SMPLX_${g}.npz"
    if [ ! -f "$f" ]; then
      echo "  ✗ missing: smplx_models/smplx/models/smplx/SMPLX_${g}.npz"
      ok=0
    elif is_lfs_pointer "$f"; then
      echo "  ✗ LFS pointer stub (not the real model): SMPLX_${g}.npz"
      ok=0
    else
      echo "  ✓ SMPLX_${g}.npz ($(du -h "$f" | cut -f1))"
    fi
  done
  if [ "$ok" -eq 1 ]; then
    echo "SMPL-X models OK."
    return 0
  fi
  echo
  echo "Missing models. Download SMPL-X v1.1 after accepting the license at:"
  echo "  $DL_URL"
  echo "then re-run:  ./scripts/fetch-smplx-models.sh <models_smplx_v1_1.zip>"
  return 1
}

install_from() {
  local src="$1"
  [ -e "$src" ] || { echo "No such file or directory: $src" >&2; exit 1; }

  local tmp="" srcdir="$src"
  if [ -f "$src" ]; then
    case "$src" in
      *.zip) ;;
      *) echo "Expected a .zip archive or a directory, got: $src" >&2; exit 1 ;;
    esac
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    echo "Extracting $(basename "$src") ..."
    unzip -q "$src" -d "$tmp"
    srcdir="$tmp"
  fi

  mkdir -p "$DEST"
  local found=0
  for g in "${GENDERS[@]}"; do
    # SMPL-X archives nest the full models under models/smplx/ — grab the
    # largest matching file (the full model, not a stripped copy).
    local match
    match="$(find "$srcdir" -type f -name "SMPLX_${g}.npz" -exec ls -S {} + 2>/dev/null | head -1 || true)"
    if [ -n "$match" ]; then
      cp -f "$match" "$DEST/SMPLX_${g}.npz"
      echo "  installed SMPLX_${g}.npz  ($(du -h "$DEST/SMPLX_${g}.npz" | cut -f1))"
      found=$((found + 1))
    else
      echo "  ✗ SMPLX_${g}.npz not found under $srcdir" >&2
    fi
  done
  [ "$found" -gt 0 ] || { echo "No SMPL-X models found in source." >&2; exit 1; }
  echo
  echo "Verifying ..."
  check
}

main() {
  if [ "$#" -eq 0 ] || [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    sed -n '3,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0
  fi
  if [ "$1" = "--check" ]; then
    check
  else
    install_from "$1"
  fi
}

main "$@"
