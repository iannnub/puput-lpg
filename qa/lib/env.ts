import { config } from 'dotenv'
import fs from 'node:fs'

const file = process.env.QA_ENV_FILE || '.env.qa.local'
if (fs.existsSync(file)) config({ path: file, override: true })

const REQUIRED = [
  'QA_ENV',
  'QA_BASE_URL',
  'QA_OWNER_EMAIL',
  'QA_OWNER_PASSWORD',
  'QA_STAFF_EMAIL',
  'QA_STAFF_PASSWORD'
]

export function loadQaEnv() {
  const missing = REQUIRED.filter(k => !process.env[k])
  if (missing.length) {
    throw new Error(`Variabel QA belum diisi di ${file}: ${missing.join(', ')}`)
  }
  return {
    env: process.env.QA_ENV as 'local' | 'staging' | 'prod',
    baseUrl: process.env.QA_BASE_URL!.replace(/\/$/, ''),
    owner: { email: process.env.QA_OWNER_EMAIL!, password: process.env.QA_OWNER_PASSWORD! },
    staff: { email: process.env.QA_STAFF_EMAIL!, password: process.env.QA_STAFF_PASSWORD! },
    supabaseUrl: process.env.QA_SUPABASE_URL ?? '',
    anonKey: process.env.QA_SUPABASE_ANON_KEY ?? '',
    chromePath:
      process.env.QA_CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  }
}

export function assertWritesAllowed() {
  const host = new URL(process.env.QA_BASE_URL!).host
  const prodHosts = (process.env.QA_PROD_HOSTS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (
    process.env.QA_ENV === 'prod' ||
    prodHosts.includes(host) ||
    process.env.QA_ALLOW_WRITES !== '1'
  ) {
    throw new Error('Tes yang menulis data dilarang di production atau tanpa QA_ALLOW_WRITES=1')
  }
}
