import { useState } from 'react';

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

// Public-domain national symbol (24-spoke Ashoka Chakra) -- not a copyrighted
// logo, used the way most Indian government portals use it: as a formal
// watermark motif, not a literal reproduction of the State seal.
function AshokaChakra({ size = 40, color = '#0B2F6B' }) {
  const spokes = Array.from({ length: 24 });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="50" cy="50" r="5" fill={color} />
      {spokes.map((_, i) => {
        const angle = (i * 360) / 24;
        const rad = (angle * Math.PI) / 180;
        const x2 = 50 + 44 * Math.sin(rad);
        const y2 = 50 - 44 * Math.cos(rad);
        return <line key={i} x1="50" y1="50" x2={x2} y2={y2} stroke={color} strokeWidth="1.2" />;
      })}
    </svg>
  );
}

function ShieldIcon({ size = 22, color = '#0B2F6B' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2 L21 5.5 V11 C21 16.5 17.4 21 12 22.5 C6.6 21 3 16.5 3 11 V5.5 Z"
        fill={color}
      />
      <path d="M9 12 L11 14 L15.5 9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export default function LoginPage({ onAuthenticated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    <div className="gov-login-root">
      <style>{`
        .gov-login-root {
          min-height: 100vh;
          background: #0B2F6B;
          font-family: 'Segoe UI', 'Noto Sans', Arial, sans-serif;
          display: flex;
          flex-direction: column;
        }
        .gov-tricolor-strip {
          height: 5px;
          width: 100%;
          background: linear-gradient(to right, #FF9933 33.33%, #FFFFFF 33.33%, #FFFFFF 66.66%, #138808 66.66%);
          flex-shrink: 0;
        }

        .gov-split {
          flex: 1;
          display: flex;
          min-height: 0;
        }

        .gov-hero {
          flex: 1.15;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 44px 48px;
          overflow: hidden;
          color: #fff;
          min-width: 0;
        }
        .gov-hero-bg {
          position: absolute;
          inset: 0;
          background-image: url('/vidhana-soudha-morning.jpg');
          background-size: cover;
          background-position: center 40%;
          z-index: 0;
        }
        .gov-hero-scrim {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(6, 22, 56, 0.88) 0%, rgba(8, 30, 74, 0.72) 38%, rgba(11, 47, 107, 0.94) 100%);
          z-index: 1;
        }
        .gov-hero-chakra-watermark {
          position: absolute;
          right: -60px;
          bottom: -60px;
          opacity: 0.08;
          z-index: 1;
          pointer-events: none;
        }
        .gov-hero-content {
          position: relative;
          z-index: 2;
        }
        .gov-hero-top {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .gov-hero-top img {
          width: 52px;
          height: 52px;
          border-radius: 8px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.35);
          background: #fff;
          padding: 3px;
        }
        .gov-hero-eyebrow {
          font-size: 11.5px;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #D4A017;
          font-weight: 700;
          margin: 0 0 2px;
        }
        .gov-hero-top h1 {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }
        .gov-hero-kannada {
          font-size: 12.5px;
          color: #C9D6EC;
          margin-top: 2px;
        }
        .gov-hero-mid {
          position: relative;
          z-index: 2;
          margin-top: 40px;
        }
        .gov-hero-mid h2 {
          font-size: 34px;
          line-height: 1.22;
          font-weight: 700;
          margin: 0 0 14px;
          max-width: 460px;
          letter-spacing: 0.1px;
        }
        .gov-hero-mid p {
          font-size: 14.5px;
          line-height: 1.6;
          color: #D6E0F2;
          max-width: 420px;
          margin: 0;
        }
        .gov-hero-stats {
          display: flex;
          gap: 32px;
          margin-top: 32px;
        }
        .gov-hero-stat-value {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
        }
        .gov-hero-stat-label {
          font-size: 11.5px;
          color: #9FB2D4;
          margin-top: 2px;
          letter-spacing: 0.3px;
        }
        .gov-hero-bottom {
          position: relative;
          z-index: 2;
          font-size: 11.5px;
          color: #9FB2D4;
          border-top: 1px solid rgba(255,255,255,0.15);
          padding-top: 16px;
          line-height: 1.6;
        }

        .gov-panel {
          flex: 1;
          background: #F4F6F9;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 40px;
          min-width: 380px;
        }
        .gov-card {
          background: #fff;
          border: 1px solid #D7DCE3;
          border-radius: 6px;
          box-shadow: 0 8px 28px rgba(11, 47, 107, 0.10);
          width: 100%;
          max-width: 380px;
          overflow: hidden;
        }
        .gov-card-top {
          background: #F4F6F9;
          border-bottom: 1px solid #D7DCE3;
          padding: 26px 30px 20px;
          text-align: center;
        }
        .gov-card-top h2 {
          margin: 12px 0 3px;
          font-size: 17px;
          color: #0B2F6B;
          font-weight: 700;
        }
        .gov-card-top p {
          margin: 0;
          font-size: 12px;
          color: #5A6472;
        }
        .gov-card-body {
          padding: 26px 30px 30px;
        }
        .gov-field {
          margin-bottom: 16px;
        }
        .gov-field label {
          display: block;
          font-size: 12.5px;
          font-weight: 600;
          color: #2A3140;
          margin-bottom: 6px;
        }
        .gov-input-wrap {
          position: relative;
        }
        .gov-field input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1px solid #C6CCD6;
          border-radius: 4px;
          font-size: 14px;
          color: #1A1F2B;
          background: #fff;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .gov-field input:focus {
          outline: none;
          border-color: #0B2F6B;
          box-shadow: 0 0 0 3px rgba(11,47,107,0.12);
        }
        .gov-show-pass {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #5A6472;
          font-size: 11.5px;
          cursor: pointer;
          font-weight: 600;
        }
        .gov-show-pass:focus-visible,
        .gov-field input:focus-visible,
        .gov-submit:focus-visible {
          outline: 2px solid #0B2F6B;
          outline-offset: 2px;
        }
        .gov-error {
          background: #FDECEC;
          border: 1px solid #F2B8B8;
          color: #A02A2A;
          font-size: 12.5px;
          padding: 9px 12px;
          border-radius: 4px;
          margin-bottom: 14px;
        }
        .gov-submit {
          width: 100%;
          padding: 11px;
          background: #0B2F6B;
          color: #fff;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.3px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .gov-submit:hover:not(:disabled) {
          background: #0E3A85;
        }
        .gov-submit:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .gov-notice {
          margin-top: 16px;
          font-size: 11px;
          color: #7A8290;
          text-align: center;
          line-height: 1.5;
          border-top: 1px solid #EDEFF2;
          padding-top: 14px;
        }
        .gov-footer {
          text-align: center;
          font-size: 11.5px;
          color: #C9D6EC;
          padding: 14px;
          flex-shrink: 0;
          background: #0B2F6B;
        }

        @media (prefers-reduced-motion: no-preference) {
          .gov-card { animation: gov-card-in 0.4s ease-out; }
          @keyframes gov-card-in {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        }

        @media (max-width: 860px) {
          .gov-split { flex-direction: column; }
          .gov-hero { padding: 32px 24px; min-height: 280px; }
          .gov-hero-mid h2 { font-size: 26px; }
          .gov-hero-stats { display: none; }
          .gov-panel { min-width: 0; padding: 28px 20px; }
        }
      `}</style>

      <div className="gov-tricolor-strip" />

      <div className="gov-split">
        <div className="gov-hero">
          <div className="gov-hero-bg" />
          <div className="gov-hero-scrim" />
          <div className="gov-hero-chakra-watermark">
            <AshokaChakra size={280} color="#ffffff" />
          </div>

          <div className="gov-hero-content gov-hero-top">
            <img src="/apple-touch-icon.png" alt="Karnataka State Police" />
            <div>
              <p className="gov-hero-eyebrow">Government of Karnataka</p>
              <h1>Karnataka State Police</h1>
              <div className="gov-hero-kannada">ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್ | ಅಪರಾಧ ದಾಖಲೆಗಳ ವಿಭಾಗ</div>
            </div>
          </div>

          <div className="gov-hero-mid">
            <h2>AI Crime Intelligence Platform</h2>
            <p>
              A unified system for the Karnataka State Crime Records Bureau to track FIRs,
              map crime hotspots, coordinate patrol deployment, and support investigations
              across all districts.
            </p>
            <div className="gov-hero-stats">
              <div>
                <div className="gov-hero-stat-value">31</div>
                <div className="gov-hero-stat-label">Districts Covered</div>
              </div>
              <div>
                <div className="gov-hero-stat-value">24×7</div>
                <div className="gov-hero-stat-label">Monitoring</div>
              </div>
              <div>
                <div className="gov-hero-stat-value">Real-time</div>
                <div className="gov-hero-stat-label">Case Intelligence</div>
              </div>
            </div>
          </div>

          <div className="gov-hero-bottom">
            Vidhana Soudha, Bengaluru — Seat of the Government of Karnataka
          </div>
        </div>

        <div className="gov-panel">
          <div className="gov-card">
            <div className="gov-card-top">
              <ShieldIcon size={30} />
              <h2>Secure Sign In</h2>
              <p>Authorised personnel only</p>
            </div>

            <div className="gov-card-body">
              {error && <div className="gov-error" role="alert">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="gov-field">
                  <label htmlFor="gov-username">Username / Officer ID</label>
                  <input
                    id="gov-username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                  />
                </div>

                <div className="gov-field">
                  <label htmlFor="gov-password">Password</label>
                  <div className="gov-input-wrap">
                    <input
                      id="gov-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="gov-show-pass"
                      onClick={() => setShowPassword(s => !s)}
                      tabIndex={-1}
                    >
                      {showPassword ? 'HIDE' : 'SHOW'}
                    </button>
                  </div>
                </div>

                <button type="submit" className="gov-submit" disabled={loading}>
                  {loading ? 'Verifying...' : 'Sign In'}
                </button>
              </form>

              <div className="gov-notice">
                This is a Government of Karnataka system. Unauthorised access or use is prohibited
                and liable to prosecution under applicable law. All activity may be monitored and logged.
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="gov-footer">
        © Government of Karnataka | Karnataka State Police | Department of Home Affairs
      </footer>
    </div>
  );
}