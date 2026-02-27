import type { AssemblyStats } from '../madansix/types'

interface StatsPanelProps {
  stats: AssemblyStats
}

function fmt(n: number): string {
  return n.toLocaleString()
}

interface RowProps {
  label: string
  before: number | string
  after: number | string
  improvementCheck?: (before: number, after: number) => boolean
}

function StatsRow({ label, before, after, improvementCheck }: RowProps) {
  const isImproved =
    improvementCheck !== undefined &&
    typeof before === 'number' &&
    typeof after === 'number'
      ? improvementCheck(before, after)
      : false

  return (
    <tr>
      <td className="stats-table-label">{label}</td>
      <td className="stats-table-before">{typeof before === 'number' ? fmt(before) : before}</td>
      <td className={`stats-table-after${isImproved ? ' stats-improved' : ''}`}>
        {typeof after === 'number' ? fmt(after) : after}
      </td>
    </tr>
  )
}

export function StatsPanel({ stats }: StatsPanelProps) {
  return (
    <div className="stats-panel">
      <h3 className="stats-panel-title">Assembly Statistics</h3>
      <table className="stats-table">
        <thead>
          <tr>
            <th className="stats-table-label">Metric</th>
            <th>Before</th>
            <th>After</th>
          </tr>
        </thead>
        <tbody>
          <StatsRow
            label="Contigs"
            before={stats.originalCount}
            after={stats.finalCount}
            improvementCheck={(b, a) => a < b}
          />
          <StatsRow
            label="N50 (bp)"
            before={stats.n50Before}
            after={stats.n50After}
            improvementCheck={(b, a) => a > b}
          />
          <StatsRow
            label="Longest (bp)"
            before={stats.longestBefore}
            after={stats.longestAfter}
            improvementCheck={(b, a) => a > b}
          />
          <StatsRow
            label="Total length (bp)"
            before={stats.totalLenBefore}
            after={stats.totalLenAfter}
          />
          <tr>
            <td className="stats-table-label">Joins made</td>
            <td className="stats-table-before">—</td>
            <td className={`stats-table-after${stats.joinsCount > 0 ? ' stats-improved' : ''}`}>
              {fmt(stats.joinsCount)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
