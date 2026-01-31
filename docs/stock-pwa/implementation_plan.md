# Dynamic Access Vendor Sync Plan

## Goal
Allow administrators to link Web Vendors to Access DB Vendors dynamically from the Admin panel, removing the need for hardcoded allow-lists.

## Proposed Changes

### 1. Database Schema
*   **Model**: `Vendor`
*   **Change**: Add `accessCompanyName String?` (Nullable).
*   **Purpose**: Stores the exact company name from Access DB used for filtering search results.

### 2. Backend API
*   **New Route**: `app/api/access/vendors/route.ts`
    *   **Method**: `GET`
    *   **Logic**: Uses PowerShell to query `SELECT 会社名, 発注先ID FROM 下請台帳テーブル` from Access DB.
    *   **Response**: List of `{ id: string, name: string }`.
*   **Update Search API**: `app/api/access/route.ts`
    *   Remove `vendorName` parameter dependency for mapping.
    *   Instead, verify the logged-in `vendor.accessCompanyName`.
    *   If `accessCompanyName` is set, use it as the filter keyword. If null, deny access.

### 3. Admin UI: Vendor Management
*   **Component**: `components/admin/vendor-dialog.tsx` (or similar)
*   **Feature Link**:
    *   Add a logic to fetch Access Vendors list (cache in state or SWR).
    *   Add a standard `<Select>` dropdown: "Access連携業者".
    *   Allows selecting one from the fetched Access list.

## Workflow
1.  Admin opens Vendor Edit dialog.
2.  Clicks "Access業者リスト更新" (Fetches live data from Access).
3.  Selects "(株)メルテック" from dropdown.
4.  Saves. `Vendor.accessCompanyName` is updated to "(株)メルテック".
5.  Vendor logs in. `session.vendor.accessCompanyName` is available.
6.  Vendor searches. API uses "(株)メルテック" to filter results.
