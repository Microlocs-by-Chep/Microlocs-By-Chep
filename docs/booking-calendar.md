# Booking calendar and attendant availability

The admin page shows each appointment's drink choice and expandable booking options. New bookings save the same details in the salon event, emailed Google Calendar link, and ICS attachment. Old selections that were never sent to the server cannot be recovered from the calendar; they display as not recorded. New completed jobs retain the full event description in the existing `booking_notes` column, so no database migration is needed. Previously imported jobs are preserved.

Admins can mark Bree, Joan, or Chep unavailable using a date/time range or inclusive full-day dates. All times use Africa/Nairobi. Unavailable periods are ordinary calendar events tagged with private `kind=unavailability` and `employee` properties. They do not appear as customer appointments or earn commissions. Removing a period restores availability. Creating a period over an existing appointment for that attendant is rejected; it does not cancel the appointment.

Website booking, unavailability creation/removal, and admin booking deletion share a Google Calendar write lock. Conditional ETag updates (`If-Match`) on a persistent transparent coordination event serialize these operations across serverless instances. Every booking rechecks calendar occupancy while holding the lock. Each attendant can have only one overlapping appointment; the salon can have at most two concurrent appointments. Unavailability blocks only the named attendant and consumes no appointment capacity. Adjacent appointments may share an endpoint.

The lock does not expire automatically. A timed-out writer may still be creating an event; automatically releasing its lock could allow a double booking. An uncertain write outcome or failed release therefore stops further website writes until reviewed. The internal coordination event has ID `microlocsbookinglock`, is transparent, and is dated 1 January 2000. Do not delete it. To recover an abandoned lock, first stop all booking/availability/deletion writers and inspect the calendar and server logs to establish whether the original operation completed. Then read the coordination event's current ETag and use a conditional Google Calendar event PATCH to clear its private `lockOwner` and `lockedAt` properties. Never clear it while a writer could still be running. Restart writers and verify availability before reopening bookings.

Direct edits in Google Calendar and other applications do not acquire this website lock. Manage website bookings through the admin page to obtain concurrency protection; avoid simultaneous manual calendar edits during website booking writes.

Run regression checks with:

```sh
cd /workspace/Microlocs-By-Chep
node --test tests/*.test.cjs
```

The tests simulate Google Calendar's conditional-write behavior and Supabase admin authentication; they do not create live events. Live verification requires the existing Google service account email/private key and calendar sharing permissions. Deployment is required to apply these changes to the public website.

## Admin customer accounts

Apply `supabase/migrations/20261006160000_admin_customer_accounts.sql` in the project's Supabase SQL editor (after the existing admin/profile migrations), then deploy the application. No service-role key is needed by the application. The SQL function checks approved admin membership before reading selected account/profile fields; customer profile row policies remain unchanged. Authenticated non-admins and anonymous users cannot call it.

The admin Customer accounts section supports searching by name, email or phone, paginated account listings, and read-only profile/history views. Accounts that have not saved a profile are included. Approved staff accounts and deleted accounts are excluded. Calendar history uses the customer's current email and the same two-year past/one-year future window and point calculation as the customer dashboard. Profile information remains available if Calendar history cannot load; points and history then show as unavailable rather than zero. Records outside the history window, earlier email addresses, and drink selections never saved to the calendar are not reconstructed.

The SQL migration and privilege behavior were verified in a temporary local PostgreSQL-compatible PGlite instance. The production database migration has not been applied from this environment because database administration credentials are absent.

## Website visitors and compact staff availability

Apply `supabase/migrations/20261006180000_website_visitors.sql` in Supabase to enable the website visitor counts. Deploying the tracker without this migration does not start collecting counts. This migration requires the existing private schema/admin membership function. Counts are admin-only. The public recording function accepts only an anonymous random browser ID and records at most one row per browser per Nairobi day; no names, emails, IP addresses or page URLs are stored. The admin totals count distinct browser IDs, not verified people. Different devices, cleared storage, privacy controls, automated traffic, and blocked requests can affect counts. Global Privacy Control and Do Not Track are respected. Existing visits are not reconstructed, and retention is indefinite until records are removed by the database owner.

Staff availability appears at the bottom of admin as a collapsed panel with a summary of unavailable periods for each attendant for the selected week. Expanding it shows the existing time-off controls. A week without recorded unavailable periods is not a guarantee that an attendant is currently free of appointments.

## Salon booking email notifications

After a successful calendar booking, the customer confirmation and salon notification are sent independently through Resend. The default salon recipient is `chepletingbev@gmail.com`; set `BOOKING_NOTIFICATION_EMAIL` on Vercel to use another address. `RESEND_API_KEY` and the existing verified sender domain are required. The owner email contains the Nairobi appointment date/time and complete saved booking description, including drink, options, notes, and estimate. Reply-to is the customer's booking email. Separate event-based idempotency keys prevent Resend retries from duplicating the two messages. An email failure does not cancel the saved calendar booking; the response exposes `emailSent` and `salonEmailSent`, and failed salon sends with a configured key are logged without customer details. Delivery is best-effort; no background retry queue is added.
