# Security Policy

This document describes the security model, implemented protections, and responsible disclosure process for **RepoLens AI**.

---

## Table of Contents

- [Authentication Model](#authentication-model)
- [Row-Level Security (RLS) Policies](#row-level-security-rls-policies)
- [API Key Handling](#api-key-handling)
- [Environment Variables](#environment-variables)
- [Security Headers](#security-headers)
- [Rate Limiting](#rate-limiting)
- [Input Validation](#input-validation)
- [Known Limitations](#known-limitations)
- [Reporting a Vulnerability](#reporting-a-vulnerability)

---

## Authentication Model

RepoLens AI uses **[Supabase Auth](https://supabase.com/docs/guides/auth)** for authentication, backed by JWT session tokens.

### Flow

1. **Sign-up / Login** — users authenticate via Supabase's email/password or OAuth provider.
2. **Session** — Supabase issues a signed JWT stored in an `httpOnly` cookie managed by `@supabase/ssr`.
3. **Edge enforcement** — `src/proxy.ts` runs on every request at the Next.js edge layer and calls `supabase.auth.getUser()` to verify the session before any route handler executes.
4. **API guard** — every API route independently calls `supabase.auth.getUser()` as a second layer of defense. An unauthenticated request returns `401 Unauthorized`.
5. **Redirect safety** — the auth callback's `?next=` parameter is validated to be a same-origin relative URL, preventing open redirect attacks.

### Protected Routes

| Pattern | Protection |
|---------|-----------|
| `/dashboard/*` | Middleware redirect to `/login` if unauthenticated |
| `/api/*` | Per-route `getUser()` guard → `401` |
| `/login`, `/signup`, `/forgot-password` | Redirects to `/dashboard` if already authenticated |
| `/auth/callback` | Code exchange only; `?next` validated as same-origin path |

---

## Row-Level Security (RLS) Policies

All database tables use Supabase's **Row-Level Security** to ensure users can only access their own data.

### Principles

- Every table includes a `user_id` column referencing `auth.users(id)`.
- RLS policies enforce `auth.uid() = user_id` on all SELECT, INSERT, UPDATE, and DELETE operations.
- The **anon key** (public) is limited to what RLS allows — no table is readable without a valid session.
- The **service role key** is only used in server-side code (never exposed to the client) and only for administrative operations.

### Key Tables & Policies

| Table | Policy |
|-------|--------|
| `repositories` | Owner-only: `user_id = auth.uid()` |
| `commits` | Scoped to repository owner |
| `cross_repo_reports` | Owner-only |
| `ai_analytics` | Owner-only |
| `embeddings` | Scoped to repository owner |

> **Note:** RLS policies are defined in the SQL migration files under `db/` and `scripts/`. Always review them when adding new tables.

---

## API Key Handling

| Key | Scope | Storage | Exposure |
|-----|-------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `.env.local` | Public (safe — not a secret) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | `.env.local` | Public (RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key | `.env.local` | **Server-only** — never exposed to client |
| `GROQ_API_KEY` | Groq LLM API | `.env.local` | **Server-only** — used only in API routes |
| `GITHUB_TOKEN` _(optional)_ | GitHub API auth | `.env.local` | **Server-only** — raises rate limit 60 → 5,000 req/hr |

### Rules

- Keys prefixed with `NEXT_PUBLIC_` are intentionally sent to the browser. All others **must remain server-only**.
- No secret key is ever imported in a file under `src/app/` client components or `src/components/`.
- The Groq API key is read only inside `src/lib/llm/groq.ts`, which runs exclusively server-side.
- If you suspect a key has been compromised, rotate it immediately in the provider dashboard and update `.env.local`.

---

## Environment Variables

### Required Variables

```
NEXT_PUBLIC_SUPABASE_URL=       # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase publishable anon key
SUPABASE_SERVICE_ROLE_KEY=      # Supabase service role key (server-only)
GROQ_API_KEY=                   # Groq API key (server-only)
```

### Optional Variables

```
GITHUB_TOKEN=                   # GitHub Personal Access Token (raises API rate limit)
```

### Security Checklist

- [ ] `.env.local` is listed in `.gitignore` — **never commit secrets**
- [ ] Rotate all keys before open-sourcing or sharing the repository
- [ ] Use environment variable management (Vercel env, Railway secrets, etc.) in production
- [ ] Never log environment variables or API keys in server output

---

## Security Headers

All HTTP responses include the following security headers, applied at both the Next.js middleware layer and `next.config.ts`:

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | Custom (see `src/proxy.ts`) | Prevents XSS, data injection |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage |
| `Permissions-Policy` | Disables camera, mic, geolocation | Reduces attack surface |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Enforces HTTPS |
| `X-DNS-Prefetch-Control` | `on` | DNS performance |

### Content Security Policy

The CSP is generated dynamically in `src/proxy.ts` and allows:

- **Scripts**: `'self'`, `'unsafe-inline'` (required by Next.js), `'unsafe-eval'` in development only
- **Styles**: `'self'`, `'unsafe-inline'`, `fonts.googleapis.com`
- **Fonts**: `'self'`, `fonts.gstatic.com`
- **Images**: `'self'`, `data:`, `blob:`, GitHub avatars
- **Connect**: `'self'`, your Supabase project domain, `api.github.com`
- **Frames**: `'none'` — no embedding allowed

---

## Rate Limiting

API routes are protected by a **per-user sliding-window rate limiter** (`src/lib/rate-limit.ts`).

Using per-user-ID keys (not per-IP) prevents bypass via VPN or shared IPs.

| Endpoint | Limit | Window |
|----------|-------|--------|
| Repository import (`/api/repositories/import`) | 5 requests | 60 seconds |
| AI/LLM analysis (`ai-analysis` action) | 10 requests | 60 seconds |
| Cross-repo operations | 20 requests | 60 seconds |
| General API (dashboard, analytics) | 100 requests | 60 seconds |

When a limit is exceeded, the API returns:

```json
HTTP 429 Too Many Requests
Retry-After: <seconds>
X-RateLimit-Limit: <limit>
X-RateLimit-Remaining: 0
X-RateLimit-Reset: <unix-timestamp>
```

> **Production Note:** The current implementation uses an in-memory store. For multi-instance deployments, replace `src/lib/rate-limit.ts`'s `store` with a Redis-backed solution (e.g., Upstash Redis with `@upstash/ratelimit`).

---

## Input Validation

All API routes validate and sanitize incoming parameters:

### Query Parameters

| Parameter | Validation |
|-----------|-----------|
| `granularity` | Allowlist: `hourly`, `daily`, `weekly`, `monthly` |
| `days` | Clamped: `[1, 365]` |
| `limit` | Clamped: `[1, 100]` |
| `repositoryIds` | UUID format validated (v4 regex) |

### Request Body

| Field | Validation |
|-------|-----------|
| Repository `input` | Max 512 characters, regex-validated format |
| `owner` / `repo` | Max length + character allowlist (`[a-zA-Z0-9._-]`) |
| `action` | Matched against known action strings only |

### Error Responses

Internal errors (5xx) are sanitized before being sent to clients:

- Database error codes (e.g., Postgres `42P01`, `23505`) are mapped to user-friendly messages
- Stack traces, SQL queries, and key names are **never** included in client responses
- Full error details are logged server-side only

---

## Known Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| **In-memory rate limiter** | Resets on server restart; not shared across multiple instances | Replace with Redis for production scale |
| **`'unsafe-inline'` in CSP** | Slightly weakens XSS protection | Required by Next.js; mitigated by nonce support in Next.js 15 when upgrading |
| **GitHub API unauthenticated by default** | 60 req/hour rate limit | Set `GITHUB_TOKEN` in `.env.local` to raise to 5,000 req/hour |
| **No CSRF token** on POST routes | Relies on Supabase session cookie with `SameSite` attribute | Supabase cookies use `SameSite=Lax` which blocks cross-site form-based CSRF |
| **No audit log** | User actions not recorded | Future enhancement: add an `audit_log` table in Supabase |
| **No bot detection / CAPTCHA** | Signup spam possible | Future enhancement: integrate hCaptcha or Cloudflare Turnstile |

---

## Reporting a Vulnerability

If you discover a security vulnerability in RepoLens AI, please **do not open a public GitHub issue**.

Instead:

1. Email the maintainers at: **[security@repolens.ai]** _(replace with your actual contact)_
2. Include a description of the vulnerability and steps to reproduce
3. We will acknowledge your report within **48 hours** and aim to resolve critical issues within **7 days**

We appreciate responsible disclosure and will credit reporters in the changelog.

---

*Last updated: July 2026*
