const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const env = fs.readFileSync('.env.local', 'utf8')
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
  return m ? m[1].trim().replace(/^"|"$/g, '') : null
}
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const key = get('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !key) { console.error('Missing env'); process.exit(1) }

const supabase = createClient(url, key)
const LOCATION_ID = '832b1605-cb3c-48d6-b8bc-125125834e19' // washfolddemo
const EMAIL = 'demo@washfoldclean.com'
const PASSWORD = 'showcase-tide-517'

async function main() {
  const { data: userList } = await supabase.auth.admin.listUsers()
  let user = userList?.users.find(u => u.email?.toLowerCase() === EMAIL)

  if (!user) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })
    if (error) { console.error('createUser error:', error.message); process.exit(1) }
    user = created.user
    console.log('Created new auth user:', user.id)
  } else {
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password: PASSWORD })
    if (error) { console.error('updateUser error:', error.message); process.exit(1) }
    console.log('Reset password on existing auth user:', user.id)
  }

  const { error: linkError } = await supabase
    .from('location_users')
    .upsert(
      { location_id: LOCATION_ID, user_id: user.id, role: 'admin', is_super_admin: false },
      { onConflict: 'location_id,user_id' }
    )
  if (linkError) { console.error('link error:', linkError.message); process.exit(1) }
  console.log('Linked as admin to WashFoldDemo location.')
  console.log('DONE', EMAIL, PASSWORD)
}
main()
