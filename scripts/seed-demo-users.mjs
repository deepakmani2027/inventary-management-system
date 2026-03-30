import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envFilePath = path.join(projectRoot, '.env.local')

function loadEnvFile(content) {
  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmedLine.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1).trim()

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

async function main() {
  const envFile = await readFile(envFilePath, 'utf8')
  loadEnvFile(envFile)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const demoUsers = [
    {
      email: 'admin@example.com',
      password: 'password123',
      fullName: 'Admin User',
      role: 'admin',
    },
    {
      email: 'salesman@example.com',
      password: 'password123',
      fullName: 'Salesman User',
      role: 'salesman',
    },
    {
      email: 'inventory@example.com',
      password: 'password123',
      fullName: 'Inventory User',
      role: 'inventory_manager',
    },
    {
      email: 'manager@example.com',
      password: 'password123',
      fullName: 'Sales Manager User',
      role: 'sales_manager',
    },
  ]

  const { data: userList, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (listError) {
    throw listError
  }

  const usersByEmail = new Map(userList.users.map(user => [user.email?.toLowerCase(), user]))

  for (const demoUser of demoUsers) {
    const existingUser = usersByEmail.get(demoUser.email.toLowerCase())

    let authUser = existingUser

    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: demoUser.email,
        password: demoUser.password,
        email_confirm: true,
        user_metadata: {
          name: demoUser.fullName,
          role: demoUser.role,
        },
      })

      if (error) {
        throw error
      }

      authUser = data.user
    } else {
      const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: demoUser.password,
        user_metadata: {
          name: demoUser.fullName,
          role: demoUser.role,
        },
      })

      if (error) {
        throw error
      }

      authUser = data.user
    }

    if (!authUser) {
      throw new Error(`Failed to provision auth user for ${demoUser.email}`)
    }

    const { error: profileError } = await supabase
      .from('users')
      .upsert(
        {
          id: authUser.id,
          email: demoUser.email,
          full_name: demoUser.fullName,
          role: demoUser.role,
          password_hash: 'supabase-auth-managed',
          is_active: true,
        },
        { onConflict: 'email' }
      )

    if (profileError) {
      throw profileError
    }

    console.log(`Seeded ${demoUser.email}`)
  }

  console.log('Demo users are ready for testing.')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})