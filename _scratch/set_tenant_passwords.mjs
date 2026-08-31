import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const WORDS = ["coral","tiger","amber","cedar","delta","ember","falcon","gravel","harbor","indigo","jasper","kestrel","lumen","meadow","nectar","orchid","pepper","quartz","raven","summit","talon","umber","violet","willow","xenon","yonder","zephyr","basil","clover","dune"]
function randomPassword() {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)]
  const digits = Math.floor(100 + Math.random() * 900)
  return `${pick()}-${pick()}-${digits}`
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "demo_tenants.json"), "utf8"))

  const byUser = new Map()
  for (const row of raw) {
    if (!row.email || !row.email.includes("@") || !row.email.split("@")[1]?.includes(".")) {
      console.log(`SKIP invalid email: ${row.name} (${row.slug}) -> "${row.email}"`)
      continue
    }
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, { email: row.email, locations: [] })
    byUser.get(row.user_id).locations.push(row.name)
  }

  const results = []
  for (const [userId, info] of byUser) {
    const password = randomPassword()
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    })
    if (error) {
      console.log(`FAILED ${info.email}: ${error.message}`)
      continue
    }
    results.push({ email: info.email, password, locations: info.locations.join(" / ") })
    console.log(`OK ${info.email}`)
  }

  fs.writeFileSync(path.join(__dirname, "tenant_credentials.json"), JSON.stringify(results, null, 2))
  console.log(`\nDone. ${results.length} accounts updated.`)
}

main()
