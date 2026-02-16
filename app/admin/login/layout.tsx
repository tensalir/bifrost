/**
 * Login layout — no sidebar, just the page content.
 * Overrides the admin layout which includes the Nav sidebar.
 */
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
