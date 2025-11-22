'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LoginScreen from '@/components/LoginScreen';

function LoginScreenWithError() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  
  return <LoginScreen initialError={error} />;
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginScreenWithError />
    </Suspense>
  );
}
