import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getCookieOptions, getCookieName, signAuthToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const name = (body?.name ?? '').trim();
		const emailInput = ((body?.email ?? body?.username) ?? '').toString().trim().toLowerCase();
		const password = (body?.password ?? '').toString();

		if (!name || !emailInput || !password) {
			return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
		}

		const existing = await prisma.user.findUnique({ where: { email: emailInput } });
		if (existing) {
			return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
		}

		const passwordHash = await bcrypt.hash(password, 10);

		const user = await prisma.user.create({
			data: { name, email: emailInput, passwordHash },
			select: { id: true, email: true, name: true },
		});

		// Auto-login: create session and set cookie with synchronized expiry times
		const now = Date.now();
		const sessionTtlMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
		const expires = new Date(now + sessionTtlMs);
		
		const session = await prisma.session.create({ data: { userId: user.id, expires }, select: { id: true } });
		const token = await signAuthToken({ uid: user.id, sid: session.id, email: user.email, name: user.name }, Math.floor(sessionTtlMs / 1000));
		const res = NextResponse.json({ user }, { status: 201 });
		res.cookies.set(getCookieName(), token, getCookieOptions(expires));
		return res;
	} catch (error) {
		console.error('Signup error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}


