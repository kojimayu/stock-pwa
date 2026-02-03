# Inventory Concurrency Fix Plan

## Problem
When multiple users click "Confirm" (Finalize) on the inventory screen simultaneously, a race condition occurs.
The `finalizeInventory` function checks if the status is `IN_PROGRESS` *before* starting the transaction.
1. Request A & B both pass the check.
2. Request A completes, updates status to `COMPLETED`, and adjusts stock.
3. Request B proceeds (checks already passed), updates status again (redundant), and **applies stock adjustments again**.
This results in double-counting of inventory adjustments and inaccurate stock levels.

## Proposed Changes

### [Server Action]
#### [MODIFY] [actions.ts](file:///f:/Antigravity/stock-pwa/lib/actions.ts)
*   **`updateInventoryItem`**:
    *   Add check: Ensure the associated `InventoryCount` has `status: 'IN_PROGRESS'`. If not, throw "棚卸は既に完了または中止されています".
*   **`finalizeInventory`**:
    *   Change return type to `Promise<{ success: boolean; message?: string; code?: string }>` to handle duplicate calls gracefully.
    *   **Atomic Lock**: Use `prisma.inventoryCount.updateMany` with `where: { id, status: 'IN_PROGRESS' }`.
    *   **Logic**:
        *   If update count is 0:
            *   Check current status. If `COMPLETED`, return `{ success: true, message: "既に完了しています", code: "ALREADY_COMPLETED" }`. (Treat as success/info).
            *   Else, throw error.
        *   If update count is 1 (We won the lock):
            *   Fetch latest items (`tx.inventoryCount.findUnique(...).items`).
            *   Loop and update product stocks and create logs.
            *   Return `{ success: true }`.

### [Frontend]
#### [MODIFY] [inventory-detail.tsx](file:///f:/Antigravity/stock-pwa/components/admin/inventory-detail.tsx)
*   **`handleFinalize`**:
    *   Capture the result of `finalizeInventory`.
    *   If `result.code === 'ALREADY_COMPLETED'`, show a toast "他のユーザーにより既に完了されています" and refresh page (`router.refresh()` or just redirect).
