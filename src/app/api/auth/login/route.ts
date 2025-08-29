import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getCookieOptions, getCookieName, signAuthToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const emailInput = ((body?.email ?? body?.username) ?? '').toString().trim().toLowerCase();
		const password = (body?.password ?? '').toString();

		if (!emailInput || !password) {
			return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
		}

		const user = await prisma.user.findUnique({ where: { email: emailInput } });
		if (!user) {
			return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const valid = await bcrypt.compare(password, user.passwordHash);
		if (!valid) {
			return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
		}

		// Create DB session and set JWT cookie with synchronized expiry times
		const now = Date.now();
		const sessionTtlMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
		const expires = new Date(now + sessionTtlMs);
		
		const session = await prisma.session.create({
			data: { userId: user.id, expires },
			select: { id: true, expires: true },
		});

		const token = await signAuthToken({ uid: user.id, sid: session.id, email: user.email, name: user.name }, Math.floor(sessionTtlMs / 1000));

		const res = NextResponse.json({ ok: true }, { status: 200 });
		res.cookies.set(getCookieName(), token, getCookieOptions(expires));
		return res;
	} catch (error) {
		console.error('Login error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}


