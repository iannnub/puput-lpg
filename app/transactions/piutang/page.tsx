import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { getPiutangList } from './queries'
import { PiutangClient } from './piutang-client'
import { getWibTodayString } from '@/lib/utils/date-wib'

export const dynamic = 'force-dynamic'

export default async function PiutangPage() {
  await getAuthenticatedContext()
  const items = await getPiutangList('all')

  return (
    <AppShell activePath="/transactions">
      <PiutangClient items={items} defaultDate={getWibTodayString()} />
    </AppShell>
  )
}
