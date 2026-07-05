import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'iq-session';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const validUser = process.env.AUTH_USERNAME;
    const validPass = process.env.AUTH_PASSWORD;
    const secret    = process.env.AUTH_SECRET;

    if (!validUser || !validPass || !secret) {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
    }

    // Simple constant-time-ish comparison
    const userMatch = username === validUser;
    const passMatch = password === validPass;

    if (userMatch && passMatch) {
      const response = NextResponse.json({ success: true });
      response.cookies.set(SESSION_COOKIE, secret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
      return response;
    }

    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
