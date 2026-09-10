'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const from         = searchParams.get('from') || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [shake,    setShake]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok) {
        router.push(from);
        router.refresh();
      } else {
        setError(data.error || 'Invalid credentials');
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = username.trim() && password;

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px 16px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Animated background blobs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '-15%', left: '-10%',
          width: '55vw', height: '55vw',
          background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)',
          opacity: 0.12, filter: 'blur(80px)', borderRadius: '50%',
          animation: 'blob-float 18s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', right: '-10%',
          width: '50vw', height: '50vw',
          background: 'radial-gradient(circle, var(--success) 0%, transparent 65%)',
          opacity: 0.08, filter: 'blur(80px)', borderRadius: '50%',
          animation: 'blob-float 22s ease-in-out infinite reverse',
          animationDelay: '-8s',
        }} />
        <div style={{
          position: 'absolute', top: '30%', right: '10%',
          width: '35vw', height: '35vw',
          background: 'radial-gradient(circle, #A462F5 0%, transparent 65%)',
          opacity: 0.08, filter: 'blur(60px)', borderRadius: '50%',
          animation: 'blob-float 26s ease-in-out infinite',
          animationDelay: '-14s',
        }} />
      </div>

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 400,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border-glow)',
        borderRadius: 28,
        padding: '40px 28px 36px',
        boxShadow: 'var(--shadow-xl), var(--shadow-glow)',
        animation: shake ? 'shake 0.4s ease' : 'fade-scale 0.4s var(--ease) both',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          {/* Icon */}
          <div style={{
            width: 60, height: 60,
            background: 'var(--accent-grad)',
            borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px auto',
            boxShadow: 'var(--shadow-accent)',
            animation: 'float 4s ease-in-out infinite',
          }}>
            <Sparkles size={28} color="#fff" strokeWidth={2} />
          </div>

          <h1 style={{
            fontSize: 30, fontWeight: 900,
            background: 'var(--accent-grad)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 8, letterSpacing: '-0.6px',
          }}>ExpenseIQ</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.5 }}>
            Welcome back! Sign in to your<br />personal finance dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Username Field */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 7 }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
              }}>
                <User size={17} />
              </span>
              <input
                id="username"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                style={{
                  width: '100%',
                  paddingLeft: 44, paddingRight: 16, paddingTop: 13, paddingBottom: 13,
                  background: 'var(--bg-input)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 14,
                  color: 'var(--text-primary)',
                  fontSize: 15, fontWeight: 500,
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  fontFamily: "'DM Sans', 'Inter', sans-serif",
                }}
                onFocus={e => {
                  (e.target as HTMLInputElement).style.borderColor = 'var(--accent)';
                  (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px var(--accent-dim)';
                }}
                onBlur={e => {
                  (e.target as HTMLInputElement).style.borderColor = 'var(--border)';
                  (e.target as HTMLInputElement).style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 7 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
              }}>
                <Lock size={17} />
              </span>
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{
                  width: '100%',
                  paddingLeft: 44, paddingRight: 48, paddingTop: 13, paddingBottom: 13,
                  background: 'var(--bg-input)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 14,
                  color: 'var(--text-primary)',
                  fontSize: 15, fontWeight: 500,
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  fontFamily: "'DM Sans', 'Inter', sans-serif",
                }}
                onFocus={e => {
                  (e.target as HTMLInputElement).style.borderColor = 'var(--accent)';
                  (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px var(--accent-dim)';
                }}
                onBlur={e => {
                  (e.target as HTMLInputElement).style.borderColor = 'var(--border)';
                  (e.target as HTMLInputElement).style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: 0,
                  display: 'flex', alignItems: 'center',
                  transition: 'color 0.15s',
                }}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              fontSize: 13, color: 'var(--danger)', textAlign: 'center',
              background: 'var(--danger-dim)',
              border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: 10, padding: '10px 14px',
              fontWeight: 600, lineHeight: 1.4,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !canSubmit}
            style={{
              width: '100%', justifyContent: 'center',
              marginTop: 4, padding: '15px 0',
              fontSize: 15, fontWeight: 800,
              background: canSubmit ? 'var(--accent-grad)' : 'var(--bg-elevated)',
              color: canSubmit ? '#fff' : 'var(--text-muted)',
              border: 'none', borderRadius: 99,
              cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: canSubmit ? 'var(--shadow-accent)' : 'none',
              transition: 'all 0.2s ease',
              letterSpacing: '-0.2px',
              fontFamily: "'DM Sans', 'Inter', sans-serif",
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="spinner" style={{ width: 17, height: 17 }} />
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
