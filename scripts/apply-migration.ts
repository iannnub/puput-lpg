import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Client } from 'pg'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const projectRefMatch = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co/)
const projectRef = projectRefMatch ? projectRefMatch[1] : ''
const dbPassword = process.env.SUPABASE_DB_PASSWORD || ''

if (!projectRef || !dbPassword) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_DB_PASSWORD wajib diisi di .env.local')
}

const regions = [
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-central-1',
  'eu-central-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'sa-east-1',
  'ca-central-1'
]

const candidateHosts: string[] = []
for (const prefix of ['aws-0', 'aws-1']) {
  for (const r of regions) {
    candidateHosts.push(`${prefix}-${r}.pooler.supabase.com`)
  }
}

async function tryHost(host: string): Promise<Client> {
  const connStr = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@${host}:5432/postgres`
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 7000
  })
  try {
    await client.connect()
    console.log(`Connected via: ${host}:5432`)
    return client
  } catch (err: any) {
    await client.end().catch(() => {})
    throw new Error(`${host}: ${err.message}`)
  }
}

async function connectToDb(): Promise<Client> {
  try {
    return await Promise.any(candidateHosts.map(h => tryHost(h)))
  } catch (aggErr: any) {
    console.error('Errors:', aggErr.errors?.map((e: any) => e.message))
    throw new Error('Could not connect to any Supabase pooler region')
  }
}

async function main() {
  const specificFile = process.argv[2]
  const client = await connectToDb()
  try {
    if (specificFile) {
      console.log(`Applying specific migration ${specificFile}...`)
      const sql = readFileSync(join(process.cwd(), specificFile), 'utf8')
      await client.query(sql)
      console.log(`Migration ${specificFile} applied successfully.`)
      return
    }

    const migrationSql = readFileSync(
      join(process.cwd(), 'supabase', 'migrations', '20261016_initial_schema.sql'),
      'utf8'
    )
    console.log('Applying migration 20261016_initial_schema.sql...')
    await client.query(migrationSql)
    console.log('Migration applied successfully.')

    const seedSql = readFileSync(join(process.cwd(), 'supabase', 'seed.sql'), 'utf8')
    console.log('Applying seed.sql...')
    await client.query(seedSql)
    console.log('Seed SQL applied successfully.')

    await client.query(`
      CREATE SCHEMA IF NOT EXISTS supabase_migrations;
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version text NOT NULL PRIMARY KEY,
        statements text[],
        name text
      );
      INSERT INTO supabase_migrations.schema_migrations (version, name)
      VALUES ('20261016190000', 'initial_schema')
      ON CONFLICT (version) DO NOTHING;
    `)

    const tablesRes = await client.query(`
      SELECT count(*)::int AS cnt
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `)
    const funcsRes = await client.query(`
      SELECT count(*)::int AS cnt
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
    `)
    console.log(`Verified: ${tablesRes.rows[0].cnt} public tables, ${funcsRes.rows[0].cnt} public functions.`)
  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('Migration error:', err)
  process.exit(1)
})
