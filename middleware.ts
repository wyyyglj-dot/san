import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect legacy /image and /video routes to unified /create page
  if (pathname === '/image') {
    const url = request.nextUrl.clone();
    url.pathname = '/create';
    url.searchParams.set('mode', 'image');
    return NextResponse.redirect(url, 308);
  }
  if (pathname === '/video') {
    const url = request.nextUrl.clone();
    url.pathname = '/create';
    url.searchParams.set('mode', 'video');
    return NextResponse.redirect(url, 308);
  }

  // Protect /admin/* routes — require authenticated admin user
  if (pathname.startsWith('/admin')) {
    const token = await getToken({ req: request });
    if (!token) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (token.role !== 'admin' && token.role !== 'moderator') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  const response = NextResponse.next();
  response.headers.set('x-pathname', request.nextUrl.pathname);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
