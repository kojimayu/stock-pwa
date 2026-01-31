# Tasks

- [x] Refine Air Conditioner Checkout UI
    - [x] Add Preset Buttons for 4 main models (Hitachi AJ Series) <!-- id: 20 -->
    - [x] Implement "Free Input" toggle <!-- id: 21 -->
    - [x] Update Placeholders <!-- id: 22 -->
- [x] Implement Dynamic Access Vendor Linking
    - [x] Update Schema: Add `accessCompanyName` to `Vendor` <!-- id: 30 -->
    - [x] Create API: `GET /api/access/vendors` (Fetch list from Access via PowerShell) <!-- id: 31 -->
    - [x] Update Admin Vendor UI:
        - [x] Add "Link Access Company" dropdown in Vendor Edit/Create dialog <!-- id: 32 -->
        - [x] Add "Sync Access Vendors" button to populate options (Auto-fetch implemented) <!-- id: 33 -->
    - [x] Update `lib/access-control.ts` / API to use dynamic DB field instead of dynamic map <!-- id: 34 -->
- [ ] Verification
    - [ ] Verify fetching vendor list from Access <!-- id: 35 -->
    - [ ] Verify linking a Web Vendor to an Access Vendor <!-- id: 36 -->
    - [ ] Verify Access Search uses the linked name <!-- id: 37 -->
