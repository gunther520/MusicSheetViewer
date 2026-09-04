# Repository Rules

## Rule 1: Auto Merge and Vercel Deployment on PR
- Every time a Pull Request is created or updated, auto-merge the PR into `main` and deploy the newest version to Vercel.
- Pushes to `main` trigger continuous production deployment to Vercel.

## Rule 2: Dedicated Testing Folder (`testing/`)
- A dedicated `testing/` directory exists in the workspace root for testing images.
- Images placed in `testing/` must be tested whenever code changes.
- Test with all images in `testing/`. Only stop if all images pass with 0 missing chords and 0 wrongly added chords.
