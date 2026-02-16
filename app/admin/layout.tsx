import { Nav } from '@/components/nav'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
