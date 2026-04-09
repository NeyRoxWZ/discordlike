import { NextResponse } from 'next/server';

type Entry = { count: number; resetAt: number };

const globalForRateLimit = globalThis as unknown as {
  __distollecRateLimit?: Map<string, Entry>;
};

function store() {
  globalForRateLimit.__distollecRateLimit ??= new Map<string, Entry>();
  return globalForRateLimit.__distollecRateLimit;
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

export function rateLimitOrThrow(req: Request, opts: { keyPrefix: string; limit: number; windowMs: number }) {
  const ip = getClientIp(req);
  const key = `${opts.keyPrefix}:${ip}`;
  const now = Date.now();

  const s = store();
  const entry = s.get(key);

  if (!entry || entry.resetAt <= now) {
    s.set(key, { count: 1, resetAt: now + opts.windowMs });
    return null;
  }

  if (entry.count >= opts.limit) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return NextResponse.json({ error: 'Rate limit' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
  }

  entry.count += 1;
  s.set(key, entry);
  return null;
}
