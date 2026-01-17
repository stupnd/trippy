'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

interface FlightMapPathProps {
  origin: { airport: string; lat?: number; lng?: number };
  destination: { airport: string; lat?: number; lng?: number };
  isHovered: boolean;
}

// Airport coordinate mapping (simplified - you'd use a real geocoding API)
const airportCoords: Record<string, { lat: number; lng: number }> = {
  'JFK': { lat: 40.6413, lng: -73.7781 },
  'LAX': { lat: 33.9425, lng: -118.4081 },
  'LHR': { lat: 51.4700, lng: -0.4543 },
  'CDG': { lat: 49.0097, lng: 2.5479 },
  'NRT': { lat: 35.7647, lng: 140.3863 },
  'DXB': { lat: 25.2532, lng: 55.3657 },
  'SFO': { lat: 37.6213, lng: -122.3790 },
  'ORD': { lat: 41.9742, lng: -87.9073 },
  'MIA': { lat: 25.7617, lng: -80.1918 },
  'SEA': { lat: 47.4502, lng: -122.3088 },
  // Add more as needed - for MVP, we'll use defaults
};

// Convert lat/lng to SVG viewport coordinates (Mercator projection simplified)
const latLngToXY = (lat: number, lng: number, width: number = 1200, height: number = 600) => {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
};

export default function FlightMapPath({ origin, destination, isHovered }: FlightMapPathProps) {
  const [pathData, setPathData] = useState('');
  const [pathLength, setPathLength] = useState(0);

  const pathProgress = useMotionValue(0);
  const animatedProgress = useSpring(pathProgress, { damping: 20, stiffness: 100 });

  useEffect(() => {
    // Get coordinates for origin and destination
    const originCoords = airportCoords[origin.airport] || airportCoords['JFK'];
    const destCoords = airportCoords[destination.airport] || airportCoords['LHR'];

    const start = latLngToXY(originCoords.lat, originCoords.lng);
    const end = latLngToXY(destCoords.lat, destCoords.lng);

    // Create a curved path (arc over the map)
    const midX = (start.x + end.x) / 2;
    const midY = Math.min(start.y, end.y) - 100; // Arc height

    // Quadratic Bezier curve for smooth arc
    const path = `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
    setPathData(path);

    // Calculate approximate path length for animation
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    setPathLength(distance);

    // Animate path drawing
    if (isHovered) {
      pathProgress.set(1);
    } else {
      pathProgress.set(0);
    }
  }, [origin.airport, destination.airport, isHovered, pathProgress]);

  if (!isHovered) return null;

  return (
    <svg
      className="fixed inset-0 -z-19 pointer-events-none"
      width="1200"
      height="600"
      viewBox="0 0 1200 600"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Animated path */}
      <motion.path
        d={pathData}
        fill="none"
        stroke="url(#pathGradient)"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#glow)"
        style={{
          pathLength: animatedProgress,
          opacity: animatedProgress,
        }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: isHovered ? 1 : 0, opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 1, ease: 'easeInOut' }}
      />

      {/* Origin point */}
      <motion.circle
        cx={airportCoords[origin.airport]?.lng ? latLngToXY(airportCoords[origin.airport].lat, airportCoords[origin.airport].lng).x : 0}
        cy={airportCoords[origin.airport]?.lng ? latLngToXY(airportCoords[origin.airport].lat, airportCoords[origin.airport].lng).y : 0}
        r="6"
        fill="#3b82f6"
        filter="url(#glow)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: isHovered ? 1 : 0, opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      />

      {/* Destination point */}
      <motion.circle
        cx={airportCoords[destination.airport]?.lng ? latLngToXY(airportCoords[destination.airport].lat, airportCoords[destination.airport].lng).x : 0}
        cy={airportCoords[destination.airport]?.lng ? latLngToXY(airportCoords[destination.airport].lat, airportCoords[destination.airport].lng).y : 0}
        r="6"
        fill="#8b5cf6"
        filter="url(#glow)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: isHovered ? 1 : 0, opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      />
    </svg>
  );
}
