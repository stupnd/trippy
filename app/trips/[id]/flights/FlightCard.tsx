'use client';

import { FlightOption } from '@/types';
import {
  formatFlightDate,
  formatFlightDuration,
  formatFlightTime,
  formatLayovers,
} from '@/lib/flights';

interface FlightCardProps {
  option: FlightOption;
  travelers: number;
  isSelected: boolean;
  onSelect?: () => void;
  showSelect?: boolean;
}

export default function FlightCard({
  option,
  travelers,
  isSelected,
  onSelect,
  showSelect = true,
}: FlightCardProps) {
  const roundTripPrice = option.roundTripPrice ?? option.price;
  const perTravelerPrice = option.price;
  const totalLabel =
    travelers > 1 ? `Total for ${travelers}` : 'Total';
  const outboundDate = formatFlightDate(option.departure.time);
  const returnDate = formatFlightDate(option.returnSegment?.departure.time);

  return (
    <div
      className={`card-surface rounded-lg p-6 border-2 ${
        isSelected ? 'border-green-500' : 'border-slate-700'
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap gap-2 mb-2">
            {option.isCheapest && (
              <span className="bg-green-900 text-green-100 px-3 py-1 rounded-full text-xs font-semibold border border-green-700">
                Cheapest
              </span>
            )}
            {option.isFastest && (
              <span className="bg-blue-900 text-blue-100 px-3 py-1 rounded-full text-xs font-semibold border border-blue-700">
                Fastest
              </span>
            )}
            {option.isBestValue && (
              <span className="bg-blue-800 text-blue-50 px-3 py-1 rounded-full text-xs font-semibold border border-blue-500">
                Best Value
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-slate-50">
            ${roundTripPrice.toLocaleString()}
          </div>
          <div className="text-sm text-slate-300">{totalLabel}</div>
          <div className="text-xs text-slate-400 mt-1">
            Per traveler: ${perTravelerPrice.toLocaleString()}
          </div>
          <div className="text-slate-300 mt-2">{option.airline.join(', ')}</div>
          <div className="text-xs text-slate-400 mt-1">
            Round trip: {outboundDate} → {returnDate}
          </div>
        </div>
        <div className="text-left md:text-right">
          <div className="text-sm text-slate-400">Score</div>
          <div className="text-xl font-semibold text-slate-50">
            {option.score}/100
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700 text-sm">
        <div>
          <div className="text-slate-400">Departure</div>
          <div className="font-semibold text-slate-50">
            {formatFlightTime(option.departure.time)}
          </div>
          <div className="text-slate-300">
            {option.departure.city ? `${option.departure.city} • ` : ''}
            {option.departure.airport}
          </div>
        </div>
        <div>
          <div className="text-slate-400">Arrival</div>
          <div className="font-semibold text-slate-50">
            {formatFlightTime(option.arrival.time)}
          </div>
          <div className="text-slate-300">
            {option.arrival.city ? `${option.arrival.city} • ` : ''}
            {option.arrival.airport}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700 flex flex-col gap-2 text-sm text-slate-300 md:flex-row md:items-center md:justify-between">
        <div>
          Duration: {formatFlightDuration(option.duration)} •{' '}
          {formatLayovers(option.layovers)}
        </div>
        {showSelect && (
          <button
            onClick={onSelect}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {isSelected ? 'Selected' : 'Select'}
          </button>
        )}
      </div>
    </div>
  );
}
