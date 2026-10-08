'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ApiError } from '@/lib/api';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Building2,
  Sparkles,
} from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to authenticate. Ensure the backend server is running.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillAdmin = () => {
    setEmail('admin@meda.com');
    setPassword('Admin@MeDa2026!');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between p-6 sm:p-10 font-sans">
      {/* Top Header */}
      <header className="flex items-center justify-between max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs">
            M
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#09090b]">
            MeDa Partners OS
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#71717a]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Express Backend Ready</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-white border border-[#e4e4e7] rounded-2xl p-8 sm:p-10 shadow-xs">
          {/* Card Header */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold tracking-tight text-[#09090b]">
              Sign in to MeDa OS
            </h2>
            <p className="text-xs text-[#71717a] mt-1.5 leading-relaxed">
              Internal multi-venture operating system. Enter your employee credentials to access your workspace.
            </p>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="mb-6 p-3.5 bg-red-50/80 border border-red-200/80 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-[#18181b] mb-1.5"
              >
                Work Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@meda.com"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-[#e4e4e7] rounded-xl text-[#09090b] placeholder:text-[#a1a1aa] focus:outline-none focus:ring-1 focus:ring-[#09090b] focus:border-[#09090b] transition-all"
                />
                <Mail className="w-4 h-4 text-[#a1a1aa] absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[#18181b] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-[#e4e4e7] rounded-xl text-[#09090b] placeholder:text-[#a1a1aa] focus:outline-none focus:ring-1 focus:ring-[#09090b] focus:border-[#09090b] transition-all"
                />
                <Lock className="w-4 h-4 text-[#a1a1aa] absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 px-4 py-2.5 bg-[#09090b] hover:bg-black text-white text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <span>{submitting ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Demo Credentials Autofill */}
          <div className="mt-6 pt-6 border-t border-[#f0f0f2]">
            <button
              type="button"
              onClick={handleFillAdmin}
              className="w-full py-2 px-3 text-xs text-[#52525b] hover:text-[#09090b] bg-[#fafafa] hover:bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg transition-all flex items-center justify-between group"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Quick Fill Admin Credentials</span>
              </span>
              <span className="font-mono text-[10px] text-[#a1a1aa] group-hover:text-[#52525b]">
                admin@meda.com
              </span>
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-[11px] text-[#a1a1aa] text-center mt-6">
          Server-side session authenticated · Multi-venture access controlled
        </p>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-[#a1a1aa] pt-6 border-t border-[#f0f0f2] gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" /> MeDa Partners Ventures
          </span>
          <span>Wayveda</span>
          <span>Nature Mania</span>
          <span>My Fit Brain</span>
        </div>
        <span>MeDa OS v1.0 · Internal Company Software</span>
      </footer>
    </div>
  );
}
