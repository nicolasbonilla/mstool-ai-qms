import { useState } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export default function LoginPage() {
  const { loginWithEmail, loginWithGoogle, register, error, loading, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) { await register(email, password); }
    else { await loginWithEmail(email, password); }
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal/[0.06] rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/[0.04] rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-teal to-accent rounded-2xl mb-5 shadow-glow">
            <ShieldCheck size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">MSTool-AI-QMS</h1>
          <p className="text-gray-500 text-sm mt-1.5 font-medium">Regulatory Compliance Automation</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            {['IEC 62304', 'ISO 13485', 'EU MDR'].map(s => (
              <span key={s} className="text-[9px] font-semibold text-gray-600 px-2 py-0.5 rounded-full border border-gray-700/50">{s}</span>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="glass-dark rounded-3xl p-8 border border-white/[0.06] shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-6">
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl p-3 mb-5 flex items-center justify-between">
              <span className="text-xs">{error}</span>
              <button onClick={clearError} className="text-red-400 hover:text-red-200 ml-2">&times;</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-teal/50 focus:ring-1 focus:ring-teal/30 placeholder:text-gray-600 transition-all"
                placeholder="user@company.com"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-teal/50 focus:ring-1 focus:ring-teal/30 placeholder:text-gray-600 transition-all"
                placeholder="Min. 6 characters"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-teal to-teal-dark hover:from-teal-light hover:to-teal text-white font-semibold py-3 rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 shadow-glow-sm hover:shadow-glow"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> :
                <>{isRegister ? 'Create Account' : 'Sign In'} <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <button onClick={loginWithGoogle} disabled={loading}
            className="w-full bg-white/[0.04] hover:bg-white/[0.08] text-white font-medium py-3 rounded-xl border border-white/[0.08] transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-sm">Continue with Google</span>
          </button>

          <p className="text-center text-xs text-gray-500 mt-6">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}
            <button onClick={() => { setIsRegister(!isRegister); clearError(); }}
              className="text-teal hover:text-teal-light ml-1.5 font-medium transition-colors">
              {isRegister ? 'Sign In' : 'Create one'}
            </button>
          </p>
        </div>

        <p className="text-center text-[10px] text-gray-700 mt-6">
          Class C Medical Device Software &middot; AI-Powered QMS
        </p>
      </div>
    </div>
  );
}