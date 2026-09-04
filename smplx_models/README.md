# SMPL-X Model Files (not tracked in git)

The avatar-generation worker uses the [SMPL-X](https://smpl-x.is.tue.mpg.de)
parametric body model **only** when `AVATAR_GENERATION_PROVIDER=smplx`
(the default is `mock`, which needs none of these files).

These model files are **intentionally not committed**:

- They are ~1.6 GB and previously lived in Git LFS, consuming the account's
  LFS storage/bandwidth quota.
- The SMPL-X license **prohibits redistribution** — they must be downloaded
  by each user after accepting the license.

Everything under `smplx_models/` except this README is git-ignored.

## How to obtain the models

1. Register and accept the license at <https://smpl-x.is.tue.mpg.de/download.php>.
2. Download **SMPL-X v1.1** (`models_smplx_v1_1.zip`).
3. Run the helper from the repo root, pointing it at the downloaded archive
   (or an already-extracted directory):

   ```bash
   ./scripts/fetch-smplx-models.sh ~/Downloads/models_smplx_v1_1.zip
   # or:  ./scripts/fetch-smplx-models.sh /path/to/extracted/models
   ```

   The script places the full model files at the layout the worker expects:

   ```
   smplx_models/smplx/models/smplx/SMPLX_NEUTRAL.npz
   smplx_models/smplx/models/smplx/SMPLX_MALE.npz
   smplx_models/smplx/models/smplx/SMPLX_FEMALE.npz
   ```

4. Verify:

   ```bash
   ./scripts/fetch-smplx-models.sh --check
   ```

`worker/providers/smplx_provider.py` auto-resolves this path and refuses to
run against Git LFS pointer stubs, so a partial download fails loudly rather
than silently producing broken avatars.
