import type { Status } from '../api/types'
import { t } from '../i18n'

const LABELS: Record<Status, string> = {
  missing: t('common.missing'),
  upcoming: t('common.soon'),
  streamable: t('common.available'),
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge badge-${status}`}>{LABELS[status]}</span>
}
