'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StrategiesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-slate-400 font-mono">Redirecting to Dashboard Launch Station...</p>
    </div>
  );
}
