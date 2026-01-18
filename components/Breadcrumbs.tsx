'use client';

import { useEffect, useState } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface BreadcrumbSegment {
  label: string;
  href: string;
  isActive: boolean;
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const params = useParams();
  const [tripName, setTripName] = useState<string>('');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([]);

  // Fetch trip name if we're on a trip detail page
  useEffect(() => {
    const tripId = params?.id as string;
    if (tripId && pathname.includes('/trips/')) {
      const fetchTripName = async () => {
        try {
          const { data } = await supabase
            .from('trips')
            .select('name')
            .eq('id', tripId)
            .maybeSingle();
          if (data?.name) {
            setTripName(data.name);
          }
        } catch (error) {
          console.error('Error fetching trip name for breadcrumb:', error);
        }
      };
      fetchTripName();
    }
  }, [pathname, params]);

  // Generate breadcrumbs based on pathname
  useEffect(() => {
    const segments: BreadcrumbSegment[] = [];
    const pathParts = pathname.split('/').filter(Boolean);

    // Home page
    if (pathname === '/') {
      // No breadcrumbs on home page
      setBreadcrumbs([]);
      return;
    }

    // Discover page
    if (pathname === '/discover') {
      segments.push({
        label: 'Discover',
        href: '/discover',
        isActive: true,
      });
      setBreadcrumbs(segments);
      return;
    }

    // Profile page (not trip-specific)
    if (pathname === '/profile') {
      segments.push({
        label: 'Profile',
        href: '/profile',
        isActive: true,
      });
      setBreadcrumbs(segments);
      return;
    }

    // Auth page - no breadcrumbs
    if (pathname === '/auth') {
      setBreadcrumbs([]);
      return;
    }

    // Trip routes
    if (pathname.startsWith('/trips')) {
      segments.push({
        label: 'My Trips',
        href: '/',
        isActive: pathname === '/',
      });

      // Trip detail or sub-pages
      const tripId = params?.id as string;
      if (tripId) {
        const displayName = tripName || 'Trip';
        segments.push({
          label: displayName,
          href: `/trips/${tripId}`,
          isActive: pathname === `/trips/${tripId}`,
        });

        // Sub-pages
        if (pathname.includes('/preferences')) {
          segments.push({
            label: 'Preferences',
            href: `/trips/${tripId}/preferences`,
            isActive: true,
          });
        } else if (pathname.includes('/suggestions')) {
          segments.push({
            label: 'Suggestions',
            href: `/trips/${tripId}/suggestions`,
            isActive: true,
          });
        } else if (pathname.includes('/flights')) {
          segments.push({
            label: 'Flights',
            href: `/trips/${tripId}/flights`,
            isActive: true,
          });
        } else if (pathname.includes('/accommodation')) {
          segments.push({
            label: 'Accommodation',
            href: `/trips/${tripId}/accommodation`,
            isActive: true,
          });
        } else if (pathname.includes('/activities')) {
          segments.push({
            label: 'Activities',
            href: `/trips/${tripId}/activities`,
            isActive: true,
          });
        } else if (pathname.includes('/itinerary')) {
          segments.push({
            label: 'Itinerary',
            href: `/trips/${tripId}/itinerary`,
            isActive: true,
          });
        } else if (pathname.includes('/share')) {
          segments.push({
            label: 'Share',
            href: `/trips/${tripId}/share`,
            isActive: true,
          });
        } else if (pathname.includes('/profile')) {
          segments.push({
            label: 'Profile',
            href: `/trips/${tripId}/profile`,
            isActive: true,
          });
        }
      }
    }

    setBreadcrumbs(segments);
  }, [pathname, params, tripName]);

  // Don't show breadcrumbs on home, auth, or if empty
  if (breadcrumbs.length === 0 || pathname === '/' || pathname === '/auth') {
    return null;
  }

  // Mobile: Show simplified breadcrumb (only parent link)
  const parentSegment = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;

  return (
    <div className="container mx-auto px-4 md:px-8 max-w-7xl">
      <div className="mb-6">
        {/* Desktop: Full breadcrumb trail */}
        <div className="hidden md:flex items-center gap-2 text-sm font-medium">
          {breadcrumbs.map((segment, index) => (
            <div key={segment.href} className="flex items-center gap-2">
              {index > 0 && <span className="text-slate-600 dark:text-slate-500">/</span>}
              {segment.isActive ? (
                <span className="text-slate-100 dark:text-slate-100">{segment.label}</span>
              ) : (
                <Link
                  href={segment.href}
                  className="text-slate-400 dark:text-slate-400 hover:text-white dark:hover:text-white transition-colors"
                >
                  {segment.label}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Mobile: Single back link */}
        {parentSegment && (
          <Link
            href={parentSegment.href}
            className="md:hidden text-slate-400 dark:text-slate-400 hover:text-white dark:hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            ← {parentSegment.label}
          </Link>
        )}
      </div>
    </div>
  );
}
