import { motion } from "motion/react";

/* Sign-in screen. The button is a real navigation to /auth/google (proxied
 * to the backend), which runs the Google OAuth flow and returns to the app. */
export function Login() {
  return (
    <>
      <div className="ts-aurora" />
      <div className="grid min-h-screen place-items-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
          className="ts-glass w-full max-w-md rounded-[22px] p-10 text-center"
        >
          <div className="mx-auto mb-6 flex items-center justify-center gap-2.5">
            <span className="ts-pulse inline-block h-3 w-3 rounded-full bg-cyan shadow-[0_0_14px_var(--cyan)]" />
            <span className="bg-gradient-to-r from-white to-[#9db4ff] bg-clip-text font-heading text-2xl font-bold text-transparent">
              Ocelli
            </span>
          </div>
          <h1 className="font-heading text-xl font-bold">The extra eyes on your work</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Sign in with your Google account to see your real agenda, tasks and triaged inbox.
          </p>

          <a
            href="/auth/google"
            className="ts-glow-primary mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-primary to-accent2 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <GoogleMark /> Sign in with Google
          </a>

          <p className="mt-5 text-[11px] text-muted-foreground">
            Read-only calendar access · nothing is posted without your action.
          </p>
        </motion.div>
      </div>
    </>
  );
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.2 36.3 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
