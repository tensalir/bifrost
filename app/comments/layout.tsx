/**
 * Comments layout — full-screen overlay.
 * Uses fixed positioning to cover the root layout's sidebar + padding,
 * creating a clean full-screen sheet view like Babylon.
 */
export default function CommentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-hidden">
      {children}
    </div>
  )
}
