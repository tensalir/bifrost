'use client'

export interface CsStudioAgencyRow {
  studioAgency: string
  numAssets: number
}

interface CsStudioAgencyTableProps {
  rows: CsStudioAgencyRow[]
}

export function CsStudioAgencyTable({ rows }: CsStudioAgencyTableProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <h3 className="p-2 font-semibold bg-muted/50">Studio / Agency</h3>
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="text-left p-2">Studio / Agency</th>
            <th className="text-right p-2"># Assets</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.studioAgency} className="border-t border-border/50">
              <td className="p-2">{row.studioAgency}</td>
              <td className="p-2 text-right">{row.numAssets}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
