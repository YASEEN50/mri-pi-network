/** When true, skip inbox verification for email register/link (testing only). */
export function shouldAutoVerifyEmail(): boolean {
  return process.env.AUTH_AUTO_VERIFY_EMAIL === 'true'
}
