# Testing Folder

Put any music sheet images (`.png`, `.jpg`, `.jpeg`, `.webp`) in this folder (`testing/`).

## Automated Testing Requirement
Every time code changes:
- All images placed in `testing/` are evaluated by the OCR and chord detection test suite.
- Tests must pass with **100% accuracy** (zero missed chords and zero false chords) before code changes are complete.
- To execute tests across all testing images:
  ```bash
  npm test
  # or
  npm run eval:sheets
  ```
