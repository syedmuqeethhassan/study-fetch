import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

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

		return NextResponse.json({ user }, { status: 201 });
	} catch (error) {
		console.error('Signup error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}


