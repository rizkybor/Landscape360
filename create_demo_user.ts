
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function createDemoUser() {
  const email = 'demo@landscape360.app'
  const password = 'Demo12345!'

  // 1. Try to delete if exists (to ensure clean state)
  const { data: listUsers } = await supabase.auth.admin.listUsers()
  const existingUser = listUsers?.users.find(u => u.email === email)
  
  if (existingUser) {
    console.log('Found existing user:', existingUser.id)
    console.log('Confirmed at:', existingUser.email_confirmed_at)
    console.log('Updating password and confirmation status...')
    
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: password,
        email_confirm: true,
        user_metadata: { full_name: 'Demo Surveyor' }
    })
    
    if (updateError) {
        console.error('Error updating user:', updateError)
    } else {
        console.log('Success! User updated:', updatedUser.user.email)
        console.log('New confirmed at:', updatedUser.user.email_confirmed_at)
    }
  } else {
  
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
}

createDemoUser()
