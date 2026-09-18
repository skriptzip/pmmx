import type { Status } from '../api/types'

const LABELS: Record<Status, string> = {
  missing: 'Fehlt',
  upcoming: 'Bald',
  streamable: 'Streambar',
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge badge-${status}`}>{LABELS[status]}</span>
}
