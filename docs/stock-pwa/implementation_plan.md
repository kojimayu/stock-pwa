# Implement Excel Import Preview & Diff

## Goal
Show a confirmation dialog with a summary of changes (New, Updated, Unchanged) before executing the Excel import to prevent accidental overwrites.

## Changes
### `lib/actions.ts`
- Add `getImportDiff(products: ProductImportRow[])` function.
    - Fetches existing products by ID or Code.
    - Compares incoming data with existing data.
    - Returns a list of diffs:
        - `type`: 'NEW' | 'UPDATE' | 'UNCHANGED'
        - `diffs`: Array of `{ field: string, old: any, new: any }` for updates.

### `components/admin/product-import-dialog.tsx`
- Add a new step "Preview" after file selection.
- Call `getImportDiff` when a file is selected (or on a "Check" button).
- Show a summary:
    - "New: X items"
    - "Update: Y items"
    - "Unchanged: Z items"
- Show a detailed table of updates (e.g., "Code: A-001 | Cost: 100 -> 0").
- Change the "Register" button to "Execute" after confirmation.
