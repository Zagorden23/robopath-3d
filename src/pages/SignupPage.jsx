import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Compass,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  User,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
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

export function SignupPage() {
  const { signup, requestEmailOtp, verifyEmailOtp, requestPhoneOtp, verifyPhoneOtp } = useAuth();
  const navigate = useNavigate();

  const [signupTab, setSignupTab] = useState('password'); // 'password' | 'email-otp' | 'phone-otp'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Email OTP signup
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpDevPreview, setEmailOtpDevPreview] = useState('');

  // Phone OTP signup
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpDevPreview, setPhoneOtpDevPreview] = useState('');

  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const getPasswordStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Za-z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '25%' };
    if (score === 2) return { label: 'Fair', color: 'bg-amber-500', width: '50%' };
    if (score === 3) return { label: 'Good', color: 'bg-cyan-500', width: '75%' };
    return { label: 'Strong', color: 'bg-emerald-500', width: '100%' };
  };

  const strength = getPasswordStrength(password);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (name.trim().length < 2) {
      setError('Please provide your full name (at least 2 characters).');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please provide a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain at least one letter and one number.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!acceptTerms) {
      setError('You must acknowledge the academic terms to create an account.');
      return;
    }

    try {
      setLoading(true);
      await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        acceptTerms,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to register account.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestEmailOtp = async (e) => {
    e?.preventDefault();
    setError('');
    setInfoMessage('');

    if (name.trim().length < 2) {
      setError('Please provide your full name (at least 2 characters).');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      const data = await requestEmailOtp({ email: email.trim(), name: name.trim() });
      setEmailOtpSent(true);
      setCooldown(30);
      setInfoMessage(data.notice || 'Verification code sent to your email.');
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
      await verifyEmailOtp({
        email: email.trim(),
        code: emailOtpCode.trim(),
        name: name.trim(),
      });
      navigate('/dashboard', { replace: true });
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

    if (name.trim().length < 2) {
      setError('Please provide your full name (at least 2 characters).');
      return;
    }

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
      setInfoMessage(data.notice || 'SMS verification code sent.');
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
      setError('Please enter the 6-digit SMS code.');
      return;
    }

    try {
      setLoading(true);
      await verifyPhoneOtp({
        countryCode,
        phoneNumber: phoneNumber.replace(/\D/g, ''),
        code: phoneOtpCode.trim(),
        name: name.trim(),
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid or expired SMS OTP.');
    } finally {
      setLoading(false);
    }
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
            Create Your Research Account
          </h2>
          <p className="text-xs text-[var(--text-muted)] font-mono">
            Save custom environments, 3D scenarios, and experiment runs
          </p>
        </div>

        {/* Registration Method Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-slate-900/90 border border-[var(--border-subtle)] text-xs">
          <button
            type="button"
            onClick={() => {
              setSignupTab('password');
              setError('');
              setInfoMessage('');
            }}
            className={`py-2 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
              signupTab === 'password'
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
              setSignupTab('email-otp');
              setError('');
              setInfoMessage('');
            }}
            className={`py-2 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
              signupTab === 'email-otp'
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
              setSignupTab('phone-otp');
              setError('');
              setInfoMessage('');
            }}
            className={`py-2 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
              signupTab === 'phone-otp'
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

        {/* Signup Card */}
        <div className="p-6 rounded-2xl glass-panel-elevated border border-[var(--border-medium)] shadow-2xl space-y-5">
          {/* 1. EMAIL & PASSWORD SIGNUP */}
          {signupTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Prof. Ada Lovelace"
                    className="w-full pl-9 font-sans"
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ada@university.edu"
                    className="w-full pl-9 font-sans"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters, letters & numbers"
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

                {password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Strength: {strength.label}</span>
                      <span>Min 8 chars, 1 letter, 1 number</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${strength.color} transition-all duration-300`}
                        style={{ width: strength.width }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full pl-9 font-sans"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-cyan-500 focus:ring-0"
                  />
                  <span className="text-[11px] leading-relaxed text-slate-400">
                    I agree to the university academic simulation terms and acknowledge that algorithm
                    calculations run deterministically.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold"
              >
                {loading ? <span>Creating Account...</span> : <span>Create Account</span>}
              </button>
            </form>
          )}

          {/* 2. EMAIL OTP SIGNUP */}
          {signupTab === 'email-otp' && (
            <div className="space-y-4 text-xs">
              {!emailOtpSent ? (
                <form onSubmit={handleRequestEmailOtp} className="space-y-4">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Prof. Ada Lovelace"
                        className="w-full pl-9 font-sans"
                      />
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ada@university.edu"
                        className="w-full pl-9 font-sans"
                      />
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold"
                  >
                    {loading ? <span>Sending Verification Code...</span> : <span>Send Email OTP</span>}
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
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      6-Digit Email Verification Code
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
                    {loading ? <span>Verifying...</span> : <span>Verify Email & Create Account</span>}
                  </button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setEmailOtpSent(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      Edit details
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

          {/* 3. PHONE OTP SIGNUP */}
          {signupTab === 'phone-otp' && (
            <div className="space-y-4 text-xs">
              {!phoneOtpSent ? (
                <form onSubmit={handleRequestPhoneOtp} className="space-y-4">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Prof. Ada Lovelace"
                        className="w-full pl-9 font-sans"
                      />
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    </div>
                  </div>

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
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold"
                  >
                    {loading ? <span>Sending SMS...</span> : <span>Send Phone Verification Code</span>}
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
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      6-Digit SMS Verification Code
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
                    {loading ? <span>Verifying...</span> : <span>Verify Phone & Create Account</span>}
                  </button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setPhoneOtpSent(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      Edit phone number
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
        </div>

        {/* Signin Redirect */}
        <p className="text-center text-xs text-[var(--text-secondary)]">
          Already have an account?{' '}
          <Link to="/signin" className="text-cyan-400 font-semibold hover:underline">
            Sign In here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;
