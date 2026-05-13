# PROJECT MAP

This map was built by reading the current `src/`, `api/`, and `supabase/` code in this repository. It reflects the code as checked in today, including places where flows are duplicated, optimistic, partially wired, or apparently unused.

## Section 1 - File Structure Map

```text
src/app/
|-- admin-ui.models.ts -> Shared admin/dealer UI normalization helpers, demo/fallback dashboard data, status labels
|-- app.config.ts -> Unused alternate Angular app config with `provideRouter(routes)`
|-- app.html -> Root template with global `<p-toast>` and `<router-outlet>`
|-- app.routes.ts -> Full route table for login, auth callback, admin portal, dealer portal, profile
|-- app.scss -> Root app styles placeholder
|-- app.spec.ts -> Generated root component smoke test
|-- app.ts -> Root app component that redirects authenticated users to admin or dealer portal
|-- auth-guard.spec.ts -> Generated auth guard smoke test
|-- auth-guard.ts -> Route guard that enforces auth and portal segregation by role
|-- layout/
|   |-- admin-sidebar.html -> Sidebar template for admin and dealer navigation shells
|   |-- admin-sidebar.scss -> Sidebar styling
|   |-- admin-sidebar.ts -> Sidebar component with nav items, counts, logout/link events
|   |-- admin-topbar.html -> Top bar template for breadcrumbs, notifications, theme toggle, user menu
|   |-- admin-topbar.scss -> Top bar styling
|   |-- admin-topbar.ts -> Top bar component inputs/outputs for shell UI state
|   |-- layout.html -> Main authenticated shell template wrapping routed portal pages
|   |-- layout.scss -> Authenticated shell styling
|   `-- layout.ts -> Main portal shell; loads role, counts, notifications, breadcrumbs, theme and logout
|-- models/
|   |-- booking.ts -> Booking interface used across dealer/admin views
|   `-- vehicle.ts -> Vehicle interface used across dealer/admin views
|-- pages/
|   |-- admin-analytics/
|   |   |-- admin-analytics.html -> Admin analytics dashboard template
|   |   |-- admin-analytics.scss -> Admin analytics styling
|   |   `-- admin-analytics.ts -> Admin analytics page using bookings/vehicles to build charts
|   |-- admin-audit-logs/
|   |   |-- admin-audit-logs.html -> Audit log table/filter/export template
|   |   `-- admin-audit-logs.ts -> Audit log page loading `audit_logs` plus role lookups
|   |-- admin-dashboard/
|   |   |-- admin-dashboard.html -> Admin vehicle management template
|   |   |-- admin-dashboard.scss -> Admin vehicle management styling
|   |   |-- admin-dashboard.spec.ts -> Generated admin dashboard smoke test
|   |   `-- admin-dashboard.ts -> Admin vehicle CRUD/archive screen
|   |-- admin-dealer-performance/
|   |   |-- admin-dealer-performance.html -> Admin booking ledger, detail, approve/reject template
|   |   |-- admin-dealer-performance.scss -> Admin booking ledger styling
|   |   `-- admin-dealer-performance.ts -> Admin booking operations page with realtime booking refresh
|   |-- admin-overview/
|   |   |-- admin-overview.html -> Admin overview dashboard template
|   |   |-- admin-overview.scss -> Admin overview styling
|   |   `-- admin-overview.ts -> Admin overview KPI/dashboard page
|   |-- admin-revenue/
|   |   |-- admin-revenue.html -> Revenue/reporting template
|   |   `-- admin-revenue.ts -> Revenue/report page with synthetic period bucketing on current bookings
|   |-- admin-users/
|   |   |-- admin-users.html -> User list/filter/profile drawer template
|   |   `-- admin-users.ts -> User administration page backed by `user_roles` plus derived booking stats
|   |-- auth-callback/
|   |   `-- auth-callback.ts -> Google OAuth callback page that creates default dealer role/profile when missing
|   |-- booking/
|   |   |-- booking-dialog.component/
|   |   |   |-- booking-dialog.component.html -> Dealer dashboard booking modal template
|   |   |   |-- booking-dialog.component.scss -> Booking modal styling
|   |   |   `-- booking-dialog.component.ts -> Old/simple booking dialog used only by dealer dashboard
|   |   |-- contract/
|   |   |   `-- .gitkeep -> Empty placeholder for future contract step/files
|   |   |-- customer-details/
|   |   |   |-- customer-details.component.html -> Customer detail form template in routed booking flow
|   |   |   |-- customer-details.component.scss -> Customer detail form styling
|   |   |   `-- customer-details.component.ts -> Routed customer-detail step backed by `BookingFlowService`
|   |   |-- inspection/
|   |   |   |-- .gitkeep -> Empty placeholder file kept with inspection folder
|   |   |   |-- inspection-placeholder.component.html -> Vehicle handover/inspection template
|   |   |   |-- inspection-placeholder.component.scss -> Inspection styling
|   |   |   `-- inspection-placeholder.component.ts -> Checkout inspection/handover page
|   |   |-- my-bookings/
|   |   |   |-- my-bookings.component.html -> Dealer booking list/detail template
|   |   |   `-- my-bookings.component.ts -> Dealer booking ledger page with payment/detail actions
|   |   `-- settlement/
|   |       `-- .gitkeep -> Empty placeholder for future settlement flow
|   |-- dealer-analytics/
|   |   |-- dealer-analytics.html -> Dealer analytics template
|   |   |-- dealer-analytics.scss -> Dealer analytics styling
|   |   `-- dealer-analytics.ts -> Dealer analytics page using dealer-visible bookings only
|   |-- dealer-bookings/
|   |   |-- dealer-bookings.html -> Main walk-in booking wizard template (vehicle -> trip -> customer -> quotation -> confirm)
|   |   |-- dealer-bookings.scss -> Walk-in booking wizard styling
|   |   `-- dealer-bookings.ts -> Main booking wizard and walk-in quotation flow
|   |-- dealer-dashboard/
|   |   |-- dealer-dashboard.html -> Dealer dashboard template
|   |   |-- dealer-dashboard.scss -> Dealer dashboard styling
|   |   |-- dealer-dashboard.spec.ts -> Generated dealer dashboard smoke test
|   |   `-- dealer-dashboard.ts -> Dealer home page with inventory, personal bookings, quick actions
|   |-- dealer-inventory/
|   |   |-- dealer-inventory.html -> Dealer fleet inventory template
|   |   |-- dealer-inventory.scss -> Dealer inventory styling
|   |   `-- dealer-inventory.ts -> Dealer vehicle browsing/export page
|   |-- dealer-payment/
|   |   |-- payment.component.html -> Payment step template for approved bookings
|   |   |-- payment.component.scss -> Payment step styling
|   |   `-- payment.component.ts -> Payment page handling online Cashfree and offline cash flows
|   |-- dealer-quotation/
|   |   |-- quotation.component.html -> Routed quotation builder template
|   |   |-- quotation.component.scss -> Routed quotation builder styling
|   |   `-- quotation.component.ts -> Routed quotation builder/submitter backed by `BookingFlowService`
|   |-- login/
|   |   |-- login.html -> Google login screen template
|   |   |-- login.scss -> Login styling
|   |   |-- login.spec.ts -> Generated login smoke test
|   |   `-- login.ts -> Login page calling Supabase Google OAuth
|   `-- profile/
|       |-- profile.html -> Profile form template
|       |-- profile.scss -> Profile styling
|       `-- profile.ts -> User/dealer profile update and password reset page
|-- services/
|   |-- auth.spec.ts -> Generated auth service smoke test
|   |-- auth.ts -> Thin wrapper around Supabase auth and role lookup
|   |-- booking-flow.ts -> Shared state service for routed customer/quotation/payment flow
|   |-- quotation-email.service.ts -> EmailJS quotation sender
|   |-- quotation-pdf.ts -> Manual PDF builder for quotations
|   |-- supabase.spec.ts -> Generated Supabase service smoke test
|   |-- supabase.ts -> Main data service for auth, bookings, customers, quotations, payments, notifications, audit, dealer profiles
|   |-- theme.spec.ts -> Theme service unit test
|   `-- theme.ts -> Dark theme persistence/toggle service
`-- Shared/
    `-- components/
        |-- dynamic-table.component.html -> Shared reusable table template
        |-- dynamic-table.component.scss -> Shared reusable table styling
        |-- dynamic-table.component.ts -> Shared reusable table component with cancel action/status rendering
        `-- stat-card.component.ts -> Shared KPI card component with inline template/styles
```

## Section 2 - Services Map

### `auth.ts`

- `getCurrentUser()`
  - What it does: reads the current authenticated Supabase user directly from `supabase.auth.getUser()`
  - Touches: Supabase Auth API
  - Called by: `app.ts`, `layout.ts`, `Auth.getUserRole()`

- `getUserRole()`
  - What it does: loads the current user, then asks `SupabaseService` to ensure/read their role
  - Touches: `user_roles`, `dealers` indirectly via `ensureUserRoleAndDealer`
  - Called by: `app.ts`, `layout.ts`

### `booking-flow.ts`

- `loadBooking(bookingId, forceRefresh = false)`
  - What it does: caches the active booking, vehicle, and quotation-derived customer details for the routed booking flow
  - Touches: `bookings`, `vehicle`, `vehicle_tiers`, `quotations`
  - Called by: `customer-details.component.ts`, `quotation.component.ts`, `payment.component.ts`

- `setCustomer(details)`
  - What it does: stores customer form data in shared signal state
  - Touches: none
  - Called by: `customer-details.component.ts`

- `patchQuotation(draft)`
  - What it does: stores local quotation draft state like promo code/discount
  - Touches: none
  - Called by: `quotation.component.ts`

- `emptyCustomer()`
  - What it does: returns the default blank customer object used by the flow
  - Touches: none
  - Called by: service internals only

### `quotation-email.service.ts`

- `sendQuotationEmail(payload)`
  - What it does: sends quotation email via EmailJS with PDF content embedded/base64 attached
  - Touches: EmailJS REST API `https://api.emailjs.com/api/v1.0/email/send`
  - Called by: `dealer-bookings.ts`, `quotation.component.ts`

### `quotation-pdf.ts`

- `buildPdfBlob(input)`
  - What it does: builds a raw PDF blob for download/preview
  - Touches: none
  - Called by: `dealer-bookings.ts`, `quotation.component.ts`, `my-bookings.component.ts`

- `buildPdfBase64(input)`
  - What it does: builds the same quotation PDF and returns it as base64 for email attachment
  - Touches: none
  - Called by: `dealer-bookings.ts`, `quotation.component.ts`

- `buildFileName(quoteReference)`
  - What it does: sanitizes quote reference into a PDF filename
  - Touches: none
  - Called by: `dealer-bookings.ts`, `quotation.component.ts`, `my-bookings.component.ts`

### `theme.ts`

- `toggle()`
  - What it does: flips dark/light mode and persists choice to `localStorage`
  - Touches: browser `document.body.classList`, `localStorage`
  - Called by: `layout.html` via `AdminTopbar` theme toggle event

### `supabase.ts`

- `signInWithGoogle()`
  - What it does: starts Google OAuth login and redirects to `/auth/callback`
  - Touches: Supabase Auth OAuth
  - Called by: `login.ts`

- `recoverSession()`
  - What it does: refreshes auth session
  - Touches: Supabase Auth session API
  - Called by: no component call found

- `getCurrentUser()`
  - What it does: returns authenticated user or `null`
  - Touches: Supabase Auth API
  - Called by: `auth-guard.ts`, `auth-callback.ts`, `profile.ts`, `dealer-analytics.ts`, `dealer-dashboard.ts`, `dealer-bookings.ts`, `dealer-quotation.ts`, `my-bookings.component.ts`, `inspection-placeholder.component.ts`

- `signOut()`
  - What it does: signs current user out
  - Touches: Supabase Auth API
  - Called by: `layout.ts`, `dealer-dashboard.ts`

- `updateUserMetadata(data)`
  - What it does: updates auth user metadata
  - Touches: Supabase Auth user profile
  - Called by: `profile.ts`

- `resetPasswordForEmail(email)`
  - What it does: sends password reset email redirecting back to `/login`
  - Touches: Supabase Auth password reset API
  - Called by: `profile.ts`

- `getUserRole(userId)`
  - What it does: reads the first role row for a user
  - Touches: `user_roles`
  - Called by: `profile.ts`, `ensureUserRoleAndDealer()` internal

- `ensureUserRoleAndDealer(user)`
  - What it does: ensures a logged-in user has a role row; if not, inserts default `dealer` role and dealer profile
  - Touches: `user_roles`, `dealers`
  - Called by: `auth-guard.ts`, `auth.ts`, `auth-callback.ts`

- `getAllUserRoles()`
  - What it does: returns all user role rows
  - Touches: `user_roles`
  - Called by: `admin-users.ts`, `admin-audit-logs.ts`

- `getAllUsers()`
  - What it does: currently duplicates `getAllUserRoles()` and selects all rows from `user_roles`
  - Touches: `user_roles`
  - Called by: no component call found

- `updateUserRole(userId, role)`
  - What it does: changes a user's role row
  - Touches: `user_roles`
  - Called by: `admin-users.ts`

- `getVehicles()`
  - What it does: loads vehicle rows, normalizes fields, and computes effective availability using active booking windows
  - Touches: `vehicle`, `bookings`
  - Called by: `layout.ts`, `admin-dashboard.ts`, `admin-users.ts`, `admin-revenue.ts`, `admin-overview.ts`, `admin-analytics.ts`, `dealer-dashboard.ts`, `dealer-inventory.ts`

- `getBookings()`
  - What it does: loads all booking rows ordered newest-first
  - Touches: `bookings`
  - Called by: `layout.ts`, `admin-users.ts`, `admin-revenue.ts`, `admin-overview.ts`, `admin-analytics.ts`

- `getPendingBookingRequests()`
  - What it does: loads pending booking requests with customer and vehicle joins
  - Touches: `bookings`, `customers`, `vehicle`
  - Called by: `admin-overview.ts`

- `getBookingWithVehicle(bookingId)`
  - What it does: loads one booking with full vehicle and vehicle tier data
  - Touches: `bookings`, `vehicle`, `vehicle_tiers`
  - Called by: `BookingFlowService.loadBooking()`

- `addVehicle(vehicle)`
  - What it does: inserts a vehicle row
  - Touches: `vehicle`
  - Called by: `admin-dashboard.ts`

- `updateVehicle(id, vehicle)`
  - What it does: updates a vehicle row
  - Touches: `vehicle`
  - Called by: `admin-dashboard.ts`

- `deleteVehicle(id)`
  - What it does: hard deletes a vehicle row
  - Touches: `vehicle`
  - Called by: no component call found

- `createBooking(booking)`
  - What it does: inserts a basic booking request
  - Touches: `bookings`
  - Called by: `dealer-dashboard.ts`

- `getMyBookings(userId)`
  - What it does: loads bookings visible to a dealer by `user_id` or their created customers, with vehicle, customer, quotation and latest payment
  - Touches: `customers`, `bookings`, `vehicle`, `quotations`, `payments`
  - Called by: `dealer-dashboard.ts`, `dealer-analytics.ts`, `my-bookings.component.ts`

- `getQuotationByBooking(bookingId)`
  - What it does: loads one quotation by booking id
  - Touches: `quotations`
  - Called by: `BookingFlowService.loadBooking()`, `payment.component.ts`, `my-bookings.component.ts`, `inspection-placeholder.component.ts`

- `searchCustomers(query)`
  - What it does: broad customer search by mobile/email/name
  - Touches: `customers`
  - Called by: no component call found

- `searchCustomersByField(field, query)`
  - What it does: targeted returning-customer lookup by mobile or email
  - Touches: `customers`
  - Called by: `customer-details.component.ts`

- `findCustomerByMobile(mobile)`
  - What it does: exact mobile-number lookup
  - Touches: `customers`
  - Called by: `dealer-bookings.ts`

- `uploadCustomerIdProof(file, reference)`
  - What it does: uploads ID proof to Supabase Storage if a bucket exists; otherwise falls back to inline data URL
  - Touches: Supabase Storage buckets/objects
  - Called by: `dealer-bookings.ts`

- `upsertCustomerByMobile(customer)`
  - What it does: inserts or updates a customer using mobile as the natural key
  - Touches: `customers`
  - Called by: `submitQuotationRequest()` internal only

- `generateQuoteReference()`
  - What it does: generates `QT-YYYYMMDD-####` by reading existing quotations for the day
  - Touches: `quotations`
  - Called by: service internals only

- `submitQuotationRequest(input)`
  - What it does: finalizes a routed quotation flow by saving customer, updating booking, upserting quotation, notifying admins, and logging audit
  - Touches: `customers`, `bookings`, `quotations`, `user_roles`, `notifications`, `audit_logs`
  - Called by: `quotation.component.ts`

- `getWalkInVehicles(filters = {})`
  - What it does: loads booking-wizard vehicle inventory with date conflict calculations and tier/image joins
  - Touches: `vehicle`, `vehicle_tiers`, `vehicle_images`, `bookings`
  - Called by: `dealer-bookings.ts`

- `isVehicleAvailable(vehicleId, pickupDate, endDate, excludeBookingId?)`
  - What it does: checks overlap against blocking booking statuses
  - Touches: `bookings`
  - Called by: `createWalkInQuotation()` internal only

- `createOrFetchQuotation(input)`
  - What it does: reuses or creates a quotation with computed pricing for an existing booking
  - Touches: `quotations`, `vehicle`, `vehicle_tiers`
  - Called by: `dealer-bookings.ts`

- `buildQuotationPricingPreview(vehicle, startDate, endDate, options?)`
  - What it does: computes rate, days, GST, advance, discount and totals in memory from vehicle tier data
  - Touches: none
  - Called by: `quotation.component.ts`, `payment.component.ts`

- `createWalkInQuotation(input)`
  - What it does: main walk-in booking creator; validates availability, creates/loads customer, inserts booking, creates quotation, marks vehicle booked, logs audit
  - Touches: `customers`, `bookings`, `quotations`, `vehicle`, `audit_logs`
  - Called by: `dealer-bookings.ts`

- `confirmWalkInBooking(bookingId, advanceMode = 'online', customerChannel?)`
  - What it does: flips walk-in quotation to submitted, keeps booking pending, stores total price/advance mode, notifies admins, logs audit
  - Touches: `quotations`, `bookings`, `notifications`, `user_roles`, `audit_logs`
  - Called by: `dealer-bookings.ts`

- `markQuotationSent(bookingId)`
  - What it does: timestamps quotation send
  - Touches: `quotations`
  - Called by: `dealer-bookings.ts`, `quotation.component.ts`

- `saveQuotationDraft(payload)`
  - What it does: upserts sanitized quotation payload by booking id
  - Touches: `quotations`
  - Called by: `quotation.component.ts`

- `updateBookingQuoteStatus(bookingId, quoteStatus, status?)`
  - What it does: if `status` is omitted it updates quotation status; if `status` is provided it updates booking status only
  - Touches: `quotations` or `bookings`
  - Called by: `quotation.component.ts`

- `validatePromotion(code)`
  - What it does: validates active promo code
  - Touches: `promotions`
  - Called by: `quotation.component.ts`

- `getBookingsByVehicle(vehicleId)`
  - What it does: loads all bookings for one vehicle
  - Touches: `bookings`
  - Called by: `dealer-dashboard.ts`

- `getMyBulkBookings(userId)`
  - What it does: loads dealer bulk bookings and child booking rows
  - Touches: `bulk_bookings`, `bookings`, `vehicle`
  - Called by: `my-bookings.component.ts`

- `updateBookingStatus(bookingId, newStatus)`
  - What it does: writes a new booking status
  - Touches: `bookings`
  - Called by: `dealer-dashboard.ts`, `my-bookings.component.ts`

- `approveBookingRequest(bookingId)`
  - What it does: admin approval path; approves booking and quotation, optionally auto-activates cash-paid bookings, updates vehicle next availability, sends notification and email, logs audit
  - Touches: `bookings`, `quotations`, `payments`, `vehicle`, `notifications`, `dealers`, Supabase Function `send-booking-confirmation`, `audit_logs`
  - Called by: `admin-dealer-performance.ts`

- `rejectBookingRequest(bookingId, reason)`
  - What it does: admin rejection path; rejects booking and quotation, may release vehicle, notifies advisor, logs audit
  - Touches: `bookings`, `quotations`, `vehicle`, `notifications`, `audit_logs`
  - Called by: `admin-dealer-performance.ts`

- `getBookingRequestDetails(bookingId)`
  - What it does: loads booking plus vehicle and quotation for approval/rejection internals
  - Touches: `bookings`, `vehicle`, `quotations`
  - Called by: service internals only

- `getAdminBookingDetails(bookingId)`
  - What it does: loads rich booking detail with customer, vehicle, quotation and advisor display name
  - Touches: `bookings`, `customers`, `vehicle`, `quotations`, `dealers`
  - Called by: `admin-dealer-performance.ts`, `confirmWalkInBooking()` internal

- `approveBooking(bookingId)`
  - What it does: basic booking status approval helper
  - Touches: `bookings`
  - Called by: no component call found

- `rejectBooking(bookingId, reason)`
  - What it does: basic booking status reject helper
  - Touches: `bookings`
  - Called by: no component call found

- `insertBulkBooking(data)`
  - What it does: inserts bulk booking header row
  - Touches: `bulk_bookings`
  - Called by: no component call found

- `getBulkBookings()`
  - What it does: loads all bulk booking headers
  - Touches: `bulk_bookings`
  - Called by: no component call found

- `insertNotification(userId, title, message, bookingId?, type?)`
  - What it does: convenience wrapper around notification insert
  - Touches: `notifications`
  - Called by: no component call found

- `insertNotificationPayload(payload)`
  - What it does: inserts one notification row
  - Touches: `notifications`
  - Called by: `approveBookingRequest()` and `rejectBookingRequest()` internal only

- `notifyAdminsOfBookingRequest(booking, quotation, vehicle, advisorName)`
  - What it does: finds admins/superadmins and inserts booking request notifications
  - Touches: `user_roles`, `notifications`
  - Called by: `submitQuotationRequest()`, `confirmWalkInBooking()` internal only

- `getMyNotifications()`
  - What it does: loads latest unread notifications for current user
  - Touches: `notifications`
  - Called by: `layout.ts`

- `markNotificationsRead(userId)`
  - What it does: marks all unread notifications for a user as read
  - Touches: `notifications`
  - Called by: `layout.ts`

- `markNotificationRead(notificationId)`
  - What it does: marks one notification as read
  - Touches: `notifications`
  - Called by: `layout.ts`

- `subscribeToNotifications(userId, callback)`
  - What it does: realtime subscription for notification changes for one user
  - Touches: Supabase Realtime on `notifications`
  - Called by: `layout.ts`

- `subscribeToAllBookingChanges(callback)`
  - What it does: realtime subscription for all booking changes
  - Touches: Supabase Realtime on `bookings`
  - Called by: `admin-dealer-performance.ts`

- `subscribeToMyBookingChanges(userId, callback)`
  - What it does: realtime subscription for dealer-owned bookings by `user_id`
  - Touches: Supabase Realtime on `bookings`
  - Called by: `my-bookings.component.ts`

- `releaseExpiredBookings()`
  - What it does: finds old approved/in-service bookings and marks vehicles dirty
  - Touches: `bookings`, `vehicle`
  - Called by: `admin-overview.ts`

- `sendCustomerConfirmationEmail(booking)`
  - What it does: invokes Supabase edge function to send booking-initiation email through Resend
  - Touches: `dealers`, Supabase Function `send-booking-confirmation`, `audit_logs` when email missing
  - Called by: `approveBookingRequest()` internal only

- `sendQuotationEmail(payload)`
  - What it does: alternate server-side quotation email sender using Supabase edge function plus attachment
  - Touches: `dealers`, Supabase Function `send-booking-confirmation`
  - Called by: no component call found

- `getAuditLogs()`
  - What it does: loads audit log rows
  - Touches: `audit_logs`
  - Called by: `admin-audit-logs.ts`

- `getDealerProfile(userId)`
  - What it does: loads dealer profile row for a user
  - Touches: `dealers`
  - Called by: `profile.ts`, service internals

- `upsertDealerProfile(payload)`
  - What it does: updates existing dealer profile or inserts a new one
  - Touches: `dealers`
  - Called by: `profile.ts`, `ensureUserRoleAndDealer()` internal

- `logAudit(action, entityId?)`
  - What it does: inserts audit log row for current user
  - Touches: `audit_logs`
  - Called by: `admin-dashboard.ts` and multiple service internals

- `createCashfreeOrder(bookingId, quotationId, amount)`
  - What it does: starts online payment by delegating to the Vercel API flow
  - Touches: `payments` via RPC `insert_payment_record`, Vercel `/api/create-cashfree-order`, Cashfree order API
  - Called by: `payment.component.ts`

- `updatePaymentStatusByBookingId(bookingId, status)`
  - What it does: updates payment row(s) for a booking to a status such as `paid`
  - Touches: `payments`
  - Called by: `payment.component.ts`

- `markBookingInService(bookingId)`
  - What it does: sets booking status to `in_service`
  - Touches: `bookings`
  - Called by: `payment.component.ts`, `admin-dealer-performance.ts`, `approveBookingRequest()` internal

- `verifyAndActivatePayment(bookingId, currentBookingStatus)`
  - What it does: if an approved booking already has a paid payment row, flips booking to `in_service`
  - Touches: `payments`, `bookings`
  - Called by: no component call found

- `updatePaymentStatus(cfOrderId, status, cfPaymentId?)`
  - What it does: calls database RPC `update_payment_status`
  - Touches: database RPC `update_payment_status` (repo SQL for this RPC is not present)
  - Called by: no component call found

- `getPaymentByBooking(bookingId)`
  - What it does: loads latest payment row for a booking and normalizes `success` to `paid`
  - Touches: `payments`
  - Called by: `admin-dealer-performance.ts`, `payment.component.ts`, `my-bookings.component.ts`

- `recordOfflineAdvancePayment(bookingId, amount)`
  - What it does: inserts a paid cash advance payment row
  - Touches: `payments`
  - Called by: `dealer-bookings.ts`, `payment.component.ts`

- `getAdminBookingLedger()`
  - What it does: loads all bookings for admin ledger with customer, vehicle, quotation summary and latest payment
  - Touches: `bookings`, `customers`, `vehicle`, `quotations`, `payments`
  - Called by: `admin-dealer-performance.ts`

- `getBookingById(bookingId)`
  - What it does: loads a single booking
  - Touches: `bookings`
  - Called by: `inspection-placeholder.component.ts`

- `getCustomerById(customerId)`
  - What it does: loads a single customer
  - Touches: `customers`
  - Called by: `inspection-placeholder.component.ts`

- `getVehicleById(vehicleId)`
  - What it does: loads a single vehicle
  - Touches: `vehicle`
  - Called by: `inspection-placeholder.component.ts`

- `createInspection(data)`
  - What it does: inserts a completed inspection/handover row
  - Touches: `inspections`
  - Called by: `inspection-placeholder.component.ts`

- `updateVehicleForTrip(vehicleId, mileage)`
  - What it does: updates vehicle to `rented` and stores odometer at handover
  - Touches: `vehicle`
  - Called by: `inspection-placeholder.component.ts`

## Section 3 - Pages Map

### `/login` - `Login`
- Access: both
- Purpose: Google sign-in entry page
- Key functions: `googleLogin()` starts Supabase Google OAuth
- Services: `SupabaseService`
- Navigation: Supabase redirect to `/auth/callback`

### `/auth/callback` - `AuthCallback`
- Access: both after OAuth
- Purpose: waits for session, ensures role/profile exist, then routes user to correct portal
- Key functions: `ngOnInit()` loads current user, calls `ensureUserRoleAndDealer()`, redirects admin to `/admin/dashboard` else dealer to `/dealer/dashboard`
- Services: `SupabaseService`
- Navigation: `/login`, `/admin/dashboard`, `/dealer/dashboard`

### `/admin/dashboard` - `AdminOverview`
- Access: admin
- Purpose: executive dashboard with KPIs, charts, pending actions, and daily bookings
- Key functions: `loadDashboard()` releases expired bookings, loads vehicles/bookings/pending requests, builds cards/charts/action feed; `goTo()` deep-links to admin sections
- Services: `SupabaseService`
- Navigation: mainly `/admin/bookings`, `/admin/vehicles`

### `/admin/vehicles` - `AdminDashboard`
- Access: admin
- Purpose: vehicle CRUD/archive page
- Key functions: `loadVehicles()`, `openNew()`, `openEdit()`, `saveVehicle()`, `confirmDelete()`, `exportCsv()`
- Services: `SupabaseService`
- Navigation: none; modal-based operations

### `/admin/bookings` - `AdminDealerPerformance`
- Access: admin
- Purpose: admin booking ledger with approve/reject/handover actions and payment visibility
- Key functions: `loadLedger()`, `viewDetails()`, `approveBooking()`, `rejectBooking()`, `markInService()`
- Services: `SupabaseService`
- Navigation: none; dialog-based operations

### `/admin/users` - `AdminUsers`
- Access: admin
- Purpose: user/role list with derived booking metrics and profile drawer
- Key functions: `loadUsers()`, `applyTabFilter()`, `toggleRole()`, `toggleActive()`, `openProfile()`
- Services: `SupabaseService`
- Navigation: none

### `/admin/reports` - `AdminRevenue`
- Access: admin
- Purpose: reporting/revenue view built from current bookings data
- Key functions: `ngOnInit()` builds KPIs/charts; `export(format)` exports CSV or triggers print
- Services: `SupabaseService`
- Navigation: none

### `/admin/analytics` - `AdminAnalytics`
- Access: admin
- Purpose: analytical charts around revenue, fleet utilization, booking volume, top vehicles
- Key functions: `ngOnInit()` loads vehicles/bookings and computes charts
- Services: `SupabaseService`
- Navigation: none

### `/admin/audit` - `AdminAuditLogs`
- Access: admin
- Purpose: audit log filter/export page
- Key functions: `loadLogs()`, `exportLogs()`
- Services: `SupabaseService`
- Navigation: none

### `/dealer/dashboard` - `DealerDashboard`
- Access: dealer
- Purpose: dealer home page with inventory snapshot, dealer bookings, quick booking dialog, realtime refresh
- Key functions: `loadUserInfo()`, `loadVehicles()`, `loadMyBookings()`, `submitBooking()`, `cancelBooking()`, `openQuotation()`, `openBooking()`, `setupRealtimeSubscriptions()`
- Services: `SupabaseService`
- Navigation: `/dealer/bookings`, `/dealer/my-bookings`, `/dealer/inventory`, `/login`

### `/dealer/inventory` - `DealerInventory`
- Access: dealer
- Purpose: browse/filter/export fleet inventory and start booking from a vehicle
- Key functions: `ngOnInit()`, `exportCsv()`, `bookVehicle()`
- Services: `SupabaseService`
- Navigation: `/dealer/bookings?vehicleId=...`

### `/dealer/analytics` - `DealerAnalytics`
- Access: dealer
- Purpose: dealer-only booking analytics
- Key functions: `ngOnInit()`, `downloadReport()`
- Services: `SupabaseService`
- Navigation: none

### `/dealer/bookings` - `DealerBookings`
- Access: dealer
- Purpose: main walk-in booking wizard
- Key functions:
  - `loadVehicles()` loads date-filtered walk-in vehicles
  - `selectVehicle()` moves to trip step
  - `continueToCustomer()` validates trip and advances
  - `lookupCustomerByMobile()` checks `customers`
  - `onIdProofSelected()` uploads ID proof to storage/data URL
  - `generateQuotation()` creates booking+quotation or refreshes quotation
  - `sendQuote()` sends via EmailJS or prepares SMS/WhatsApp
  - `confirmOfflineCollection()` inserts offline cash advance
  - `confirmBooking()` submits request for admin approval
- Services: `SupabaseService`, `QuotationPdfService`, `QuotationEmailService`
- Navigation: `/dealer/my-bookings`

### `/dealer/my-bookings` - `MyBookingsComponent`
- Access: dealer
- Purpose: dealer booking ledger for single and bulk bookings with payment/detail actions
- Key functions: `loadData()`, `openDetail()`, `openPayment()`, `openInspection()`, `cancelBooking()`, `downloadPaymentConfirmation()`
- Services: `SupabaseService`, `QuotationPdfService`
- Navigation: `/dealer/booking/:bookingId/payments`, `/dealer/inspection/:bookingId`

### `/dealer/booking/:bookingId/customer-details` - `CustomerDetailsComponent`
- Access: dealer
- Purpose: routed customer-details step for the newer stateful flow
- Key functions: `ngOnInit()` loads booking via `BookingFlowService`; `queueCustomerSearch()` searches returning customers; `selectSuggestion()` pre-fills form; `continueToQuotation()` stores shared customer state
- Services: `BookingFlowService`, `SupabaseService`
- Navigation: `/dealer/my-bookings`, `/dealer/booking/:bookingId/quotation`

### `/dealer/booking/:bookingId/quotation` - `QuotationComponent`
- Access: dealer
- Purpose: routed quotation builder/submission page for an existing booking
- Key functions: `applyPromo()`, `saveDraft()`, `sendQuote()`, `confirmBooking()`, `openPreview()`
- Services: `BookingFlowService`, `SupabaseService`, `QuotationPdfService`, `QuotationEmailService`
- Navigation: `/dealer/my-bookings`, `/dealer/booking/:bookingId/customer-details`

### `/dealer/booking/:bookingId/payments` - `PaymentComponent`
- Access: dealer
- Purpose: approved-booking payment screen
- Key functions: `proceedToGateway()` starts Cashfree flow; `confirmOfflineCollection()` records cash advance; `goToInspection()` opens inspection
- Services: `BookingFlowService`, `SupabaseService`
- Navigation: `/dealer/inspection/:bookingId`, `/dealer/my-bookings`

### `/dealer/inspection/:bookingId` - `InspectionPlaceholderComponent`
- Access: dealer
- Purpose: vehicle checkout/handover inspection page once booking is `in_service`
- Key functions: `ngOnInit()` blocks access unless booking is `in_service`; `submitInspection()` inserts inspection and updates vehicle to rented
- Services: `SupabaseService`
- Navigation: `/dealer/my-bookings`

### `/profile` - `ProfileComponent`
- Access: both
- Purpose: profile and dealer-contact updater with password reset
- Key functions: `ngOnInit()`, `updateProfile()`, `changePassword()`
- Services: `SupabaseService`
- Navigation: none

## Section 4 - Complete Booking Flow

### Walk-in wizard in `DealerBookings`

1. Step 1 - Vehicle selection
   - Component: `dealer-bookings.ts`
   - Functions: `loadVehicles()`, `selectVehicle()`
   - Reads/writes: reads `vehicle`, `vehicle_tiers`, `vehicle_images`, `bookings`; no writes
   - Booking status: none yet

2. Step 2 - Trip details
   - Component: `dealer-bookings.ts`
   - Functions: `updateTrip()`, `tripInvalid()`, `continueToCustomer()`
   - Reads/writes: no database write
   - Booking status: none yet

3. Step 3 - Customer details
   - Component: `dealer-bookings.ts`
   - Functions: `lookupCustomerByMobile()`, `onIdProofSelected()`, `continueToQuotation()`
   - Reads/writes:
     - reads `customers`
     - uploads to Supabase Storage if possible
     - actual DB write happens next in `generateQuotation()`
   - Booking status: none yet

4. Step 4 - Quotation generation
   - Component: `dealer-bookings.ts`
   - Function: `generateQuotation()` -> `createWalkInQuotation()`
   - Writes in order:
     - `customers`: insert, update, or reuse existing by mobile
     - `bookings`: insert new booking row with `status = 'pending'`
     - `quotations`: create quotation/pricing row, usually `status = 'draft'`
     - `vehicle`: update selected vehicle to `vehicle_status = 'booked'`, `next_available_date = trip.end_date`
     - `audit_logs`: `walk_in_quotation_generated`
   - Booking status after this step: `pending`

5. Step 4a - Optional quotation share
   - Component: `dealer-bookings.ts`
   - Functions: `sendQuote('email'|'sms'|'whatsapp')`
   - Writes:
     - Email path: EmailJS API call, then `quotations.sent_at`
     - SMS/WhatsApp path: no DB write
   - Booking status: still `pending`

6. Step 5 - Submit for approval
   - Component: `dealer-bookings.ts`
   - Function: `confirmBooking()` -> `confirmWalkInBooking()`
   - Writes in order:
     - `quotations`: `status = 'submitted'`, `sent_at`, `advance_mode`
     - `bookings`: keeps `status = 'pending'`, writes `total_price`
     - `notifications`: inserts admin notifications
     - `audit_logs`: `walk_in_booking_submitted:<channel>`
   - Booking status after this step: `pending`

### Admin approval

7. Admin review/approval
   - Component: `admin-dealer-performance.ts`
   - Function: `approveBooking()` -> `approveBookingRequest()`
   - Writes in order:
     - `bookings`: `status = 'approved'`, `approved_by`, `approved_at`
     - `quotations`: `status = 'approved'`
     - `payments`: read latest cash payment; if cash payment already exists, no new write here
     - `bookings`: may immediately become `in_service` via `markBookingInService()` when a paid cash row already exists
     - `vehicle`: updates `next_available_date = booking.end_date`
     - `notifications`: inserts approval notification to advisor/user
     - Supabase function `send-booking-confirmation`
     - `audit_logs`: `booking_approved`
   - Booking status after admin approval:
     - normally `approved`
     - immediately `in_service` when an offline cash payment already exists

### Payment and inspection

8. Payment
   - Components: `payment.component.ts` or earlier `dealer-bookings.ts` offline-cash button
   - Online path status: `approved` -> `in_service`
   - Offline path status:
     - if cash was recorded in wizard before admin approval: `pending` -> `approved` -> auto `in_service` on approval
     - if cash is recorded on payment page after approval: `approved` -> `in_service`

9. Inspection / handover
   - Component: `inspection-placeholder.component.ts`
   - Function: `submitInspection()`
   - Writes:
     - `inspections`: insert completed checkout inspection
     - `vehicle`: update to `vehicle_status = 'rented'`, update mileage
   - Booking status after inspection: remains `in_service`

## Section 5 - Payment Flow

### Online via Cashfree

Current live client path is optimistic and uses the Vercel order-creation function, but it does not call the verification function afterward.

1. Dealer clicks online payment button on `PaymentComponent`
   - Function: `openPaymentDialog()` then `proceedToGateway()`

2. `proceedToGateway()` calls `SupabaseService.createCashfreeOrder()`
   - Function chain: `createCashfreeOrder()` -> private `createViaVercelApi()`

3. `createViaVercelApi()` first checks for fresh initiated payments
   - Table: `payments`
   - Purpose: idempotent reuse of recent initiated session

4. `createViaVercelApi()` loads booking/customer context
   - Table: `bookings` with joined `customers`
   - Guard: booking must already be `approved`

5. `createViaVercelApi()` calls Vercel function
   - API: `POST /api/create-cashfree-order`
   - File: `api/create-cashfree-order.js`
   - That function calls Cashfree `POST /orders`

6. After Vercel returns `payment_session_id`, client inserts payment record through RPC
   - Function: `insert_payment_record`
   - Source call: `supabase.ts` private `createViaVercelApi()`
   - Table updated by RPC: `payments`
   - Inserted state: `status = 'initiated'`, `payment_type = 'balance'`, `cf_order_id`, `cf_payment_session_id`

7. `PaymentComponent.proceedToGateway()` launches Cashfree SDK checkout
   - API: `window.Cashfree(...).checkout(...)`

8. After SDK resolves, the client immediately marks the payment paid
   - Function: `updatePaymentStatusByBookingId(bookingId, 'paid')`
   - Table: `payments`

9. Client immediately activates booking
   - Function: `markBookingInService(bookingId)`
   - Table: `bookings`
   - Resulting status: `in_service`

10. Booking flow cache refreshes and inspection unlocks
    - Function: `flow.loadBooking(bookingId, true)`
    - Navigation: `/dealer/inspection/:bookingId`

Important note:
- `api/confirm-cashfree-payment.js` exists, and `supabase/functions/confirm-cashfree-payment/index.ts` also exists, but neither is used by the current UI flow.
- The current UI does not wait for server-side verification before calling `updatePaymentStatusByBookingId(..., 'paid')` and `markBookingInService(...)`.

### Offline cash

There are two offline-cash entry points in the current codebase.

#### A. Wizard-time offline cash in `DealerBookings`

1. Dealer records offline advance from walk-in wizard
   - Function: `confirmOfflineCollection()`

2. Payment row is inserted immediately
   - Function: `recordOfflineAdvancePayment(bookingId, quotation.advance)`
   - Table: `payments`
   - Inserted state: `payment_type = 'advance'`, `payment_mode = 'cash'`, `status = 'paid'`

3. Dealer later submits booking for admin approval
   - Function: `confirmBooking()` -> `confirmWalkInBooking()`
   - Tables updated: `quotations`, `bookings`, `notifications`, `audit_logs`

4. Admin approves booking
   - Function: `approveBookingRequest()`
   - It detects existing paid cash payment in `payments`
   - Then calls `markBookingInService()`
   - Table: `bookings`

5. Inspection becomes available
   - Booking status: `in_service`
   - User opens `/dealer/inspection/:bookingId`

#### B. Payment-page offline cash in `PaymentComponent`

1. Dealer clicks offline collection button on payment page
   - Function: `confirmOfflineCollection()`

2. Offline payment row is inserted
   - Function: `recordOfflineAdvancePayment(bookingId, advance)`
   - Table: `payments`

3. Booking is immediately activated
   - Function: `markBookingInService(bookingId)`
   - Table: `bookings`

4. Booking cache refreshes and inspection opens
   - Function: `flow.loadBooking(bookingId, true)`
   - Navigation: `/dealer/inspection/:bookingId`

## Section 6 - Dead Code & Unused Files

### Methods or files with no clear caller

- `src/app/services/supabase.ts:102` `recoverSession()`
  - No component or service call found.

- `src/app/services/supabase.ts:180` `getAllUsers()`
  - No component call found; duplicates `getAllUserRoles()` behavior.

- `src/app/services/supabase.ts:315` `deleteVehicle(id)`
  - No component call found; admin UI archives via `updateVehicle(..., { status: 'deleted' })` instead.

- `src/app/services/supabase.ts:385` `searchCustomers(query)`
  - No component call found; current UI uses `searchCustomersByField()`.

- `src/app/services/supabase.ts:1480` `approveBooking(bookingId)`
  - No component call found; admin UI uses `approveBookingRequest()` instead.

- `src/app/services/supabase.ts:1488` `rejectBooking(bookingId, reason)`
  - No component call found; admin UI uses `rejectBookingRequest()` instead.

- `src/app/services/supabase.ts:1495` `insertBulkBooking(data)`
  - No component call found.

- `src/app/services/supabase.ts:1499` `getBulkBookings()`
  - No component call found; dealer UI uses `getMyBulkBookings()` instead.

- `src/app/services/supabase.ts:1503` `insertNotification(...)`
  - No component call found; internals use `insertNotificationPayload()` directly.

- `src/app/services/supabase.ts:1640` `sendQuotationEmail(payload)`
  - No component call found; UI uses `QuotationEmailService` / EmailJS instead of this server-side sender.

- `src/app/services/supabase.ts:1783` `verifyAndActivatePayment(...)`
  - No component call found.

- `src/app/services/supabase.ts:1802` `updatePaymentStatus(cfOrderId, status, cfPaymentId?)`
  - No component call found.

### Components/pages without route entry

- `src/app/pages/booking/booking-dialog.component/booking-dialog.component.ts`
  - Not present in `app.routes.ts`.
  - It is still used inside `dealer-dashboard.ts`, so it is not dead, but it is not independently routable.

### Likely unused files/placeholders

- `src/app/pages/booking/contract/.gitkeep`
  - Placeholder only; no route, no component.

- `src/app/pages/booking/settlement/.gitkeep`
  - Placeholder only; no route, no component.

- `src/app/app.config.ts`
  - Defined, but current bootstrap in `src/main.ts` does not import/use `appConfig`.

### Imported but unused in code

- `src/app/pages/login/login.ts:16-18`
  - Constructor injects `Auth` and `Router`, but `googleLogin()` only uses `SupabaseService`.

- `src/app/app.ts:1-5,19`
  - `Inject`, `signal`, and injected `SupabaseService` are unused in the class body.

### Payment/server files apparently not wired into the live UI flow

- `api/confirm-cashfree-payment.js`
  - No frontend fetch/import found; current UI never calls this verification endpoint.

- `supabase/functions/create-cashfree-order/index.ts`
  - No `supabase.functions.invoke('create-cashfree-order', ...)` call found.
  - Current app uses `POST /api/create-cashfree-order` instead.

- `supabase/functions/confirm-cashfree-payment/index.ts`
  - No invoke call found.

- `supabase/functions/send-booking-confirmation/index.ts`
  - Used by `supabase.ts` at lines around `1620` and `1650`; this one is active.

### SQL objects that do not match current app calls

- `supabase/create_payment_functions.sql`
  - Defines `confirm_booking_payment(...)`, but no call to that RPC exists in the codebase.
  - Current code instead references RPC `update_payment_status`, whose SQL definition is not present in this repo.

## Section 7 - Package Dependencies

### Runtime dependencies

- `@angular/animations`
  - Purpose: Angular animation runtime support
  - Imported by: no direct import in `src/app`; likely indirectly required by Angular/PrimeNG ecosystem
  - Appears completely unused: no direct app import found

- `@angular/common`
  - Purpose: common Angular directives/pipes
  - Imported by: most components/pages, `theme.ts`
  - Appears completely unused: no

- `@angular/compiler`
  - Purpose: Angular template compiler runtime package
  - Imported by: no direct app import
  - Appears completely unused: no direct app import found

- `@angular/core`
  - Purpose: Angular component/service/runtime primitives
  - Imported by: almost every TS file under `src/app`
  - Appears completely unused: no

- `@angular/forms`
  - Purpose: template-driven forms
  - Imported by: form-based pages/components and `admin-topbar.ts`
  - Appears completely unused: no

- `@angular/platform-browser`
  - Purpose: browser bootstrap and DOM utilities
  - Imported by: `main.ts`, `dealer-bookings.ts`, `quotation.component.ts`
  - Appears completely unused: no

- `@angular/router`
  - Purpose: routing/guards/navigation
  - Imported by: `main.ts`, `app.config.ts`, `app.routes.ts`, shell pages, route-aware pages
  - Appears completely unused: no

- `@primeng/themes`
  - Purpose: PrimeNG theme preset package
  - Imported by: `main.ts` (`@primeng/themes/aura`)
  - Appears completely unused: no

- `@primeuix/themes`
  - Purpose: extra Prime/PrimeUIX theme package
  - Imported by: no direct import found
  - Appears completely unused: yes, in current source tree

- `@supabase/supabase-js`
  - Purpose: Supabase client
  - Imported by: `src/app/services/supabase.ts`
  - Appears completely unused: no

- `chart.js`
  - Purpose: chart runtime used under PrimeNG chart components
  - Imported by: no direct import found
  - Appears completely unused: no direct import found, but likely transitively required by `primeng/chart`

- `primeicons`
  - Purpose: Prime icon font
  - Imported by: `src/styles.scss`
  - Appears completely unused: no

- `primeng`
  - Purpose: UI component library
  - Imported by: `main.ts`, `app.ts`, shell components, shared components, nearly every page
  - Appears completely unused: no

- `rxjs`
  - Purpose: reactive utilities
  - Imported by: `layout.ts`, `admin-overview.ts`
  - Appears completely unused: no

- `tslib`
  - Purpose: TypeScript runtime helper library
  - Imported by: no direct import found
  - Appears completely unused: no direct app import; usually build/runtime support

### Dev dependencies

- `@angular-devkit/build-angular`
  - Purpose: Angular build pipeline
  - Imported by: no source import; used by CLI/build
  - Appears completely unused: no, but not imported in app code

- `@angular/build`
  - Purpose: Angular build tooling
  - Imported by: no source import
  - Appears completely unused: no, but not imported in app code

- `@angular/cli`
  - Purpose: Angular CLI
  - Imported by: no source import
  - Appears completely unused: no, but not imported in app code

- `@angular/compiler-cli`
  - Purpose: Angular compilation tooling
  - Imported by: no source import
  - Appears completely unused: no, but not imported in app code

- `autoprefixer`
  - Purpose: CSS post-processing
  - Imported by: no source import
  - Appears completely unused: unknown from code only; no direct import

- `jsdom`
  - Purpose: test DOM runtime
  - Imported by: no source import
  - Appears completely unused: no direct import found

- `postcss`
  - Purpose: CSS build tooling
  - Imported by: no source import
  - Appears completely unused: unknown from code only; no direct import

- `tailwindcss`
  - Purpose: Tailwind build tooling
  - Imported by: no source import
  - Appears completely unused: yes in app source; no Tailwind config/classes were inspected here

- `typescript`
  - Purpose: TS compiler
  - Imported by: no source import
  - Appears completely unused: no direct import; build tool only

- `vitest`
  - Purpose: test runner
  - Imported by: no source import
  - Appears completely unused: no direct import found

## Section 8 - Database Usage Map

### `user_roles`
- SELECT by: `getUserRole()`, `getAllUserRoles()`, `getAllUsers()`, `notifyAdminsOfBookingRequest()`
- INSERT/UPDATE by: `ensureUserRoleAndDealer()` insert, `updateUserRole()` update
- Triggered by: auth guard/auth callback/`Auth.getUserRole()`, `admin-users.ts`, `admin-audit-logs.ts`, booking submission notification flow

### `dealers`
- SELECT by: `getDealerProfile()`, `resolveAdvisorDisplayName()` internal, `sendCustomerConfirmationEmail()` internal, `sendQuotationEmail()` internal
- INSERT/UPDATE by: `upsertDealerProfile()`, `ensureUserRoleAndDealer()` via `upsertDealerProfile()`
- Triggered by: `profile.ts`, auth callback/guard role bootstrap, admin approval email flow

### `vehicle`
- SELECT by: `getVehicles()`, `getBookingWithVehicle()`, `getPendingBookingRequests()`, `getWalkInVehicles()`, `createOrFetchQuotation()`, `getAdminBookingDetails()`, `getBookingRequestDetails()`, `getVehicleById()`
- INSERT/UPDATE by: `addVehicle()`, `updateVehicle()`, `deleteVehicle()`, `createWalkInQuotation()` update, `approveBookingRequest()` update, `rejectBookingRequest()` update, `releaseExpiredBookings()` update, `updateVehicleForTrip()` update
- Triggered by: admin vehicle page, dealer inventory/dashboard, walk-in wizard, admin approve/reject, inspection handover

### `vehicle_tiers`
- SELECT by: `getBookingWithVehicle()`, `getWalkInVehicles()`, `createOrFetchQuotation()`
- INSERT/UPDATE by: none in current app code
- Triggered by: `BookingFlowService`, dealer walk-in wizard, routed quotation/payment pages

### `vehicle_images`
- SELECT by: `getWalkInVehicles()`
- INSERT/UPDATE by: none
- Triggered by: `dealer-bookings.ts`

### `bookings`
- SELECT by: `getBookings()`, `getPendingBookingRequests()`, `getBookingWithVehicle()`, `getMyBookings()`, `getWalkInVehicles()` conflict check, `isVehicleAvailable()`, `getBookingsByVehicle()`, `getMyBulkBookings()`, `getBookingRequestDetails()`, `getAdminBookingDetails()`, `getAdminBookingLedger()`, `getBookingById()`, `releaseExpiredBookings()`, `createViaVercelApi()` internal
- INSERT/UPDATE by:
  - `createBooking()` insert
  - `submitQuotationRequest()` update
  - `createWalkInQuotation()` insert
  - `confirmWalkInBooking()` update
  - `updateBookingQuoteStatus()` may update booking
  - `updateBookingStatus()` update
  - `approveBookingRequest()` update
  - `rejectBookingRequest()` update
  - `approveBooking()` update
  - `rejectBooking()` update
  - `markBookingInService()` update
  - `verifyAndActivatePayment()` update
- Triggered by: dealer dashboard, dealer booking wizard, routed quotation flow, admin approval/rejection, payment page, my bookings cancel flow

### `customers`
- SELECT by: `getMyBookings()`, `searchCustomers()`, `searchCustomersByField()`, `findCustomerByMobile()`, `createWalkInQuotation()` lookup, `getAdminBookingDetails()`, `getPendingBookingRequests()`, `getCustomerById()`, `createViaVercelApi()` joined customer data
- INSERT/UPDATE by: `upsertCustomerByMobile()`, `submitQuotationRequest()`, `createWalkInQuotation()`
- Triggered by: dealer bookings wizard, routed quotation flow, customer-details routed step, payment/order context, admin booking details

### `quotations`
- SELECT by: `getQuotationByBooking()`, `generateQuoteReference()`, `createOrFetchQuotation()`, `getAdminBookingLedger()`
- INSERT/UPDATE by:
  - `submitQuotationRequest()`
  - `createOrFetchQuotation()`
  - `createWalkInQuotation()`
  - `confirmWalkInBooking()`
  - `markQuotationSent()`
  - `saveQuotationDraft()`
  - `updateBookingQuoteStatus()`
  - `approveBookingRequest()`
  - `rejectBookingRequest()`
- Triggered by: dealer bookings wizard, routed quotation page, payment page, admin booking page

### `promotions`
- SELECT by: `validatePromotion()`
- INSERT/UPDATE by: none
- Triggered by: `quotation.component.ts`

### `bulk_bookings`
- SELECT by: `getMyBulkBookings()`, `getBulkBookings()`
- INSERT/UPDATE by: `insertBulkBooking()`
- Triggered by: dealer my-bookings page for reads; no current write caller found

### `payments`
- SELECT by: `approveBookingRequest()` cash check, `getPaymentByBooking()`, `getAdminBookingLedger()` via latest-payment helper, `getMyBookings()` via latest-payment helper, `verifyAndActivatePayment()`, `createViaVercelApi()` idempotency check
- INSERT/UPDATE by:
  - `recordOfflineAdvancePayment()` insert
  - `updatePaymentStatusByBookingId()` update
  - `updatePaymentStatus()` RPC
  - `createCashfreeOrder()` / `createViaVercelApi()` RPC `insert_payment_record`
  - SQL `fix_existing_payments.sql`
- Triggered by: dealer payment page, dealer bookings wizard offline cash, admin approval auto-check, my bookings/admin ledger payment display

### `notifications`
- SELECT by: `getMyNotifications()`
- INSERT/UPDATE by: `insertNotification()`, `insertNotificationPayload()`, `notifyAdminsOfBookingRequest()`, `markNotificationsRead()`, `markNotificationRead()`
- Triggered by: walk-in submission, routed quotation submission, admin approval/rejection, layout notification UI

### `audit_logs`
- SELECT by: `getAuditLogs()`
- INSERT/UPDATE by: `logAudit()`, plus audit writes from many service flows
- Triggered by: admin vehicle page, walk-in quotation flow, admin approval/rejection, email skip path

### `inspections`
- SELECT by: none in current code
- INSERT/UPDATE by: `createInspection()`
- Triggered by: `inspection-placeholder.component.ts`

## Section 9 - RLS & Auth Notes

These are inferences from client behavior, not confirmed policies from the database dashboard.

### Broad RLS shape inferred from the app

- `vehicle`, `bookings`, `customers`, `quotations`, `payments`, `notifications`, `audit_logs`, `dealers`, and `user_roles` are all queried directly from the browser using the anon key in `SupabaseService`.
- Because admin screens read all bookings, all vehicles, all user roles, and all audit logs from the client, those tables must either:
  - have permissive authenticated SELECT policies, or
  - depend on JWT/database-role logic not visible in this repo, or
  - fail in production for some users.

### Tables that appear to need especially permissive write policies

- `vehicle`
  - Admin UI writes directly from browser for create/update/archive.
  - Dealer flows also update vehicle booking state and mileage.

- `bookings`
  - Written by dealer dashboard, walk-in wizard, quotation submit flow, admin approval/rejection, payment page, and inspection activation.

- `quotations`
  - Written by dealer UI directly in both routed and walk-in flows.

- `customers`
  - Written directly from dealer-side flows.

- `payments`
  - Offline cash insert is direct from browser.
  - Online path uses RPC `insert_payment_record`, which strongly suggests direct insert may be blocked or intentionally bypassed for the full online payload.

### Security-definer / bypass clues

- `supabase/create_payment_functions.sql` explicitly marks `insert_payment_record` and `confirm_booking_payment` as `SECURITY DEFINER`.
- The comment says `insert_payment_record` is used to bypass RLS for payment creation.
- Current app also references RPC `update_payment_status`, which is not defined in repo, suggesting another privileged database function exists outside checked-in SQL.

### Silent-failure patterns already visible in code

- `getUserRole()` uses `.maybeSingle()` and returns `null` on error.
  - If RLS blocks `user_roles`, auth flows will treat the user as missing a role and try to create a default dealer role/profile.

- `getDealerProfile()` uses `.maybeSingle()`.
  - If `dealers` SELECT is blocked, profile page will quietly show empty fallback fields.

- `getQuotationByBooking()` uses `.maybeSingle()`.
  - If quotation row is hidden by RLS, payment and routed flow pages fall back to local pricing or blank customer state.

- `findCustomerByMobile()` and `searchCustomersByField()` depend on direct `customers` visibility.
  - Restrictive `customers` RLS would make returning-customer lookup look like "not found".

### Unique-constraint/error-handling clues

- Customer duplicate handling:
  - `supabase.ts` private `isDuplicateMobileError()` checks `23505` and `customers_mobile_unique`
  - `createWalkInQuotation()` and `upsertCustomerByMobile()` both handle duplicate mobile collisions

- Quotation duplicate handling:
  - `submitQuotationRequest()`, `createOrFetchQuotation()`, and `saveQuotationDraft()` all handle `23505`
  - This strongly suggests a uniqueness rule around one quotation per booking

### Auth/role caveat

- Role is derived from the `user_roles` table, not from custom JWT claims in this repo.
- Since admin/dealer routing depends on reading `user_roles` at runtime from the client, any RLS problem on that table can mis-route users or trigger unwanted default dealer creation.

