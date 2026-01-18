// City to IATA code mapping for autocomplete
export interface CityOption {
  city: string;
  country: string;
  iata: string;
  display: string; // "City, Country"
}

export const cityIataMap: CityOption[] = [
  // North America
  { city: 'Ottawa', country: 'Canada', iata: 'YOW', display: 'Ottawa, Canada' },
  { city: 'Toronto', country: 'Canada', iata: 'YYZ', display: 'Toronto, Canada' },
  { city: 'Vancouver', country: 'Canada', iata: 'YVR', display: 'Vancouver, Canada' },
  { city: 'Montreal', country: 'Canada', iata: 'YUL', display: 'Montreal, Canada' },
  { city: 'Calgary', country: 'Canada', iata: 'YYC', display: 'Calgary, Canada' },
  { city: 'New York', country: 'United States', iata: 'JFK', display: 'New York, United States' },
  { city: 'Los Angeles', country: 'United States', iata: 'LAX', display: 'Los Angeles, United States' },
  { city: 'Chicago', country: 'United States', iata: 'ORD', display: 'Chicago, United States' },
  { city: 'Miami', country: 'United States', iata: 'MIA', display: 'Miami, United States' },
  { city: 'San Francisco', country: 'United States', iata: 'SFO', display: 'San Francisco, United States' },
  { city: 'Seattle', country: 'United States', iata: 'SEA', display: 'Seattle, United States' },
  { city: 'Boston', country: 'United States', iata: 'BOS', display: 'Boston, United States' },
  { city: 'Washington', country: 'United States', iata: 'DCA', display: 'Washington, United States' },
  { city: 'Las Vegas', country: 'United States', iata: 'LAS', display: 'Las Vegas, United States' },
  { city: 'Mexico City', country: 'Mexico', iata: 'MEX', display: 'Mexico City, Mexico' },
  
  // Europe
  { city: 'London', country: 'United Kingdom', iata: 'LHR', display: 'London, United Kingdom' },
  { city: 'Paris', country: 'France', iata: 'CDG', display: 'Paris, France' },
  { city: 'Amsterdam', country: 'Netherlands', iata: 'AMS', display: 'Amsterdam, Netherlands' },
  { city: 'Frankfurt', country: 'Germany', iata: 'FRA', display: 'Frankfurt, Germany' },
  { city: 'Rome', country: 'Italy', iata: 'FCO', display: 'Rome, Italy' },
  { city: 'Madrid', country: 'Spain', iata: 'MAD', display: 'Madrid, Spain' },
  { city: 'Barcelona', country: 'Spain', iata: 'BCN', display: 'Barcelona, Spain' },
  { city: 'Lisbon', country: 'Portugal', iata: 'LIS', display: 'Lisbon, Portugal' },
  { city: 'Dublin', country: 'Ireland', iata: 'DUB', display: 'Dublin, Ireland' },
  { city: 'Berlin', country: 'Germany', iata: 'BER', display: 'Berlin, Germany' },
  { city: 'Vienna', country: 'Austria', iata: 'VIE', display: 'Vienna, Austria' },
  { city: 'Zurich', country: 'Switzerland', iata: 'ZRH', display: 'Zurich, Switzerland' },
  { city: 'Stockholm', country: 'Sweden', iata: 'ARN', display: 'Stockholm, Sweden' },
  { city: 'Copenhagen', country: 'Denmark', iata: 'CPH', display: 'Copenhagen, Denmark' },
  { city: 'Oslo', country: 'Norway', iata: 'OSL', display: 'Oslo, Norway' },
  { city: 'Istanbul', country: 'Turkey', iata: 'IST', display: 'Istanbul, Turkey' },
  { city: 'Athens', country: 'Greece', iata: 'ATH', display: 'Athens, Greece' },
  
  // Asia Pacific
  { city: 'Tokyo', country: 'Japan', iata: 'NRT', display: 'Tokyo, Japan' },
  { city: 'Seoul', country: 'South Korea', iata: 'ICN', display: 'Seoul, South Korea' },
  { city: 'Beijing', country: 'China', iata: 'PEK', display: 'Beijing, China' },
  { city: 'Shanghai', country: 'China', iata: 'PVG', display: 'Shanghai, China' },
  { city: 'Hong Kong', country: 'Hong Kong', iata: 'HKG', display: 'Hong Kong' },
  { city: 'Singapore', country: 'Singapore', iata: 'SIN', display: 'Singapore' },
  { city: 'Bangkok', country: 'Thailand', iata: 'BKK', display: 'Bangkok, Thailand' },
  { city: 'Dubai', country: 'United Arab Emirates', iata: 'DXB', display: 'Dubai, United Arab Emirates' },
  { city: 'Sydney', country: 'Australia', iata: 'SYD', display: 'Sydney, Australia' },
  { city: 'Melbourne', country: 'Australia', iata: 'MEL', display: 'Melbourne, Australia' },
  { city: 'Bali', country: 'Indonesia', iata: 'DPS', display: 'Bali, Indonesia' },
  { city: 'Mumbai', country: 'India', iata: 'BOM', display: 'Mumbai, India' },
  { city: 'Delhi', country: 'India', iata: 'DEL', display: 'Delhi, India' },
  
  // South America
  { city: 'São Paulo', country: 'Brazil', iata: 'GRU', display: 'São Paulo, Brazil' },
  { city: 'Rio de Janeiro', country: 'Brazil', iata: 'GIG', display: 'Rio de Janeiro, Brazil' },
  { city: 'Buenos Aires', country: 'Argentina', iata: 'EZE', display: 'Buenos Aires, Argentina' },
  { city: 'Lima', country: 'Peru', iata: 'LIM', display: 'Lima, Peru' },
  { city: 'Bogotá', country: 'Colombia', iata: 'BOG', display: 'Bogotá, Colombia' },
];

// Search function to find cities by query
export function searchCities(query: string): CityOption[] {
  if (!query || query.length < 2) return [];
  
  const lowerQuery = query.toLowerCase();
  return cityIataMap.filter(city => 
    city.city.toLowerCase().includes(lowerQuery) ||
    city.country.toLowerCase().includes(lowerQuery) ||
    city.iata.toLowerCase().includes(lowerQuery) ||
    city.display.toLowerCase().includes(lowerQuery)
  ).slice(0, 8); // Limit to 8 results
}

// Get IATA code for a city
export function getIataForCity(cityName: string, countryName?: string): string | null {
  const normalized = cityName.toLowerCase().trim();
  const city = cityIataMap.find(c => 
    c.city.toLowerCase() === normalized ||
    c.display.toLowerCase().includes(normalized)
  );
  
  if (city) return city.iata;
  
  // Try fuzzy match
  if (countryName) {
    const fuzzy = cityIataMap.find(c => 
      c.city.toLowerCase().includes(normalized) &&
      c.country.toLowerCase().includes(countryName.toLowerCase())
    );
    if (fuzzy) return fuzzy.iata;
  }
  
  return null;
}
