import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-6xl font-bold text-slate-50 mb-4">
            Trippy
          </h1>
          <p className="text-xl text-slate-300 mb-12">
            Plan your next adventure together with your group
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/trips/new"
              className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
            >
              Create a Trip
            </Link>
            <Link
              href="/trips/join"
              className="card-surface text-slate-50 px-8 py-4 rounded-lg font-semibold hover:bg-slate-700 transition-colors shadow-lg border-2 border-slate-600"
            >
              Join a Trip
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="card-surface p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-2 text-slate-50">📅 Plan Together</h3>
              <p className="text-slate-300">
                Collaborate on flights, accommodations, and activities with your group
              </p>
            </div>
            <div className="card-surface p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-2 text-slate-50">✈️ Find Flights</h3>
              <p className="text-slate-300">
                Get smart recommendations based on everyone's preferences
              </p>
            </div>
            <div className="card-surface p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-2 text-slate-50">🎯 Build Itinerary</h3>
              <p className="text-slate-300">
                Create a day-by-day plan that works for everyone
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}