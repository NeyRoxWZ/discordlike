import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const isAuthPage =
    req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/register');
  const isPublicPage = req.nextUrl.pathname.startsWith('/invite') || req.nextUrl.pathname.startsWith('/s/');

  if (!session && !isAuthPage && !isPublicPage) {
    const next = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    const url = new URL(`/login?next=${encodeURIComponent(next)}`, req.url);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sounds).*)']
};
