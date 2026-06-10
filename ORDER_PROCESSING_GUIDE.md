# WashFold Orlando — Complete Order Processing Guide

Full operational SOP from customer booking to delivery. Read top to bottom for the complete flow.

---

## BACKGROUND: How Routes Work

Before processing any order, understand the route structure — this is what controls which dates customers can book and which orders you see on a given day.

**Routes live at:** `/admin/routes`

Each route defines:
- **Name** — e.g. "East Orlando Route", "Airport Route"
- **Pickup days** — which days of the week pickups run (e.g. Monday + Wednesday)
- **Delivery days** — which days of the week deliveries run (e.g. Tuesday + Thursday)
- **Turnaround days** — minimum gap between pickup and delivery (set to 1 for next-day)
- **Recurrence** — Weekly, Biweekly, or Both
- **Service areas** — zip codes or neighborhood names this route covers
- **Home facility** — which warehouse/facility handles this route's orders
- **Time windows** — e.g. 9am–1pm, 3pm–7pm (customers pick from these when booking)

> Routes are the backbone of the booking calendar. If a customer can't find a date, it means no active route covers their zip code on that day.

**To add or edit a route:** go to `/admin/routes` → click the route to expand → edit fields → Save.

**To pause a route temporarily** (e.g. holiday): go to `/admin/routes` → toggle the route OFF. Customers will no longer see those dates in the booking form.

---

## BACKGROUND: How Workers & Shifts Work

**Workers live at:** `/admin/workers`

Workers go through an approval flow:
1. Worker applies at `/apply` — selects role (Driver or Washing Operator), submits personal info + signs IC agreement
2. Admin reviews at `/admin/workers` (Pending tab) — clicks **Approve** or **Reject**
3. Once approved, admin sets a **4-digit PIN** for the worker — they use this to log into their app
4. Worker status becomes **Active**

**Schedule & shifts:** `/admin/schedule`

The schedule page has 3 tabs:
- **Right Now** — shows who is currently clocked in, when they clocked in, running duration. You can force clock-out from here.
- **Schedule** — weekly calendar. Add shifts by selecting worker + day + time range. Shows all scheduled shifts for the week.
- **Timesheet** — full punch history. Edit or correct punches if a worker forgot to clock in/out.

Workers clock in/out using the **Staff Clock** at `/staff` (PIN-gated). This is separate from the driver and operator apps.

> **If a driver is out sick or unavailable:** see the "Driver Out of Shift" section below.

---

## STEP 1 — Customer Places Order

**Who does it:** Customer, self-service  
**Where it happens:** Customer-facing booking form on the website

The customer:
1. Enters their address
2. Selects service type (Wash & Fold, Comforter Wash, Wash Only)
3. Picks a pickup date — only days with active routes are shown
4. Picks a pickup time window (e.g. 9am–1pm or 3pm–7pm)
5. Picks a delivery date — must be at least next day (or Monday if pickup is Saturday)
6. Picks a delivery time window
7. Enters contact info, number of bags/comforters, any special notes
8. Submits — receives a booking confirmation

**What the system creates:**
- New booking record with `status: pending`
- Short code assigned (e.g. WF004)
- Booking is not yet assigned to any driver or Shipday route

**Where you see it immediately:**
- Admin landing page `/admin` — counter increases on the Pending stat card
- Dispatch board `/admin/dispatch` — appears on the pickup date column

---

## STEP 2 — Admin Reviews the New Order

**Who does it:** Admin  
**Where:** `/admin/dispatch` (primary) or `/admin/orders`

### Check the Dispatch Board Daily

Open `/admin/dispatch` — it defaults to today's date. Use the date navigation arrows to check upcoming days.

The board is split into two columns:
- **Pickups** — orders being picked up on this date, grouped by time window (9AM–1PM first, then 3PM–7PM)
- **Deliveries** — orders being delivered on this date

Each order card shows:
- Short code, customer name, address, phone
- Service type, bag count
- Current status (dot color: blue=confirmed, orange=in progress, green=out for delivery)
- Whether it's synced with Shipday (green badge = synced; amber = not yet in Shipday)

### Confirm the Order

Go to the full order detail: click **View order** on the card, or go to `/admin/orders/[id]`.

From the order detail page:
- Review service details, address, dates
- Change status from **Pending → Confirmed** — this sends the customer a confirmation notification
- Verify the address is in a covered zip code
- Verify pickup/delivery dates align with an active route

> If the address or dates look wrong, you can edit from this page or contact the customer.

---

## STEP 3 — Assign the Order to Shipday (Routing)

**Who does it:** Admin  
**Where:** `/admin/dispatch`

Shipday is the third-party routing/dispatch platform. Orders need to be pushed to Shipday so the driver gets a route on their phone.

On the Dispatch Board, each order card shows a **Shipday sync badge**:
- 🟡 **"Not in Shipday"** — order hasn't been pushed yet; driver won't see it
- 🟢 **"SD #12345"** — order is synced; Shipday order ID shown

> Orders are pushed to Shipday automatically when they are confirmed, but you should verify the green badge is showing. If it's still amber, the sync may have failed — open the order and re-trigger the push.

Once in Shipday, the order will appear in the driver's Shipday app as a stop on their route for that day.

---

## STEP 4 — Assign a Driver to the Order

**Who does it:** Admin  
**Where:** `/admin/dispatch` — directly on each order card

Once the order is in Shipday (green badge), you can assign a specific driver:

1. Find the order card on the Dispatch Board
2. In the bottom action bar of the card, type the **driver's email address** into the "driver@email.com" field
3. Click **Assign**
4. A confirmation toast ("Driver assigned") confirms it went through
5. The driver will now see this stop in their Shipday app

> The driver's email must match their account in Shipday. If assignment fails with a note about "carrier may not exist," the driver is not yet registered in Shipday — contact them to complete setup.

**Assigning multiple orders to the same driver:**  
Repeat the process for each order card. All orders assigned to the same driver email will be grouped into one route in Shipday.

**Changing a driver after assignment:**  
Type a different email and hit Assign again. This overwrites the previous assignment in Shipday.

---

## STEP 5 — Driver Out of Shift / Coverage Issue

If a driver calls out, is late, or is unavailable for their shift:

### Option A — Reassign to a Different Driver
On each of their order cards on the Dispatch Board, type the replacement driver's email and click **Assign**. This instantly redirects the stops in Shipday to the new driver.

### Option B — Reschedule the Orders
If no coverage is available for the time window:
1. On each order card, click **Reschedule...**
2. A popover appears — change the date and/or time window
3. Click **Update + Shipday** — this updates the booking AND updates Shipday simultaneously
4. WashFold notifies the customer of the date change

> Pick a date that has an active route in the same area. Check `/admin/routes` if unsure which days cover which zip codes.

### Option C — Remove from Routing Temporarily
If you need to hold an order while figuring out coverage:
1. On the order card, click **Remove routing** (red button, only shows when synced)
2. This removes it from Shipday — driver won't see it — but keeps the booking active in your system
3. Re-push to Shipday and reassign once coverage is confirmed

### Checking Who Is Currently Working
Go to `/admin/schedule` → **Right Now** tab — shows everyone who is clocked in at this moment and how long they've been on shift. Use this to quickly see who is available to cover.

---

## STEP 6 — Driver Performs the Pickup

**Who does it:** Driver  
**Where:** `/driver` — enter PIN → see today's assigned stops

On pickup day, the driver:
1. Opens the Driver App (`/driver`), enters their 4-digit PIN
2. Sees their assigned pickups for the day, each with customer name, address, time window
3. Navigates to each address (app links to maps)
4. At the customer's door, collects all laundry bags
5. In the app, opens the order → marks it **Picked Up**
   - System status moves to `picked_up`
   - Event logged with timestamp
6. Continues to next stop

> If a customer is not home or can't be reached, the driver should note it in the app. Admin can then contact the customer and reschedule.

---

## STEP 7 — Driver Drops Off at the Facility (Warehouse Transfer)

**Who does it:** Driver  
**Where:** Driver App → order detail

After completing all pickups, the driver brings the bags to the facility/warehouse:

1. Driver arrives at the facility
2. For each order, opens the order in the app
3. Optionally enters bag weight (used for pricing adjustments)
4. Marks the order as **Dropped at Warehouse** / advances to in-transit
   - System status moves to `in_progress`
   - Phase is set to `intake` — the order now appears on the Facility Board

At this point, **the order is in the operator's hands**.

> The Facility Board at `/admin/facility` will now show the order in the **Intake** column.

---

## STEP 8 — Operator Processes the Order Through Facility Phases

**Who does it:** Operator  
**Where:** `/operator` (Operator App) — enter PIN  
**Also visible to Admin at:** `/admin/facility`

The Facility Board shows all active orders in columns by phase. The operator physically moves laundry through the facility, and advances each order in the app to match.

### Phase Sequence

| Phase | What Physically Happens | How to Advance |
|---|---|---|
| 📥 **Intake** | Order received, verified, count checked | Operator opens card → Advance |
| 🫧 **Washing** | Bags loaded into washers | Operator opens card → Advance |
| 💨 **Drying** | Transfer to dryers | Operator opens card → Advance |
| 👕 **Folding** | Items folded, counted, rebagged | Operator opens card → Advance |

**To advance a phase:**
1. Open the order card on the Facility Board
2. Review details (customer name, service type, bag count)
3. Tap the **Advance → [Next Phase]** button at the bottom of the drawer
4. Phase moves forward — card moves to the next column

**Same-color warning:** The board will show a ⚠️ warning if two adjacent orders in the same phase column have the same color key assigned. This means the stickers would be confusing side-by-side. The operator should reassign one order's color key to resolve the conflict before advancing.

---

## STEP 9 — Finishing: Color Key, Bag Count, and Floor Photo

**Who does it:** Operator  
**When:** After Folding is complete, before marking Ready  
**This step is MANDATORY for every order**

### A) Assign a Color Key Sticker

1. Open the order card → find the **Color Key** selector (10 colored circles)
2. Pick a color that is:
   - Not already used by an adjacent order in the same column (⚠️ warning shows if conflict)
   - Matches one of the 10 physical label roll colors you have in stock: Red, Blue, Sky Blue, Green, Lime, Pink, Hot Pink, Orange, Yellow, Purple
3. Tap the circle to assign it
4. Physically apply the matching label sticker to the outside of the bag(s)

> ❌ The system will **block advancing to Ready** if no color key is assigned. This is enforced — there is no workaround.

### B) Enter Folded Bag Count

- In the order drawer, enter how many bags the laundry was packed into after folding
- This may be different from the original pickup bag count (customer brought 3 bags, but folded it all fits into 2)
- The driver's app will show a warning if folded count ≠ pickup count, so they know how many bags to look for

### C) Take the Placement Photo

1. Place the finished, labeled bag(s) in their spot on the facility floor (or on the shelf)
2. In the order drawer, tap the **📷 Take Photo** button
3. The camera opens — photograph the bags clearly, including the color sticker
4. Photo is uploaded and saved to the order
5. This photo appears directly on the driver's screen when they come to collect — they use it to visually locate the bags without guessing

> ❌ The system will **block advancing out of Ready/Staged** if no floor photo exists. Must be done before the order can move further.

---

## STEP 10 — Floor vs. Storage Decision

**Who does it:** Operator  
**When:** Immediately after the order is marked Ready  
**Where:** Facility Board order drawer

Every finished order needs a location decision — where does it physically sit until the driver picks it up?

### Option A — Hold at Facility (Floor)

Toggle the **Hold at Facility** switch **ON**.

- Order stays in the floor holding area at the facility
- Driver will come directly to the facility to pick it up
- **Sticker requirement:** color key sticker only
- The card will show a 📍 hold pin icon on the board

### Option B — Remote Storage

Toggle the **Hold at Facility** switch **OFF**.

- Order goes to remote/off-site storage
- Driver must go to the storage location to retrieve it
- **Sticker requirement:** color key sticker + **second marker sticker** (storage identifier color TBD — apply alongside the color key so the driver can immediately identify this as a storage-bound order)
- The order drawer will show an amber reminder: *"Second marker sticker required"*

> **Saturday pickups:** Decision pending on whether Saturday pickups automatically go to storage (since Sunday is off) or stay on the floor. Until decided, use your judgment and toggle accordingly.

---

## STEP 11 — Driver Views Specs and Collects the Order

**Who does it:** Driver  
**Where:** Driver App → order detail page

When an order reaches **Ready** or **Staged** status, the driver's app shows a **Facility Specs** panel on the order detail page. This panel shows everything the operator set:

| What the driver sees | What it means |
|---|---|
| 📍 Floor or 📦 Storage label | Where to go to find this order |
| Colored circle + color name | Which sticker to look for |
| Placement photo | Visual reference — use this to locate the exact bags |
| Folded bag count | How many bags to pick up (⚠️ warning if different from original pickup count) |

**Driver collection steps:**
1. Arrives at the facility (or storage location, depending on the toggle)
2. Opens the order in the app — looks at the color circle and placement photo
3. Finds the correct bags (matching color sticker)
4. Counts bags — verifies against folded bag count shown in app
5. Loads bags into vehicle
6. Marks order as **Out for Delivery** in the app
   - Phase moves to `out_for_delivery`
   - Delivery countdown starts

---

## STEP 12 — Driver Delivers to the Customer

**Who does it:** Driver  
**Where:** Driver App

On delivery day:

1. Driver opens the app — sees all deliveries assigned for the day
2. Navigates to each customer's address
3. Drops off the bags at the door (or hands to customer)
4. Marks the order as **Delivered** in the app
   - Status moves to `delivered`
   - Customer receives a delivery notification
   - Order disappears from the active board

> If the customer is not home: leave the bags in a safe spot if authorized, or note in the app and contact admin. Admin can mark the delivery manually from the order detail page if needed.

---

## STEP 13 — Admin Closes Out / Follows Up

**Who does it:** Admin  
**Where:** `/admin/orders` or `/admin/search`

After delivery:
- Verify the correct status shows as `delivered`
- Review final amount — if weight was entered at drop-off, confirm the price reflects it
- Check for any tip recorded
- Flag any issue orders (damaged items, wrong bag count, customer complaint) for follow-up

If a customer reports a problem:
- Go to `/admin/search` → search by name, phone, or short code
- Open the order → review the full event log (every status change is time-stamped)
- The floor placement photo is on record — can be used to verify what was delivered

---

## QUICK REFERENCE — Full Status Flow

```
Booking placed  →  confirmed  →  picked_up  →  in_progress  →  delivered
```

## QUICK REFERENCE — Facility Phase Flow

```
intake → washing → drying → folding → [color key + bag count + photo] → ready → staged → out_for_delivery
```

## QUICK REFERENCE — Who Does What

| Task | Role | Where |
|---|---|---|
| Review & confirm new orders | Admin | `/admin/dispatch` |
| Assign driver to order | Admin | `/admin/dispatch` — order card |
| Reschedule an order | Admin | `/admin/dispatch` → Reschedule... |
| Check who is clocked in | Admin | `/admin/schedule` → Right Now |
| Add/edit routes | Admin | `/admin/routes` |
| Approve new workers | Admin | `/admin/workers` → Pending tab |
| Add worker to schedule | Admin | `/admin/schedule` → Schedule tab |
| Pick up laundry | Driver | `/driver` |
| Drop off at facility | Driver | `/driver` |
| Deliver to customer | Driver | `/driver` |
| Move order through phases | Operator | `/operator` |
| Assign color key | Operator | `/operator` (Facility Board) |
| Take placement photo | Operator | `/operator` (Facility Board) |
| Set Floor vs Storage | Operator | `/operator` (Facility Board) |

## STAFF APP ACCESS

| App | URL | Login method |
|---|---|---|
| Admin | `/admin` | Admin password |
| Driver | `/driver` | 4-digit PIN |
| Operator | `/operator` | 4-digit PIN |
| Staff Clock (in/out) | `/staff` | 4-digit PIN |
| Test all 3 side-by-side | `/admin/test` | Auto-seeds test workers |

> **PINs are set by admin** at `/admin/workers` → click the worker → set PIN. The worker uses this PIN every time they open their app.
