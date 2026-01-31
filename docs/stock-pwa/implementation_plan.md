# Dynamic Access Vendor Sync Plan

## Goal
Allow administrators to link Web Vendors to Access DB Vendors dynamically from the Admin panel, removing the need for hardcoded allow-lists.

## Proposed Changes

### 1. Database Schema
*   **Model**: `Vendor`
*   **Change**: Add `accessCompanyName String?` (Nullable). (Already Implemented)
*   **Purpose**: Stores the exact company name from Access DB used for filtering search results.

### 2. Backend API
*   **New Route**: `app/api/access/vendors/route.ts` (Implemented)
    *   **Method**: `GET`
    *   **Logic**: Uses PowerShell to query `SELECT 会社名, 発注先ID FROM 下請台帳テーブル` from Access DB.
    *   **Response**: List of `{ id: string, name: string }`.
*   **Update Search API**: `app/api/access/route.ts` (Implemented)
    *   **Logic**: Fetch `accessCompanyName` from DB based on Logged-in Vendor. Use it for PowerShell query filter.

### 3. Server Actions / Admin UI
*   **Update Action**: `lib/actions.ts`
    *   Update `upsertVendor` to accept `accessCompanyName`.
*   **Update UI**: `components/admin/vendor-dialog.tsx`
    *   Fetch Access Vendors list using `GET /api/access/vendors` (use `swr` or `useEffect`).
    *   Add a `<Select>` dropdown: "Access連携業者".
    *   Save logic passes `accessCompanyName` to `upsertVendor`.

## Verification Plan
1.  **Access Vendor Fetch**:
    *   Run `curl http://localhost:3000/api/access/vendors` to confirm JSON output. (Verified)
2.  **Linking Vendor**:
    *   Open Admin > Vendor Management.
    *   Edit a vendor (e.g., "WebVendor").
    *   Select "AccessVendor" from the new dropdown.
    *   Save.
    *   Check Database (Studio or Console) to see `accessCompanyName` updated.
3.  **Search Verification**:
    *   Login as the linked Vendor.
    *   Perform a search.
    *   Confirm results are returned (meaning Access query used the linked name).
