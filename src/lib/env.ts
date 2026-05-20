/** Throws if the env var is missing or empty. */
export function requireEnv(name: string): string {
  const v = process.env[name]
  if (v === undefined || v === '') {
    throw new Error(`${name} is required`)
  }
  return v
}
