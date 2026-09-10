# Security operations

Signal Studio management APIs are same-origin by default. Public collection endpoints
(`/api/send`, `/api/batch`, `/api/record` and the recorder configuration endpoint) retain
public ingestion CORS. To host the management UI and API on different origins, set
`MANAGEMENT_API_ALLOWED_ORIGIN` to one explicit URL origin. Wildcards are rejected.

Auth tokens expire after eight hours by default and contain an explicit token type,
audience, password fingerprint, session version and assurance level. Logout and password
changes increment the user's session version, revoking every previously issued token for
that user. Enabling 2FA also increments the version before returning the new AAL2 token,
so voluntary enrollment revokes stale AAL1 sessions. This PostgreSQL-backed revocation
works without Redis.

Management token issuers use the same canonical TTL and fixed HS512 verification contract.
The decoder tolerates at most 30 seconds of positive issuer clock skew and rejects tokens
whose issued-at time is farther in the future.

Login failures are limited per normalized username and client address using PostgreSQL
rows and serializable per-key updates. The defaults are five failures in fifteen minutes.
Proxy-derived addresses are ignored by default, including `X-Forwarded-For`, `X-Real-IP`
and vendor headers. Set `CLIENT_IP_HEADER` only when every request is received through a
trusted reverse proxy that removes any caller-provided value and overwrites that exact
header. Without this explicit trust configuration, login limiting uses the fixed `direct`
client scope, so callers cannot rotate spoofed proxy headers to evade the limit.

Expired login-limit rows are removed opportunistically during failed-login processing.
`LOGIN_RATE_LIMIT_RETENTION_SECONDS` defaults to 24 hours and is never allowed below two
active limit windows; `login_rate_limit.updated_at` is indexed for bounded cleanup work.

Collection cache tokens expire after 31 days and are bound to token type, collection
audience, website, derived session/visit identifiers and a hashed IP/user-agent context.
Changing the website or client context makes the recorder reject the token.
