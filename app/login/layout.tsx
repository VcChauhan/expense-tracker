// Login page gets its own bare layout — no sidebar, no bottom nav
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
