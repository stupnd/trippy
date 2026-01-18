import { Suspense } from 'react';
import JoinTripClient from './JoinTripClient';

export default function JoinTripPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-200">Loading...</div>
      </div>
    }>
      <JoinTripClient />
    </Suspense>
  );
}
