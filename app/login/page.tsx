'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Lock, Eye, EyeOff } from 'lucide-react';

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

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: '24px 16px', position: 'relative', overflow: 'hidden'
    }}>
      {/* Background blobs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw',
          background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 60%)',
          opacity: 0.15, filter: 'blur(60px)', borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', right: '-10%', width: '40vw', height: '40vw',
          background: 'radial-gradient(circle, var(--success) 0%, transparent 60%)',
          opacity: 0.1, filter: 'blur(60px)', borderRadius: '50%',
        }} />
      </div>

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 400,
        background: 'rgba(var(--bg-card-rgb), 0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(139, 124, 246, 0.2)', // border-glow substitute
        borderRadius: 'var(--radius-lg)', padding: '40px 32px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
        animation: shake ? 'shake 0.4s ease' : undefined,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontSize: 28, fontWeight: 800,
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: 8,
          }}>ExpenseIQ</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Welcome back! Please enter your details.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Username */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center'
              }}><User size={18} /></span>
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                style={{ paddingLeft: 42, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center'
              }}><Lock size={18} /></span>
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                className="form-input"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{ paddingLeft: 42, paddingRight: 44, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  padding: 0, display: 'flex', alignItems: 'center'
                }}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Error banner moved below inputs */}
          {error && (
            <div style={{ fontSize: 13, color: 'var(--danger)', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !username || !password}
            style={{
              width: '100%', justifyContent: 'center', marginTop: 4,
              padding: '14px 0', fontSize: 15, fontWeight: 700,
              background: 'var(--accent-gradient)', border: 'none', color: '#fff',
              opacity: loading || !username || !password ? 0.7 : 1,
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-5px); }
          80%       { transform: translateX(5px); }
        }
      `}</style>
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
