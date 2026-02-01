
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://esoolyrdajscrtoidtlc.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzb29seXJkYWpzY3J0b2lkdGxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk2NzYzMCwiZXhwIjoyMDg1NTQzNjMwfQ.wLsVgFIQ1uynlJ59e8Ra8NNUU1oY5vyE0XWNi_vUHBw'

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function createDemoUser() {
  const email = 'demo@landscape360.app'
  const password = 'demo12345'

  // 1. Try to delete if exists (to ensure clean state)
  const { data: listUsers } = await supabase.auth.admin.listUsers()
  const existingUser = listUsers?.users.find(u => u.email === email)
  
  if (existingUser) {
    console.log('Deleting existing demo user...')
    await supabase.auth.admin.deleteUser(existingUser.id)
  }

  // 2. Create new confirmed user
  console.log('Creating new confirmed demo user...')
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Demo Surveyor' }
  })

  if (error) {
    console.error('Error creating user:', error)
  } else {
    console.log('Success! User created:', data.user.email)
  }
}

createDemoUser()
