import { NextResponse, type NextRequest } from 'next/server';
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/eve/')) {
    const origin = request.headers.get('origin');
    // Next dev can normalize request.url to localhost while the browser uses 127.0.0.1.
    const host = request.headers.get('host');
    const allowedHosts = new Set(['127.0.0.1:3000', 'localhost:3000']);
    if (!host || !allowedHosts.has(host) || request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== `http://${host}`)) return new NextResponse('Cross-origin access denied', { status: 403 });
  }
  return NextResponse.next();
}
