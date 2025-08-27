import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCookieName, readAuthFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await readAuthFromRequest(request);
    const res = NextResponse.json({ ok: true });
    if (!auth?.sid) {
      // Clear cookie anyway
      res.cookies.set(getCookieName(), '', { httpOnly: true, path: '/', maxAge: 0 });
      return res;
    }

    await prisma.session.delete({ where: { id: auth.sid } }).catch(() => {});
    res.cookies.set(getCookieName(), '', { httpOnly: true, path: '/', maxAge: 0 });
    return res;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


