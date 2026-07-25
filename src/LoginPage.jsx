import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, KeyRound, Loader2, ShieldAlert } from 'lucide-react';

/**
 * KSP AI Crime Intelligence Platform — Login Page
 * -------------------------------------------------
 * Standalone component. Does not import or modify anything from the
 * existing dashboard. Mount this at a separate route (e.g. "/login")
 * in your router and call `onAuthenticated(user)` to hand off control
 * to your existing dashboard/session logic.
 *
 * Integration (React Router v6 example):
 *   <Route path="/login" element={<LoginPage onAuthenticated={(u) => navigate('/dashboard')} />} />
 *
 * Replace `fakeAuthenticate()` with your real auth call (e.g. a fetch
 * to your ask-ai-function's sibling auth endpoint, or Catalyst Auth).
 */


// Simplified Karnataka state outline (stylized, not survey-accurate) used
// purely as an atmospheric hero graphic.
const KARNATAKA_PATH =
  'M120 24 L166 40 L182 78 L214 86 L230 118 L214 150 L228 176 L212 210 L226 246 L204 284 L214 320 L184 352 L188 388 L152 410 L146 442 L108 452 L86 424 L48 428 L34 396 L54 366 L34 336 L54 302 L38 268 L64 240 L52 204 L76 178 L64 144 L92 118 L82 84 L108 62 Z';

// A handful of fixed "hotspot" points inside the state outline for the
// radar-sweep signature element (purely decorative, not real data).
const HOTSPOTS = [
  { x: 118, y: 120, delay: 0 },
  { x: 150, y: 200, delay: 0.6 },
  { x: 90, y: 260, delay: 1.2 },
  { x: 160, y: 320, delay: 1.8 },
  { x: 120, y: 380, delay: 2.4 },
  { x: 190, y: 150, delay: 3.0 },
];

const FUNCTIONS_BASE = 'https://ksp-fir-platform-60073928681.development.catalystserverless.in/server';

async function authenticate(username, password) {
  const res = await fetch(`${FUNCTIONS_BASE}/auth-function/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', username, password }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Sign in failed. Please try again.');
  }
  return data.user;
}

export default function LoginPage({ onAuthenticated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
 
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Enter both username and password to continue.');
      return;
    }
    setLoading(true);
    try {
      const user = await authenticate(username.trim(), password);
      if (typeof onAuthenticated === 'function') onAuthenticated(user);
    } catch (err) {
      setError(err.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  

  return (
    <div className="ksp-login-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');

        .ksp-login-root {
          --bg-void: #050b16;
          --bg-panel: #0a1526;
          --bg-card: rgba(15, 28, 48, 0.58);
          --border-glass: rgba(148, 176, 214, 0.16);
          --border-glass-strong: rgba(148, 176, 214, 0.32);
          --accent-gold: #d4af37;
          --accent-gold-soft: rgba(212, 175, 55, 0.16);
          --accent-cyan: #2dd4e0;
          --text-hi: #eaf0f8;
          --text-mid: #93a7c4;
          --text-dim: #5d7091;
          --danger: #ef7a6b;
          font-family: 'Inter', system-ui, sans-serif;
          min-height: 100vh;
          width: 100%;
          background: var(--bg-void);
          color: var(--text-hi);
          display: flex;
          overflow: hidden;
          position: relative;
        }

        .ksp-login-root * { box-sizing: border-box; }

        .ksp-heading { font-family: 'Chakra Petch', 'Inter', sans-serif; letter-spacing: 0.01em; }
        .ksp-mono { font-family: 'JetBrains Mono', monospace; }

        /* ---------- Ambient particles ---------- */
        .ksp-particles {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        .ksp-particle {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: var(--accent-cyan);
          opacity: 0.35;
          filter: blur(0.5px);
          animation: ksp-float 14s ease-in-out infinite;
        }
        @keyframes ksp-float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.15; }
          50% { transform: translateY(-40px) translateX(12px); opacity: 0.55; }
        }

        /* ---------- Left hero ---------- */
        .ksp-hero {
          position: relative;
          flex: 1.15;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px;
          background:
            radial-gradient(ellipse 900px 700px at 30% 20%, rgba(45, 212, 224, 0.08), transparent 60%),
            radial-gradient(ellipse 700px 600px at 80% 85%, rgba(212, 175, 55, 0.06), transparent 60%),
            linear-gradient(160deg, var(--bg-void) 0%, var(--bg-panel) 100%);
          border-right: 1px solid var(--border-glass);
          min-width: 0;
        }
        .ksp-hero-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(148,176,214,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,176,214,0.045) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(ellipse 70% 70% at 50% 45%, black, transparent);
        }

        .ksp-map-wrap {
          position: relative;
          width: min(360px, 70%);
          aspect-ratio: 1 / 1.4;
          margin-bottom: 8px;
          z-index: 1;
        }
        .ksp-map-svg { width: 100%; height: 100%; overflow: visible; }
        .ksp-map-outline {
          fill: rgba(45, 212, 224, 0.05);
          stroke: var(--accent-cyan);
          stroke-width: 1.4;
          stroke-opacity: 0.65;
          filter: drop-shadow(0 0 14px rgba(45, 212, 224, 0.25));
        }
        .ksp-hotspot { fill: var(--accent-gold); }
        .ksp-hotspot-ring {
          fill: none;
          stroke: var(--accent-gold);
          stroke-width: 1.2;
          transform-origin: center;
          animation: ksp-pulse 3s ease-out infinite;
        }
        @keyframes ksp-pulse {
          0% { r: 3; opacity: 0.9; stroke-width: 1.4; }
          100% { r: 16; opacity: 0; stroke-width: 0.3; }
        }
        .ksp-sweep-group { transform-origin: 128px 236px; animation: ksp-rotate 5.5s linear infinite; }
        @keyframes ksp-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .ksp-hero-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 16px 7px 10px;
          border: 1px solid var(--border-glass-strong);
          border-radius: 999px;
          background: rgba(10, 21, 38, 0.5);
          margin-bottom: 28px;
          z-index: 1;
        }
        .ksp-hero-badge-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--accent-cyan);
          box-shadow: 0 0 8px var(--accent-cyan);
          animation: ksp-blink 2s ease-in-out infinite;
        }
        @keyframes ksp-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        .ksp-hero-badge span { font-size: 12px; letter-spacing: 0.09em; color: var(--text-mid); text-transform: uppercase; }

        .ksp-hero-tagline {
          z-index: 1;
          text-align: center;
          max-width: 420px;
          margin-top: 18px;
        }
        .ksp-hero-tagline h2 {
          font-size: 22px;
          font-weight: 600;
          color: var(--text-hi);
          margin: 0 0 10px;
        }
        .ksp-hero-tagline p {
          font-size: 14.5px;
          line-height: 1.65;
          color: var(--text-mid);
          margin: 0;
        }

        .ksp-hero-stats {
          z-index: 1;
          display: flex;
          gap: 28px;
          margin-top: 36px;
          padding-top: 24px;
          border-top: 1px solid var(--border-glass);
        }
        .ksp-hero-stat { text-align: center; }
        .ksp-hero-stat b {
          display: block;
          font-family: 'Chakra Petch', sans-serif;
          font-size: 20px;
          color: var(--accent-cyan);
        }
        .ksp-hero-stat span { font-size: 10.5px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; }

        /* ---------- Right panel ---------- */
        .ksp-panel {
          flex: 1;
          min-width: 380px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
          position: relative;
          overflow-y: auto;
        }

        .ksp-card {
          position: relative;
          width: 100%;
          max-width: 400px;
          background: var(--bg-card);
          border: 1px solid var(--border-glass);
          border-radius: 20px;
          padding: 36px 32px 28px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04);
          opacity: 0;
          transform: translateY(14px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .ksp-card.mounted { opacity: 1; transform: translateY(0); }

        .ksp-logo-row { display: flex; flex-direction: column; align-items: center; margin-bottom: 22px; }
        .ksp-logo-badge {
          width: 56px; height: 56px;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(145deg, rgba(212,175,55,0.18), rgba(212,175,55,0.04));
          border: 1px solid rgba(212,175,55,0.4);
          margin-bottom: 14px;
        }
        .ksp-title { font-size: 17px; font-weight: 700; text-align: center; line-height: 1.35; margin: 0; }
        .ksp-title small { display: block; font-size: 12.5px; font-weight: 500; color: var(--accent-cyan); letter-spacing: 0.03em; margin-top: 2px; }
        .ksp-subtitle { font-size: 12.5px; color: var(--text-dim); text-align: center; margin: 8px 0 0; }

        .ksp-field { margin-bottom: 16px; }
        .ksp-field label {
          display: block; font-size: 11.5px; font-weight: 600; letter-spacing: 0.05em;
          text-transform: uppercase; color: var(--text-mid); margin-bottom: 7px;
        }
        .ksp-input-wrap { position: relative; }
        .ksp-input-wrap input {
          width: 100%;
          padding: 12px 14px;
          background: rgba(5, 11, 22, 0.55);
          border: 1px solid var(--border-glass);
          border-radius: 11px;
          color: var(--text-hi);
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .ksp-input-wrap input::placeholder { color: var(--text-dim); }
        .ksp-input-wrap input:focus {
          border-color: var(--accent-cyan);
          box-shadow: 0 0 0 3px rgba(45, 212, 224, 0.14);
        }
        .ksp-input-wrap.has-icon input { padding-right: 42px; }
        .ksp-eye-btn {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: var(--text-dim); cursor: pointer;
          display: flex; padding: 4px; border-radius: 6px;
        }
        .ksp-eye-btn:hover { color: var(--text-mid); }

        .ksp-row-between { display: flex; align-items: center; justify-content: space-between; margin: 4px 0 20px; }
        .ksp-remember { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--text-mid); cursor: pointer; user-select: none; }
        .ksp-remember input { accent-color: var(--accent-cyan); width: 14px; height: 14px; cursor: pointer; }
        .ksp-forgot { font-size: 12.5px; color: var(--accent-cyan); text-decoration: none; background: none; border: none; cursor: pointer; padding: 0; }
        .ksp-forgot:hover { text-decoration: underline; }

        .ksp-error {
          display: flex; align-items: center; gap: 8px;
          background: rgba(239, 122, 107, 0.1);
          border: 1px solid rgba(239, 122, 107, 0.35);
          color: var(--danger);
          font-size: 12.5px;
          padding: 9px 12px;
          border-radius: 9px;
          margin-bottom: 16px;
        }

        .ksp-submit {
          width: 100%;
          padding: 13px;
          border: none;
          border-radius: 11px;
          background: linear-gradient(135deg, var(--accent-cyan), #1a8f99);
          color: #04141a;
          font-size: 14.5px;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          letter-spacing: 0.01em;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: filter 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
          box-shadow: 0 8px 24px rgba(45, 212, 224, 0.22);
        }
        .ksp-submit:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 10px 28px rgba(45, 212, 224, 0.32); }
        .ksp-submit:disabled { opacity: 0.75; cursor: not-allowed; }
        .ksp-spin { animation: ksp-spin 0.8s linear infinite; }
        @keyframes ksp-spin { to { transform: rotate(360deg); } }

        .ksp-security-row {
          display: flex; justify-content: space-between;
          margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border-glass);
        }
        .ksp-security-item { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 1; }
        .ksp-security-item span { font-size: 9.5px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; text-align: center; }
        .ksp-security-item svg { color: var(--accent-gold); opacity: 0.85; }

        .ksp-notice {
          margin-top: 16px;
          font-size: 11px;
          line-height: 1.5;
          color: var(--text-dim);
          text-align: center;
          padding: 0 4px;
        }

        .ksp-demo-toggle {
          margin-top: 18px;
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          background: none; border: 1px dashed var(--border-glass-strong);
          border-radius: 10px; padding: 9px;
          color: var(--text-mid); font-size: 11.5px; cursor: pointer;
          transition: border-color 0.2s ease, color 0.2s ease;
        }
        .ksp-demo-toggle:hover { border-color: var(--accent-gold); color: var(--accent-gold); }

        .ksp-demo-list { display: grid; gap: 8px; margin-top: 12px; overflow: hidden; }
        .ksp-demo-card {
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(5,11,22,0.5); border: 1px solid var(--border-glass);
          border-radius: 9px; padding: 9px 12px; cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        .ksp-demo-card:hover { border-color: var(--accent-gold-soft); background: rgba(212,175,55,0.05); }
        .ksp-demo-role { font-size: 12px; font-weight: 600; color: var(--text-hi); }
        .ksp-demo-creds { font-size: 10.5px; color: var(--text-dim); margin-top: 1px; }

        .ksp-footer { margin-top: 22px; text-align: center; font-size: 10.5px; color: var(--text-dim); }

        @media (max-width: 900px) {
          .ksp-login-root { flex-direction: column; overflow-y: auto; }
          .ksp-hero { flex: none; padding: 36px 24px 28px; border-right: none; border-bottom: 1px solid var(--border-glass); }
          .ksp-map-wrap { width: 220px; }
          .ksp-hero-stats { margin-top: 24px; gap: 20px; }
          .ksp-panel { min-width: 0; padding: 28px 20px 40px; }
        }
      `}</style>

      <div className="ksp-particles">
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={i}
            className="ksp-particle"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animationDelay: `${(i % 7) * 1.3}s`,
              animationDuration: `${10 + (i % 6) * 2}s`,
            }}
          />
        ))}
      </div>

      {/* ---------------- Left hero ---------------- */}
      <div className="ksp-hero">
        <div className="ksp-hero-grid" />

        <div className="ksp-hero-badge">
          <span className="ksp-hero-badge-dot" />
          <span>Live Crime Intelligence Grid</span>
        </div>

        <div className="ksp-map-wrap">
          <svg className="ksp-map-svg" viewBox="0 0 260 480">
            <path className="ksp-map-outline" d={KARNATAKA_PATH} />
            <g className="ksp-sweep-group">
              <path
                d="M128 236 L128 60 A176 176 0 0 1 250 200 Z"
                fill="url(#sweepGradient)"
                opacity="0.5"
              />
            </g>
            <defs>
              <radialGradient id="sweepGradient" cx="30%" cy="30%" r="80%">
                <stop offset="0%" stopColor="#2dd4e0" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#2dd4e0" stopOpacity="0" />
              </radialGradient>
            </defs>
            {HOTSPOTS.map((h, i) => (
              <g key={i}>
                <circle cx={h.x} cy={h.y} r="2.5" className="ksp-hotspot" />
                <circle
                  cx={h.x}
                  cy={h.y}
                  r="3"
                  className="ksp-hotspot-ring"
                  style={{ animationDelay: `${h.delay}s` }}
                />
              </g>
            ))}
          </svg>
        </div>

        <div className="ksp-hero-tagline">
          <h2 className="ksp-heading">Intelligence-led policing, statewide.</h2>
          <p>
            Real-time crime pattern analysis, CCTV coverage mapping, and
            AI-assisted case insight — built for the officers of Karnataka.
          </p>
        </div>

        <div className="ksp-hero-stats">
          <div className="ksp-hero-stat"><b>31</b><span>Districts</span></div>
          <div className="ksp-hero-stat"><b>24×7</b><span>Monitoring</span></div>
          <div className="ksp-hero-stat"><b>AI</b><span>Assisted</span></div>
        </div>
      </div>

      {/* ---------------- Right login panel ---------------- */}
      <div className="ksp-panel">
        <div ref={cardRef} className={`ksp-card ${mounted ? 'mounted' : ''}`}>
          <div className="ksp-logo-row">
            <div className="ksp-logo-badge">
              <ShieldCheck size={28} color="#d4af37" strokeWidth={1.8} />
            </div>
            <h1 className="ksp-title ksp-heading">
              Karnataka State Police
              <small>AI Crime Intelligence Platform</small>
            </h1>
            <p className="ksp-subtitle">Secure access for authorized personnel only.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="ksp-field">
              <label htmlFor="ksp-username">Username / Email</label>
              <div className="ksp-input-wrap">
                <input
                  id="ksp-username"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. officer"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="ksp-field">
              <label htmlFor="ksp-password">Password</label>
              <div className="ksp-input-wrap has-icon">
                <input
                  id="ksp-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="ksp-eye-btn"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="ksp-row-between">
              <label className="ksp-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember me
              </label>
              <button type="button" className="ksp-forgot" onClick={() => {}}>
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="ksp-error">
                <ShieldAlert size={14} />
                {error}
              </div>
            )}

            <button type="submit" className="ksp-submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={17} className="ksp-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="ksp-security-row">
            <div className="ksp-security-item">
              <Lock size={16} />
              <span>Secure Login</span>
            </div>
            <div className="ksp-security-item">
              <ShieldCheck size={16} />
              <span>Role-Based Access</span>
            </div>
            <div className="ksp-security-item">
              <KeyRound size={16} />
              <span>Encrypted Connection</span>
            </div>
          </div>

          <p className="ksp-notice">
            Authorized personnel only. Unauthorized access is prohibited and monitored.
          </p>

          <div className="ksp-footer">
            © 2026 Karnataka State Police | AI Crime Intelligence Platform
          </div>
        </div>
      </div>
    </div>
  );
}
