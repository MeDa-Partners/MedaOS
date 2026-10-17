'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, Field } from '@/components/ui/form';

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user) router.replace('/');
  }, [isLoading, user, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err, 'Could not sign in'));
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex flex-col justify-between bg-[#09090b] text-white p-12 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-40 -right-40 w-130 h-130 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, #0ea5e9 45%, transparent 70%)' }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white text-[#09090b] flex items-center justify-center text-sm font-bold">M</div>
          <span className="text-sm font-semibold tracking-tight">MeDa OS</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight leading-[1.1]">Every MeDa venture, one place to work.</h1>
          <p className="text-sm text-white/60 mt-4 leading-relaxed">
            Your departments, teams and tools across WayVeda, Digital Chaabi, Nature Mania, My Fit Brain and more,
            with access set person by person.
          </p>
        </div>
        <p className="relative text-[11px] text-white/40">MeDa Partners Pvt Ltd · Internal use only</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center text-sm font-bold">M</div>
            <span className="text-sm font-semibold tracking-tight">MeDa OS</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#09090b]">Sign in</h2>
          <p className="text-sm text-[#71717a] mt-1.5">Use the work email your department head set up for you.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Field label="Email" htmlFor="email">
              <div className="relative">
                <Mail className="w-4 h-4 text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@meda.partners"
                  className="pl-9 h-10 text-sm"
                />
              </div>
            </Field>
            <Field label="Password" htmlFor="password">
              <div className="relative">
                <Lock className="w-4 h-4 text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 h-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#a1a1aa] hover:text-[#09090b] cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" size="lg" loading={submitting} className="w-full">
              Sign in <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-xs text-[#a1a1aa] mt-8">Forgot your password? Ask your department head or an administrator to reset it.</p>
        </div>
      </div>
    </div>
  );
}
