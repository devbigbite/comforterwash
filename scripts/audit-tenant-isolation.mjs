import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

function assertContains(file, pattern, message) {
  const source = read(file)
  if (!pattern.test(source)) {
    console.error(`FAIL ${file}: ${message}`)
    process.exitCode = 1
    return
  }
  console.log(`OK   ${file}: ${message}`)
}

assertContains(
  "middleware.ts",
  /return tenantNotFoundResponse\(\)/,
  "unknown tenant hosts fail closed",
)
assertContains(
  "middleware.ts",
  /isAuthorizedForAdminLocation\(request, effectiveAdminLocationId\)/,
  "admin requests verify access to the selected tenant",
)

for (const file of [
  "app/api/admin/seed-bags/route.ts",
  "app/api/admin/seed-dispatch/route.ts",
]) {
  assertContains(file, /await requireAdmin\(\)/, "seed endpoint requires admin authentication")
  assertContains(file, /\.eq\("location_id", locationId\)/, "seed endpoint is tenant scoped")
}

const bookingSchema = read("scripts/001_create_bookings_table.sql")
if (/bookings[\s\S]{0,200}(using|with check)\s*\(true\)/i.test(bookingSchema)) {
  console.error("FAIL scripts/001_create_bookings_table.sql: bookings contains a permissive RLS policy")
  process.exitCode = 1
} else {
  console.log("OK   scripts/001_create_bookings_table.sql: bookings is closed to direct client access")
}

assertContains(
  "scripts/harden_bookings_rls.sql",
  /revoke all on table public\.bookings from anon, authenticated/i,
  "production hardening migration revokes direct booking access",
)

if (process.exitCode) process.exit(process.exitCode)
console.log("OK — critical tenant isolation guards are present")
