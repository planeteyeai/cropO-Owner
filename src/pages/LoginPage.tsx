import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../api/ownerApi';
import { useAuth } from '../auth/AuthContext';
import { BrandLogo } from '../components/BrandLogo';

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/farmers" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(phone.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-stage">
        <aside className="login-hero">
          <div className="login-hero-glow" />
          <div className="login-hero-content">
            <BrandLogo size="lg" className="brand-logo-lg" />
            <h1 className="login-hero-title">Owner Dashboard</h1>
          </div>
          <div className="login-hero-pattern" />
        </aside>

        <section className="login-panel">
          <div className="login-panel-inner">
            <div className="login-brand mobile-only">
              <BrandLogo size="md" />
              <p className="login-kicker">Owner Dashboard</p>
            </div>

            <div className="login-form-head">
              <h2>Sign in</h2>
              <p>Use your owner mobile number and password.</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <label className="field">
                <span>Mobile number</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="username"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>

              {error && (
                <div className="alert alert-error" role="alert">
                  {error}
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Enter dashboard'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
