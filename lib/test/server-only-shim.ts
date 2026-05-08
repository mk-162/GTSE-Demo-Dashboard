// Empty stand-in for the `server-only` marker package, used only by vitest.
// In Next.js, `server-only` resolves to either a no-op (Server Component bundles)
// or a throw (Client Component bundles); in vitest we never bundle for the
// browser, so an empty module is correct.
export {};
