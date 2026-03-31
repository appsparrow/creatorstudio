import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Sparkles, Mail, Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);

    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <img src="/logo.png" alt="Creator Studio" className="w-10 h-10" />
            <h1 className="text-3xl font-bold text-white tracking-tight">Creator Studio</h1>
          </div>
          <p className="text-gray-400">AI-powered content creation platform</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900/80 border border-gray-800 rounded-2xl p-8 space-y-5">
          <h2 className="text-xl font-semibold text-white">
            {isSignUp ? 'Create account' : 'Sign in'}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm text-gray-400">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-500"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-gray-400">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-500"
                placeholder="Enter password"
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white hover:bg-gray-100 disabled:bg-gray-300 text-gray-900 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSignUp ? 'Create account' : 'Sign in'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-sm text-rose-400 hover:text-rose-300 transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
