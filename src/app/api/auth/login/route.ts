import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

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

		return NextResponse.json({ ok: true }, { status: 200 });
	} catch (error) {
		console.error('Login error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}


