'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Check, ShieldAlert, Sparkles } from 'lucide-react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationSetup() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      setSupported(true);
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  async function checkExistingSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (e) {
      console.error('Error checking push subscription:', e);
    }
  }

  async function subscribe() {
    setLoading(true);
    setStatusMsg('');
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setStatusMsg('Notification permission denied');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckj0YZW00R_EkzQTuW50g9DAK5wq40';

      const convertedKey = urlBase64ToUint8Array(vapidKey);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });

      if (res.ok) {
        setIsSubscribed(true);
        setStatusMsg('Push notifications enabled!');
      } else {
        setStatusMsg('Failed to register subscription on server');
      }
    } catch (err: any) {
      console.error('Push subscribe error:', err);
      setStatusMsg(err.message || 'Error enabling notifications');
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    setStatusMsg('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      setIsSubscribed(false);
      setStatusMsg('Notifications disabled');
    } catch (err: any) {
      console.error('Push unsubscribe error:', err);
      setStatusMsg(err.message || 'Error disabling notifications');
    } finally {
      setLoading(false);
    }
  }

  async function sendTestNotification() {
    setTestSent(true);
    try {
      await fetch('/api/push/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '⚡ ExpenseIQ Alert',
          body: 'Budget push notifications are active! You will get alerts when spending reaches 80% and 100%.',
          url: '/expenses',
        }),
      });
      setTimeout(() => setTestSent(false), 3000);
    } catch (e) {
      console.error('Test push error:', e);
      setTestSent(false);
    }
  }

  if (!supported) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '16px 20px',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--bg-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)'
          }}>
            <BellOff size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Push Notifications</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not supported on this browser or platform</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 20,
      padding: '20px',
      marginBottom: 20,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: isSubscribed ? 'rgba(124, 92, 252, 0.15)' : 'var(--bg-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isSubscribed ? 'var(--accent)' : 'var(--text-muted)',
            transition: 'all 0.2s ease',
          }}>
            {isSubscribed ? <BellRing size={20} /> : <Bell size={20} />}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              Budget Push Alerts
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Instant mobile warnings at 80% & 100% of category budget
            </div>
          </div>
        </div>

        <button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={loading}
          style={{
            padding: '8px 16px',
            borderRadius: 99,
            border: 'none',
            background: isSubscribed ? 'var(--danger-dim)' : 'var(--accent)',
            color: isSubscribed ? 'var(--danger)' : '#fff',
            fontWeight: 700,
            fontSize: 13,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: isSubscribed ? 'none' : '0 2px 10px rgba(124, 92, 252, 0.3)',
          }}
        >
          {loading ? 'Processing...' : isSubscribed ? 'Disable' : 'Enable Alerts'}
        </button>
      </div>

      {statusMsg && (
        <div style={{ fontSize: 12, color: 'var(--accent-2)', marginBottom: 12, fontWeight: 600 }}>
          {statusMsg}
        </div>
      )}

      {isSubscribed && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-elevated)', borderRadius: 14, padding: '10px 14px', marginTop: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
            <Check size={14} /> Device registered for alerts
          </div>
          <button
            onClick={sendTestNotification}
            disabled={testSent}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Sparkles size={12} color="var(--accent)" />
            {testSent ? 'Sent!' : 'Test Notification'}
          </button>
        </div>
      )}
    </div>
  );
}
