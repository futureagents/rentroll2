import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Read lazily so a missing key fails the request that needs it, not the build.
export function serverEnv() {
  return {
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

// Optional: without it the S-01 assistant is off and the composer drafts from templates (D-37, E1-09).
export function anthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}
