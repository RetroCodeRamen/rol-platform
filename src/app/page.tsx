'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import LoginScreen from '@/components/LoginScreen';

export default function Home() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  
  return <LoginScreen initialError={error} />;
}
