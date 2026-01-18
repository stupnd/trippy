import { Suspense } from 'react';
import NewTripClient from './NewTripClient';

export default function NewTripPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-700 dark:text-slate-300">Loading...</div>
      </div>
    }>
      <NewTripClient />
    </Suspense>
  );
}
