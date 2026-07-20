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
- **Verify the address is in a covered zip code** — check against the active service area at `/admin/zip-codes`
- **Verify pickup/delivery dates align with an active route** — confirm both dates fall on Mon, Wed, or Fri with the 9:00 AM – 3:00 PM window
- Once both checks pass, change status from **Pending → Confirmed** — this sends the customer a confirmation notification

> If the address or dates look wrong, you can edit from this page or contact the customer before confirming.

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

> **You can do this step ahead of time.** Driver assignment does not require the driver to be clocked in or available at that moment. It is common to pre-plan and assign all orders the day before a route runs.

Once the order is in Shipday (green badge), you can assign a specific driver:

1. Find the order card on the Dispatch Board
2. In the bottom action bar of the card, select a driver from the **dropdown** — it lists all active (hired) drivers by name
3. Click **Assign**
4. A confirmation toast ("Driver assigned") confirms it went through
5. The driver will see this stop in their Shipday app when they open it on route day

> If the driver does not appear in the dropdown, they may not yet be approved in the system. Go to `/admin/workers` → Pending tab → Approve them first.  
> If assignment fails with a note about "carrier may not exist," the driver is approved in WashFold but not yet registered in Shipday — contact them to complete their Shipday setup.

**Assigning multiple orders to the same driver:**  
Repeat the process for each order card. All orders assigned to the same driver will be grouped into one route in Shipday.

**Changing a driver after assignment:**  
Select a different driver from the dropdown and hit Assign again. This overwrites the previous assignment in Shipday.

---

## STEP 5 — Driver Out of Shift / Coverage Issue

If a driver calls out, is late, or is unavailable for their shift:

### Option A — Reassign to a Different Driver
On each of their order cards on the Dispatch Board, select the replacement driver from the dropdown and click **Assign**. This instantly redirects the stops in Shipday to the new driver.

### Option B — Reschedule the Orders
If no coverage is available:
1. On each order card, click **Reschedule...**
2. A popover appears — change the date and/or time window
3. Click **Update + Shipday** — this updates the booking AND updates Shipday simultaneously
4. WashFold notifies the customer of the date change

> Reschedule to the next available route day — pickups and deliveries only run **Monday, Wednesday, and Friday**, 9:00 AM – 3:00 PM.

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

On pickup day, the driver opens the Driver App (`/driver`), enters their 4-digit PIN, and sees all assigned pickups for the day with customer name, address, and time window.

**At each stop, the driver follows this sequence:**

1. **Navigate to the address** — the app links directly to maps
2. **Locate the bags** — find where the customer left them (door, porch, etc.)
3. **Verify bag count** — compare what is physically there against what the customer noted in the order. If the count differs, adjust the number in the app before confirming. This is recorded automatically
4. **Check the assigned color key** — the app displays a pre-assigned color for this order (e.g., "Use the BLUE sticker"). The system automatically assigns a unique color per order for that day — no manual selection needed
5. **Create the labels** — write the order code and bag number on the assigned-color sticker for each bag (e.g., `WF004 · B1`, `WF004 · B2`). The app shows the label reference in large text — tap **Full** to expand it bag by bag, including the color reminder
6. **Apply stickers** — place each sticker visibly on the outside of the correct bag
7. **Take a photo** — photograph all bags with stickers clearly visible. This is **required** — the app blocks confirmation without it. The photo is saved to the customer's order record
8. **Load the vehicle** — keep all bags for the same order together
9. **Confirm Pickup** in the app — status moves to `picked_up`, the customer receives an SMS notification, and the driver proceeds to the next stop

> If a customer is not home or the bags are not out, note it in the app and contact admin. Admin will reach out to the customer and reschedule.

> **Color key rule:** The system pre-assigns a unique color per order at booking time, cycling through 9 colors (Red, Blue, Sky Blue, Green, Lime, Pink, Hot Pink, Orange, Purple) to avoid duplicates on the same pickup day. **Yellow is deliberately excluded from this rotation** — it is reserved exclusively for the remote-storage marker sticker (see Step 10), so a yellow sticker always and only means "this bag is in storage." The driver simply matches the sticker to the color shown — no decision needed.

---

## STEP 7 — Driver Drops Off at Warehouse or Facility

**Who does it:** Driver  
**Where:** Driver App → order detail

After completing all pickups, the driver brings the bags to the drop-off point indicated in the app (warehouse or facility, depending on the route).

**At the drop-off point, the driver follows this sequence:**

1. **Arrive at the drop-off location** — the app shows whether this order goes to the **Warehouse** or directly to the **Facility**
2. **Place the bags** — set them in the designated area, keeping each order's bags together (use color key to identify)
3. **Weigh each bag** — enter the weight per bag on the scale. **This is required** — the app will not allow confirmation without weights entered for all bags. Weight locks in final customer billing
4. **Take a location photo** — photograph the bags in the spot where you placed them (e.g., intake shelf, floor area). This photo is **internal only** — it is not visible to the customer, but is recorded for operational control
5. **Confirm Drop-off** — tap **Confirm Warehouse Drop-off** (or **Confirm Facility Drop-off**). Status moves to `at_warehouse` or `at_facility`. The order now appears on the Facility Board for the operator

At this point, **the order is in the operator's hands**.

> The Facility Board at `/admin/facility` will show the order in the **Intake** column once dropped.

> **Warehouse vs. Facility:** Most routes currently go through the WashFold Warehouse first, then a transport run moves bags to the laundry facility. If a route drops directly at the facility, the app will show "Facility" as the drop-off destination.

---

## STEP 8 — Operator Processes the Order Through Facility Phases

**Who does it:** Operator  
**Where:** `/operator` (Operator App) — enter PIN  
**Also visible to Admin at:** `/admin/facility`

The Facility Board shows all active orders in columns by phase. The operator physically moves laundry through the facility and advances each order in the app to match.

**To advance a phase:** open the order card on the Facility Board → review details → tap **Advance → [Next Phase]** at the bottom of the drawer → card moves to the next column.

---

### 📥 Phase 1 — Intake

1. Receive the bags from the driver drop-off
2. Locate the order on the Facility Board — find it by **order code** and **color key sticker** on the bags
3. Verify the **bag count** matches what is recorded in the app. If there is a discrepancy, note it before advancing
4. Confirm the **color key sticker** is visible and legible on each bag — this is how the order is tracked throughout the facility
5. Advance the order to **Washing** in the app

---

### 🫧 Phase 2 — Washing

1. Open the bags and load the contents into the washer(s)
2. **Select and record which washer(s) you are using** in the app — this is required for tracking
3. Set the appropriate wash cycle for the service type (wash & fold, wash only, etc.)
4. Start the machines
5. Advance the order to **Drying** in the app once washing is complete

---

### 💨 Phase 3 — Drying

1. Transfer items from the washer(s) to the dryer(s)
2. **Select and record which dryer(s) you are using** in the app — required for tracking
3. Set the appropriate dry cycle
4. Start the machines
5. Once dry, **transfer everything into a laundry cart** — do not ball or bunch the items, lay them loosely to avoid wrinkles
6. **Roll the cart next to the folding table** and advance the order to **Folding** in the app

---

### 👕 Phase 4 — Folding

1. Work from the cart at the folding table
2. Fold each item individually and **set it aside in a flat stack** — do not bag yet
3. If the customer sent their clothes in a **reusable fabric laundry bag**, that bag must have been washed in the load — fold it and set it aside with the rest to be included
4. Continue until all items in the cart are folded and stacked
5. Before bagging, check for any **inserts** to include: promo cards, thank-you notes, gifts, or any material designated for this customer (see Step 9A)
6. Once everything is folded, stacked, and inserts are ready, **bag all items together**
7. Use the original bags (or replacement bags if needed), keeping the order together
8. Do not seal yet — labeling and the final check happen in Step 9

> Fold everything before bagging. This keeps the workflow clean and avoids re-handling.

---

**Same-color warning:** The board shows a ⚠️ warning if two orders in the same phase column share a color key. The operator should flag this to admin — one order's color sticker may need to be re-labeled to avoid confusion during delivery pickup.

---

## STEP 9 — Finishing: Label, Pack, Count, and Placement Photo

**Who does it:** Operator  
**When:** After all items are folded and stacked, before closing the bags  
**This step is MANDATORY for every order**

---

### A) Check for Inserts Before Closing the Bags

Before placing folded clothes into the bag, check if anything needs to go in with them:

- **Cards, promos, or gifts** — include any promotional card, thank-you note, gift item, or promotional material designated for this customer
- **Customer's own laundry bag** — if the customer sent their clothes in a reusable fabric laundry bag, that bag must have been washed along with the rest of the load. Fold it and place it **inside the plastic delivery bag** with the clean clothes before sealing

> Do not return an unwashed fabric bag. It came in dirty — it goes back clean.

---

### B) Apply the Color Key Sticker and Label

1. Open the order card in the app — the **assigned color key is displayed** (e.g., "BLUE")
2. Write the **order number and bag number** on a sticker of that color for each bag — format: `11765-1`, `11765-2`, etc.
3. **Physically apply the sticker** to the outside of each bag, visibly. One labeled sticker per bag

> The color was pre-assigned by the system at booking time. The same color used at pickup is reused here so the driver and operator can track the order consistently from start to finish.

> ❌ The system will **block advancing to Ready** if no color key is confirmed. This is enforced.

---

### C) Pack and Seal the Bags

1. Place the folded stack into the bag(s)
2. Include any inserts (cards, promos, gifts, washed fabric bag) — see section A above
3. **Vacuum the bag** — insert the portable vacuum nozzle and extract excess air until the bag compresses around the clothes
4. **Tie the bag shut** — knot it securely after vacuuming
5. Keep all bags for the same order together

> Vacuuming removes excess air and keeps the package compact and clean for delivery.

---

### D) Weigh the Sealed Bags

1. Place the tied, sealed bag(s) on the scale — weigh the complete order (all bags combined)
2. **Enter the folded weight in the app**
3. The app will automatically compare this weight against the intake weight recorded when the driver dropped off:
   - ✅ **Within 4 lbs** — normal, proceed
   - 🚨 **4 lbs or more difference** — the app raises a **red flag**. Stop and verify before proceeding:
     - Check that all items from the bag(s) were processed and rebagged
     - Check the folding area and cart for any items left behind
     - If items are confirmed missing, note it in the app and notify admin immediately
     - Admin will contact the customer before the order goes out for delivery

> A weight discrepancy of 4+ lbs likely means something was left behind. This must be resolved before the order is marked Ready.

---

### F) Enter the Folded Bag Count

- In the order drawer, enter how many bags the laundry was packed into after folding
- This may differ from the original pickup count (customer brought 3 bags, folded it fits into 2 — that is normal)
- The driver's app will show the folded bag count when collecting, so they know exactly how many bags to look for

---

### G) Place the Order and Take the Placement Photo

**If the order stays at the facility (floor holding):**

1. Place the sealed, labeled bag(s) in the floor holding area
2. In the order drawer, confirm the destination is set to **Hold at Facility** (toggle ON)
3. Tap the **📷 Take Photo** button — photograph the bags in their spot with the **color key sticker clearly visible**
4. Photo is saved and appears on the driver's screen when they come to collect

**If the order is going to off-site storage:**

1. Apply the **additional YELLOW marker sticker** alongside the color key sticker on each bag — this is the secondary identifier that tells the driver this bag came from storage
2. Place the bags in the designated off-storage area
3. In the order drawer, toggle **Hold at Facility OFF** — this marks the order as going to remote storage
4. Tap the **📷 Take Photo** button — photograph the bags in their storage spot with **both stickers visible** (color key + storage marker)
5. Photo is saved to the order

> ❌ The system will **block advancing out of Ready** if no placement photo exists. This is enforced regardless of destination (floor or storage).

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
- **Sticker requirement:** color key sticker + a **YELLOW marker sticker** (apply alongside the color key so the driver can immediately identify this as a storage-bound order). Yellow is reserved exclusively for this — it is never assigned as a per-order color key, so a yellow sticker always means "storage," with no ambiguity.
- The order drawer will show an amber reminder: *"YELLOW marker sticker required"*

> **Saturday pickups:** Decision pending on whether Saturday pickups automatically go to storage (since Sunday is off) or stay on the floor. Until decided, use your judgment and toggle accordingly.

---

## STEP 11 — Driver Loads and Runs the Delivery Route

**Who does it:** Driver  
**Where:** Driver App → today's job list

The driver opens the app and reviews all jobs assigned for the day. Jobs will show as either **Floor** (bags at the facility) or **Storage** (bags at the off-site storage location). The driver runs two separate loading stages before starting deliveries.

---

### Stage 1 — Storage Run (First)

1. Review the job list — identify all orders marked as **Storage** (📦 icon)
2. Load the vehicle with any items already at the facility that are going to storage (if the operator has handed them off)
3. **Drive to the off-site storage location**
4. Drop off the storage-bound orders — place them in their designated area
5. Return to the facility

> Storage orders go first so the driver returns to the facility with an empty vehicle, ready for the full delivery load.

---

### Stage 2 — Facility Load (Second)

1. Back at the facility, review all remaining jobs — these are the **Floor** orders ready for delivery
2. For each order, open the order detail in the app — the **Facility Specs** panel shows:
   - 📍 Floor or 📦 Storage label — confirms where this bag is
   - Colored circle + color name — which sticker to look for
   - Placement photo — visual reference to locate the exact bag(s)
   - Folded bag count — how many bags to load (⚠️ shown if different from original pickup count)
3. Locate each order's bag(s) using the color sticker and placement photo
4. Verify the bag count against what the app shows
5. Load all delivery orders into the vehicle, keeping each order's bags together
6. Once fully loaded, mark each order as **Out for Delivery** in the app
7. Begin the delivery route

---

## STEP 12 — Driver Delivers to the Customer

**Who does it:** Driver  
**Where:** Driver App

On delivery day:

1. Driver opens the app — sees all deliveries assigned for the day
2. Navigates to each customer's address
3. Finds a suitable, safe spot to leave the bags (door, porch, covered area, etc.)
4. Places all bags for the order together in that spot
5. **Takes a photo** of the bags in their delivery spot — the photo must show:
   - All bags clearly
   - The delivery location (door, porch, etc.)
   - The color key sticker visible on the bags
6. Marks the order as **Delivered** in the app
   - Status moves to `delivered`
   - The delivery photo is **saved to the customer's viewable order record** — they can see it in their account and tracking page
   - Customer receives a delivery notification
   - Order is closed out

> **Customer does not need to be home.** Per our terms of service, bags will be left in a suitable location at the delivery address whether or not the customer is present. The delivery photo serves as confirmation of placement.

---

### If the Customer Was Not Home for Pickup

> **Customer does not need to be home for pickup either.** The agreement is that clothes will be left outside (door, porch, agreed spot) at the scheduled time.

**If the clothes are not outside when the driver arrives:**

1. Driver does not wait — makes note of the situation in the app
2. Driver submits a **no-clothes report** in the app (notes field on the order)
3. Admin is notified — contacts the customer
4. A **revisit fee** applies for any return pickup trip required
5. Admin reschedules the pickup and processes the fee before the next attempt

> The revisit fee exists because a failed pickup wastes a scheduled route slot. Customers agree to this when booking.

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
