# Incident: Edge Rate Limiting Lockout & LPDoS Attack Mitigation

## Purpose
This runbook provides emergency triage procedures when legitimate users (such as branch offices sharing a public NAT IP) are locked out with HTTP 429 Too Many Requests, or when an active Low-and-Slow Denial of Service (LPDoS) / brute-force attack hammers Edge Proxy endpoints.

## Impact
- **Systems Affected**: Edge Auth Proxy (`apps/web/proxy.ts`), Edge Rate Limiter (`apps/web/lib/security/rate-limiter.ts`), Upstash Redis, Vercel Edge Network.
- **User Impact**: Legitimate field staff at a depot or plant facility are blocked from loading pages or logging shifts. In an attack, serverless function invocation quotas and database connections are threatened.
- **Business Impact**: Localized operational paralysis at affected branch locations.

## Symptoms
- **HTTP 429 Too Many Requests Spike**: Users receive JSON error:
  ```json
  {
    "error": "Too Many Requests",
    "message": "Request rate limit exceeded. LPDoS / Brute-force safeguard active.",
    "retryAfter": 45
  }
  ```
  Headers present: `Retry-After: 45`, `X-RateLimit-Remaining: 0`.
- **Branch Office Lockout**: 20+ supervisors and operators sharing a single public Wi-Fi/NAT router exceed sliding-window limits.
- **Surge in Invocations**: Rapid POST requests targeting `/login` or `/api/auth/*` from cloud IP ranges (AWS, DigitalOcean, Hetzner).

## Severity
**P1 (High)**

## Immediate Actions
1. **Identify Client IP (< 2 min)** `[SAFE AUTOMATION]`:
   - In Vercel Dashboard -> **Logs** -> Filter for `status:429`. Note the client IP address (`cf-connecting-ip` or `x-forwarded-for`).
2. **Determine Threat vs Legitimate Depot** `[SAFE AUTOMATION]`:
   - If IP is a known ReachInternational facility: Proceed to **Action A (Unblock Legitimate Branch)**.
   - If IP is an external cloud/bot subnet: Proceed to **Action B (Block Attacker at Firewall)**.

## Diagnosis
1. **Review Sliding-Window Rate Limit Profiles** `[SAFE AUTOMATION]`:
   In `apps/web/lib/security/rate-limiter.ts`:
   - `AUTH_STRICT`: 10 requests / 60 seconds (`/login`, `/signup`, `/forgot-password`)
   - `MUTATION_API`: 60 requests / 60 seconds (Server Actions & POST mutations)
   - `GENERAL_ROUTES`: 120 requests / 60 seconds (Page navigations)
   - `AUTHENTICATED_USER`: 300 requests / 60 seconds (Active sessions)
2. **Check IP Extraction Header Order** `[SAFE AUTOMATION]`:
   `getClientIp()` evaluates:
   1. `cf-connecting-ip` (Cloudflare)
   2. `x-real-ip`
   3. `x-forwarded-for` (rightmost trusted proxy IP)
   4. `true-client-ip` (Akamai)
   *Verify reverse-proxy headers are not incorrectly mapping all traffic to internal gateway IPs (e.g. 10.0.0.1).*
3. **Inspect Upstash Redis Keys (if active)** `[SAFE AUTOMATION]`:
   If `UPSTASH_REDIS_REST_URL` is configured, inspect active keys matching `ratelimit:<IP>:*`.

## Recovery

### Action A: Unblock Legitimate Branch Office / Shared NAT IP
1. **Advise 60-Second Cooldown** `[SAFE AUTOMATION]`:
   - In-memory rate limiting uses a 60-second sliding window. If users pause clicking for 60 seconds, counters clear automatically.
2. **Purge Redis Rate Limit Keys (if distributed Redis is enabled)** `[REQUIRES HUMAN APPROVAL]`:
   If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in production:
   ```bash
   curl -X POST "$UPSTASH_REDIS_REST_URL/del/ratelimit:<BRANCH_IP>:auth" \
     -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
   curl -X POST "$UPSTASH_REDIS_REST_URL/del/ratelimit:<BRANCH_IP>:gen" \
     -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
   ```
   *If Upstash Redis is not configured, the edge proxy runs in-memory and unlocks automatically after the 60-second cooldown.*
3. **Whitelist Branch IP in Vercel Firewall** `[REQUIRES HUMAN APPROVAL]`:
   - In Vercel Dashboard -> **Settings** -> **Security** -> **Firewall** -> Add **Bypass** rule for the branch's static IP range.

### Action B: Mitigate Malicious Brute-Force / LPDoS Attack
1. **Block Attacker IP at Vercel Edge Firewall** `[REQUIRES HUMAN APPROVAL]`:
   - In Vercel Dashboard -> **Settings** -> **Security** -> **Firewall** -> Click **Add Rule**:
     - Action: `Deny / Block`
     - Condition: `IP Address` equals `<ATTACKER_IP>`
   - *Vercel drops packets at the global edge without executing serverless functions.*
2. **Enable Vercel Attack Challenge Mode** `[REQUIRES HUMAN APPROVAL]`:
   - If attack is distributed across rotating proxies: Under **Security**, toggle **Attack Challenge Mode** to require proof-of-work puzzles before reaching Next.js.

## Validation
1. **Verify Unblocked IP Receives 200 OK**:
   ```bash
   curl -i "https://www.reachinternational.co.in/login"
   ```
   *Must return HTTP 200 OK with `X-RateLimit-Remaining: > 0`.*
2. **Verify Blocked Malicious IP Returns 403**:
   ```bash
   # From blocked environment
   curl -i "https://www.reachinternational.co.in/"
   ```
   *Must return HTTP 403 Forbidden (dropped at edge).*
3. **Verify Overall App Health**:
   ```bash
   curl -s "https://www.reachinternational.co.in/api/health?check=ready"
   ```
   *Must return HTTP 200 OK, `db: "healthy"`.*

## Rollback
- **Firewall Rule Rollback**: In Vercel Dashboard -> **Security** -> **Firewall**, delete or disable the block rule if an IP was blocked in error. Traffic is restored within 30 seconds globally.

## Escalation
- If a distributed DDoS attack exceeds Vercel edge capacity, escalate to Vercel Enterprise Support to activate L3/L4 volumetric traffic scrubbing.

## Do Not
- **DO NOT** disable rate limiting globally in `proxy.ts` (exposes backend to LPDoS crashes).
- **DO NOT** increase `AUTH_STRICT` limits beyond 30 req/min (enables credential stuffing).
- **DO NOT** block private IP CIDR ranges (`10.0.0.0/8`, `192.168.0.0/16`, `127.0.0.1`).

## Root Cause Follow-Up
- If branch office lockouts recur, coordinate with site IT to assign dedicated static public IPs or configure authenticated user profile limits (`AUTHENTICATED_USER: 300/min`).
- Log incident in `public.audit_logs`:
  ```sql
  INSERT INTO public.audit_logs (action, category, severity, details, created_at)
  VALUES ('RATE_LIMIT_MITIGATION_APPLIED', 'security', 'HIGH', '{"ip": "<IP>", "action": "whitelisted_or_blocked"}', now());
  ```
- File postmortem in [`performance/monitoring/incidents.md`](../performance/monitoring/incidents.md).
