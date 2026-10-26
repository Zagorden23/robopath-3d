import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Compass,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  KeyRound,
  Play,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+1', label: 'US / CA (+1)', country: 'US' },
  { code: '+91', label: 'India (+91)', country: 'IN' },
  { code: '+44', label: 'UK (+44)', country: 'GB' },
  { code: '+61', label: 'Australia (+61)', country: 'AU' },
  { code: '+49', label: 'Germany (+49)', country: 'DE' },
  { code: '+33', label: 'France (+33)', country: 'FR' },
  { code: '+81', label: 'Japan (+81)', country: 'JP' },
  { code: '+65', label: 'Singapore (+65)', country: 'SG' },
];

export function SigninPage() {
  const {
    signin,
    requestEmailOtp,
    verifyEmailOtp,
    requestPhoneOtp,
    verifyPhoneOtp,
    forgotPassword,
    resetPassword,
    enterGuestMode,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [authTab, setAuthTab] = useState('password'); // 'password' | 'email-otp' | 'phone-otp' | 'forgot-password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Email OTP state
  const [otpEmail, setOtpEmail] = useState('');
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpDevPreview, setEmailOtpDevPreview] = useState('');

  // Phone OTP state
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpDevPreview, setPhoneOtpDevPreview] = useState('');

  // Forgot / Reset password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState('request'); // 'request' | 'confirm'
  const [resetDevToken, setResetDevToken] = useState('');

  // Countdown timer for OTP resend
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!email || !password) {
      setError('Please provide your email address and password.');
      return;
    }

    try {
      setLoading(true);
      await signin(email, password, rememberMe);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestEmailOtp = async (e) => {
    e?.preventDefault();
    setError('');
    setInfoMessage('');

    if (!otpEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      const data = await requestEmailOtp({ email: otpEmail.trim() });
      setEmailOtpSent(true);
      setCooldown(30);
      setInfoMessage(data.notice || 'A 6-digit verification code has been sent to your email.');
      if (data.devCode) {
        setEmailOtpDevPreview(data.devCode);
      }
    } catch (err) {
      setError(err.message || 'Failed to send Email OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!emailOtpCode || emailOtpCode.trim().length < 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    try {
      setLoading(true);
      await verifyEmailOtp({ email: otpEmail.trim(), code: emailOtpCode.trim() });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPhoneOtp = async (e) => {
    e?.preventDefault();
    setError('');
    setInfoMessage('');

    const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;
    if (phoneNumber.replace(/\D/g, '').length < 7) {
      setError('Please enter a valid phone number.');
      return;
    }

    const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode)?.country || 'US';

    try {
      setLoading(true);
      const data = await requestPhoneOtp({ countryCode, phoneNumber: phoneNumber.replace(/\D/g, ''), name: typeof name === 'string' ? name.trim() : undefined });
      setPhoneOtpSent(true);
      setCooldown(30);
      setInfoMessage(data.notice || 'A 6-digit SMS verification code has been sent.');
      if (data.devCode) {
        setPhoneOtpDevPreview(data.devCode);
      }
    } catch (err) {
      setError(err.message || 'Failed to send SMS OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e) => {
    e.preventDefault();
    setError('');
    const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;
    const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode)?.country || 'US';

    if (!phoneOtpCode || phoneOtpCode.trim().length < 6) {
      setError('Please enter the 6-digit SMS verification code.');
      return;
    }

    try {
      setLoading(true);
      await verifyPhoneOtp({
        countryCode,
        phoneNumber: phoneNumber.replace(/\D/g, ''),
        code: phoneOtpCode.trim(),
      });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid or expired SMS OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordRequest = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!resetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setError('Please enter your registered email address.');
      return;
    }

    try {
      setLoading(true);
      const data = await forgotPassword(resetEmail.trim());
      setResetStep('confirm');
      setInfoMessage(data.notice || data.message || 'Password reset code generated.');
      if (data.devCode) {
        setResetDevToken(data.devCode);
        setResetToken(data.devCode);
      }
    } catch (err) {
      setError(err.message || 'Could not initiate password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordConfirm = async (e) => {
    e.preventDefault();
    setError('');

    if (!resetToken || newPassword.length < 8) {
      setError('Please provide the reset token and a new password (min 8 chars).');
      return;
    }

    try {
      setLoading(true);
      const data = await resetPassword({
        email: resetEmail.trim(),
        code: resetToken.trim(),
        newPassword,
      });
      setInfoMessage(data.message || 'Password updated! You can now sign in.');
      setAuthTab('password');
      setEmail(resetEmail.trim());
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestDemo = () => {
    enterGuestMode();
    navigate('/simulator?demo=demo-a-dijkstra-vs-astar');
  };

  return (
    <div className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Compass className="w-6 h-6 text-white" />
            </div>
            <span className="font-heading font-bold text-2xl text-white">
              Robo<span className="text-[var(--accent-cyan)]">Path 3D</span>
            </span>
          </Link>
          <h2 className="text-xl font-heading font-bold text-white tracking-tight">
            Sign In to RoboPath 3D
          </h2>
          <p className="text-xs text-[var(--text-muted)] font-mono">
            Authenticate via Email & Password, Email OTP, or Phone SMS OTP
          </p>
        </div>

        {/* Auth Method Selector Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-slate-900/90 border border-[var(--border-subtle)] text-xs">
          <button
            type="button"
            onClick={() => {
              setAuthTab('password');
              setError('');
              setInfoMessage('');
            }}
            className={`py-2 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
              authTab === 'password' || authTab === 'forgot-password'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Password</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthTab('email-otp');
              setError('');
              setInfoMessage('');
            }}
            className={`py-2 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
              authTab === 'email-otp'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email OTP</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthTab('phone-otp');
              setError('');
              setInfoMessage('');
            }}
            className={`py-2 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
              authTab === 'phone-otp'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Phone OTP</span>
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Info notification */}
        {infoMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Sign In Card */}
        <div className="p-6 rounded-2xl glass-panel-elevated border border-[var(--border-medium)] shadow-2xl space-y-5">
          {/* 1. EMAIL & PASSWORD TAB */}
          {authTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="researcher@university.edu"
                    className="w-full pl-9 font-sans"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-medium">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('forgot-password');
                      setResetEmail(email);
                      setError('');
                    }}
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 font-sans"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-cyan-500 focus:ring-0"
                  />
                  <span>Remember this session (30 days)</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold"
              >
                {loading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In with Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 2. EMAIL OTP TAB */}
          {authTab === 'email-otp' && (
            <div className="space-y-4 text-xs">
              {!emailOtpSent ? (
                <form onSubmit={handleRequestEmailOtp} className="space-y-4">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Registered or New Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        placeholder="researcher@university.edu"
                        className="w-full pl-9 font-sans"
                      />
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      We will generate a cryptographically secure 6-digit one-time code valid for 10 minutes.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold"
                  >
                    {loading ? <span>Sending Code...</span> : <span>Send Email OTP</span>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyEmailOtp} className="space-y-4">
                  {emailOtpDevPreview && (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 space-y-1">
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span>DEV SANDBOX OTP PREVIEW:</span>
                        <span className="font-bold text-sm text-amber-300 tracking-widest">
                          {emailOtpDevPreview}
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-300/80">
                        SMTP is not configured in .env; displaying OTP for local testing.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Enter 6-Digit Verification Code
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={emailOtpCode}
                        onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full pl-9 font-mono tracking-widest text-sm"
                      />
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold"
                  >
                    {loading ? <span>Verifying...</span> : <span>Verify & Sign In</span>}
                  </button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailOtpSent(false);
                        setEmailOtpCode('');
                        setEmailOtpDevPreview('');
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      disabled={cooldown > 0 || loading}
                      onClick={handleRequestEmailOtp}
                      className="inline-flex items-center gap-1 text-cyan-400 disabled:text-slate-600"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 3. PHONE OTP TAB */}
          {authTab === 'phone-otp' && (
            <div className="space-y-4 text-xs">
              {!phoneOtpSent ? (
                <form onSubmit={handleRequestPhoneOtp} className="space-y-4">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Country Code & Phone Number
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="w-36 text-xs font-sans"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <div className="relative flex-1">
                        <input
                          type="tel"
                          required
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="555 234 5678"
                          className="w-full pl-9 font-mono"
                        />
                        <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Receives a 6-digit SMS verification code via Twilio Verify / SMS gateway.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold"
                  >
                    {loading ? <span>Sending SMS...</span> : <span>Send SMS OTP</span>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
                  {phoneOtpDevPreview && (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 space-y-1">
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span>DEV SANDBOX SMS OTP:</span>
                        <span className="font-bold text-sm text-amber-300 tracking-widest">
                          {phoneOtpDevPreview}
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-300/80">
                        Twilio is not configured in .env; displaying SMS code for local testing.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Enter 6-Digit SMS Code
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={phoneOtpCode}
                        onChange={(e) => setPhoneOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="654321"
                        className="w-full pl-9 font-mono tracking-widest text-sm"
                      />
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold"
                  >
                    {loading ? <span>Verifying SMS...</span> : <span>Verify Phone & Sign In</span>}
                  </button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneOtpSent(false);
                        setPhoneOtpCode('');
                        setPhoneOtpDevPreview('');
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      Change phone number
                    </button>
                    <button
                      type="button"
                      disabled={cooldown > 0 || loading}
                      onClick={handleRequestPhoneOtp}
                      className="inline-flex items-center gap-1 text-cyan-400 disabled:text-slate-600"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend SMS'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 4. FORGOT PASSWORD FLOW */}
          {authTab === 'forgot-password' && (
            <div className="space-y-4 text-xs">
              {resetStep === 'request' ? (
                <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Account Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="researcher@university.edu"
                      className="w-full font-sans"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold"
                  >
                    {loading ? <span>Sending Reset Token...</span> : <span>Send Password Reset Token</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthTab('password')}
                    className="w-full text-center text-slate-400 hover:text-white"
                  >
                    Back to Password Sign In
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPasswordConfirm} className="space-y-4">
                  {resetDevToken && (
                    <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 font-mono text-[11px]">
                      Dev Reset Token: <span className="font-bold">{resetDevToken}</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Reset Token</label>
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Enter reset token"
                      className="w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 chars, letters & numbers"
                      className="w-full font-sans"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold"
                  >
                    {loading ? <span>Updating Password...</span> : <span>Reset Password</span>}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="w-full border-t border-[var(--border-subtle)]" />
            <span className="bg-[var(--bg-surface)] px-3 text-[11px] text-[var(--text-muted)] font-mono uppercase absolute">
              Or
            </span>
          </div>

          {/* Guest Demo CTA */}
          <button
            type="button"
            onClick={handleGuestDemo}
            className="btn btn-secondary w-full justify-center text-xs text-[var(--accent-cyan)] border-cyan-500/30 hover:border-cyan-400"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch Instant Guest Simulator (No Account Required)</span>
          </button>
        </div>

        {/* Signup Redirect */}
        <p className="text-center text-xs text-[var(--text-secondary)]">
          Don't have an account yet?{' '}
          <Link to="/signup" className="text-cyan-400 font-semibold hover:underline">
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default SigninPage;
