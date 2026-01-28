/**
 * Continent Mapping Utility
 * Maps cities to continents for travel badge tracking
 */

export type Continent = 
  | 'North America'
  | 'South America'
  | 'Europe'
  | 'Asia'
  | 'Africa'
  | 'Oceania'
  | 'Antarctica';

/**
 * Mapping of cities to continents
 * Add new cities as crew visit them
 */
export const CITY_TO_CONTINENT: Record<string, Continent> = {
  // ===== NORTH AMERICA =====
  
  // United States - East Coast
  'New York': 'North America',
  'Newark': 'North America',
  'Boston': 'North America',
  'Philadelphia': 'North America',
  'Baltimore': 'North America',
  'Washington': 'North America',
  'Charlotte': 'North America',
  'Raleigh': 'North America',
  'Atlanta': 'North America',
  'Miami': 'North America',
  'Fort Lauderdale': 'North America',
  'Orlando': 'North America',
  'Tampa': 'North America',
  'Jacksonville': 'North America',
  'Charleston': 'North America',
  'Savannah': 'North America',
  'Nashville': 'North America',
  'Memphis': 'North America',
  'Richmond': 'North America',
  'Norfolk': 'North America',
  
  // United States - Central
  'Chicago': 'North America',
  'Dallas': 'North America',
  'Houston': 'North America',
  'Austin': 'North America',
  'San Antonio': 'North America',
  'Denver': 'North America',
  'Minneapolis': 'North America',
  'St. Louis': 'North America',
  'Kansas City': 'North America',
  'Oklahoma City': 'North America',
  'Indianapolis': 'North America',
  'Columbus': 'North America',
  'Cleveland': 'North America',
  'Cincinnati': 'North America',
  'Detroit': 'North America',
  'Milwaukee': 'North America',
  'Omaha': 'North America',
  'Des Moines': 'North America',
  
  // United States - West Coast
  'Los Angeles': 'North America',
  'San Francisco': 'North America',
  'San Diego': 'North America',
  'San Jose': 'North America',
  'Sacramento': 'North America',
  'Oakland': 'North America',
  'Seattle': 'North America',
  'Portland': 'North America',
  'Las Vegas': 'North America',
  'Phoenix': 'North America',
  'Tucson': 'North America',
  'Albuquerque': 'North America',
  'Salt Lake City': 'North America',
  'Boise': 'North America',
  'Spokane': 'North America',
  
  // United States - Other
  'Anchorage': 'North America',
  'Honolulu': 'North America',
  'Maui': 'North America',
  'Kauai': 'North America',
  'Kona': 'North America',
  
  // Canada
  'Toronto': 'North America',
  'Montreal': 'North America',
  'Vancouver': 'North America',
  'Calgary': 'North America',
  'Edmonton': 'North America',
  'Ottawa': 'North America',
  'Winnipeg': 'North America',
  'Quebec City': 'North America',
  'Halifax': 'North America',
  
  // Mexico
  'Mexico City': 'North America',
  'Cancun': 'North America',
  'Guadalajara': 'North America',
  'Monterrey': 'North America',
  'Puerto Vallarta': 'North America',
  'Cabo San Lucas': 'North America',
  'Tijuana': 'North America',
  'Playa del Carmen': 'North America',
  
  // Central America
  'San Jose': 'North America', // Costa Rica
  'Panama City': 'North America',
  'Guatemala City': 'North America',
  'San Salvador': 'North America',
  'Managua': 'North America',
  'Belize City': 'North America',
  
  // Caribbean
  'San Juan': 'North America',
  'Punta Cana': 'North America',
  'Nassau': 'North America',
  'Kingston': 'North America',
  'Havana': 'North America',
  'Santo Domingo': 'North America',
  'Port-au-Prince': 'North America',
  'Montego Bay': 'North America',
  'Aruba': 'North America',
  'Curacao': 'North America',
  'Barbados': 'North America',
  'Trinidad': 'North America',
  'Grand Cayman': 'North America',
  
  // ===== SOUTH AMERICA =====
  
  'Sao Paulo': 'South America',
  'Rio de Janeiro': 'South America',
  'Brasilia': 'South America',
  'Buenos Aires': 'South America',
  'Lima': 'South America',
  'Bogota': 'South America',
  'Santiago': 'South America',
  'Caracas': 'South America',
  'Quito': 'South America',
  'La Paz': 'South America',
  'Montevideo': 'South America',
  'Asuncion': 'South America',
  'Georgetown': 'South America',
  'Paramaribo': 'South America',
  'Cayenne': 'South America',
  'Medellin': 'South America',
  'Cartagena': 'South America',
  'Cusco': 'South America',
  'Machu Picchu': 'South America',
  
  // ===== EUROPE =====
  
  // United Kingdom & Ireland
  'London': 'Europe',
  'Manchester': 'Europe',
  'Edinburgh': 'Europe',
  'Dublin': 'Europe',
  'Belfast': 'Europe',
  'Glasgow': 'Europe',
  'Birmingham': 'Europe',
  'Liverpool': 'Europe',
  
  // France
  'Paris': 'Europe',
  'Nice': 'Europe',
  'Lyon': 'Europe',
  'Marseille': 'Europe',
  'Toulouse': 'Europe',
  'Bordeaux': 'Europe',
  
  // Germany
  'Berlin': 'Europe',
  'Munich': 'Europe',
  'Frankfurt': 'Europe',
  'Hamburg': 'Europe',
  'Cologne': 'Europe',
  'Dusseldorf': 'Europe',
  
  // Italy
  'Rome': 'Europe',
  'Milan': 'Europe',
  'Venice': 'Europe',
  'Florence': 'Europe',
  'Naples': 'Europe',
  'Bologna': 'Europe',
  
  // Spain & Portugal
  'Madrid': 'Europe',
  'Barcelona': 'Europe',
  'Seville': 'Europe',
  'Valencia': 'Europe',
  'Lisbon': 'Europe',
  'Porto': 'Europe',
  
  // Netherlands & Belgium
  'Amsterdam': 'Europe',
  'Rotterdam': 'Europe',
  'Brussels': 'Europe',
  'Antwerp': 'Europe',
  
  // Switzerland & Austria
  'Zurich': 'Europe',
  'Geneva': 'Europe',
  'Vienna': 'Europe',
  'Salzburg': 'Europe',
  
  // Scandinavia
  'Stockholm': 'Europe',
  'Copenhagen': 'Europe',
  'Oslo': 'Europe',
  'Helsinki': 'Europe',
  'Reykjavik': 'Europe',
  
  // Eastern Europe
  'Prague': 'Europe',
  'Budapest': 'Europe',
  'Warsaw': 'Europe',
  'Krakow': 'Europe',
  'Bucharest': 'Europe',
  'Sofia': 'Europe',
  'Athens': 'Europe',
  'Istanbul': 'Europe',
  
  // Other Europe
  'Moscow': 'Europe',
  'St. Petersburg': 'Europe',
  
  // ===== ASIA =====
  
  // East Asia
  'Tokyo': 'Asia',
  'Osaka': 'Asia',
  'Kyoto': 'Asia',
  'Seoul': 'Asia',
  'Beijing': 'Asia',
  'Shanghai': 'Asia',
  'Hong Kong': 'Asia',
  'Taipei': 'Asia',
  
  // Southeast Asia
  'Singapore': 'Asia',
  'Bangkok': 'Asia',
  'Manila': 'Asia',
  'Jakarta': 'Asia',
  'Kuala Lumpur': 'Asia',
  'Hanoi': 'Asia',
  'Ho Chi Minh City': 'Asia',
  'Phnom Penh': 'Asia',
  'Yangon': 'Asia',
  'Vientiane': 'Asia',
  'Bali': 'Asia',
  'Phuket': 'Asia',
  
  // South Asia
  'New Delhi': 'Asia',
  'Mumbai': 'Asia',
  'Bangalore': 'Asia',
  'Kolkata': 'Asia',
  'Chennai': 'Asia',
  'Hyderabad': 'Asia',
  'Islamabad': 'Asia',
  'Karachi': 'Asia',
  'Lahore': 'Asia',
  'Dhaka': 'Asia',
  'Kathmandu': 'Asia',
  'Colombo': 'Asia',
  
  // Middle East
  'Dubai': 'Asia',
  'Abu Dhabi': 'Asia',
  'Doha': 'Asia',
  'Riyadh': 'Asia',
  'Jeddah': 'Asia',
  'Kuwait City': 'Asia',
  'Muscat': 'Asia',
  'Manama': 'Asia',
  'Tel Aviv': 'Asia',
  'Jerusalem': 'Asia',
  'Amman': 'Asia',
  'Beirut': 'Asia',
  'Damascus': 'Asia',
  'Baghdad': 'Asia',
  'Tehran': 'Asia',
  
  // ===== AFRICA =====
  
  'Cairo': 'Africa',
  'Lagos': 'Africa',
  'Johannesburg': 'Africa',
  'Cape Town': 'Africa',
  'Nairobi': 'Africa',
  'Casablanca': 'Africa',
  'Marrakech': 'Africa',
  'Addis Ababa': 'Africa',
  'Accra': 'Africa',
  'Dar es Salaam': 'Africa',
  'Kigali': 'Africa',
  'Kampala': 'Africa',
  'Dakar': 'Africa',
  'Abidjan': 'Africa',
  'Tunis': 'Africa',
  'Algiers': 'Africa',
  'Lusaka': 'Africa',
  'Harare': 'Africa',
  'Maputo': 'Africa',
  'Windhoek': 'Africa',
  
  // ===== OCEANIA =====
  
  // Australia
  'Sydney': 'Oceania',
  'Melbourne': 'Oceania',
  'Brisbane': 'Oceania',
  'Perth': 'Oceania',
  'Adelaide': 'Oceania',
  'Canberra': 'Oceania',
  'Gold Coast': 'Oceania',
  'Cairns': 'Oceania',
  
  // New Zealand
  'Auckland': 'Oceania',
  'Wellington': 'Oceania',
  'Christchurch': 'Oceania',
  'Queenstown': 'Oceania',
  
  // Pacific Islands
  'Fiji': 'Oceania',
  'Papeete': 'Oceania',
  'Port Moresby': 'Oceania',
  'Noumea': 'Oceania',
  'Apia': 'Oceania',
  'Suva': 'Oceania',
  'Nadi': 'Oceania',
  
  // ===== ANTARCTICA =====
  
  'McMurdo Station': 'Antarctica',
  'Palmer Station': 'Antarctica',
  'Rothera': 'Antarctica',
  'Casey Station': 'Antarctica',
  'Davis Station': 'Antarctica',
  'Mawson Station': 'Antarctica',
  'South Pole Station': 'Antarctica',
};

/**
 * Get the continent for a given city
 * @param cityName - Name of the city
 * @returns Continent name or default to North America if not found
 */
export function getContinentForCity(cityName: string): Continent {
  // Normalize city name (trim whitespace, handle case)
  const normalizedCity = cityName.trim();
  
  // Try exact match first
  if (CITY_TO_CONTINENT[normalizedCity]) {
    return CITY_TO_CONTINENT[normalizedCity];
  }
  
  // Try case-insensitive match
  const lowerCity = normalizedCity.toLowerCase();
  const matchedKey = Object.keys(CITY_TO_CONTINENT).find(
    key => key.toLowerCase() === lowerCity
  );
  
  if (matchedKey) {
    return CITY_TO_CONTINENT[matchedKey];
  }
  
  // Log warning for unmapped city
  console.warn(`[CrewMate] City "${cityName}" not mapped to a continent. Defaulting to North America.`);
  
  // Default to North America (most common for US-based crew)
  return 'North America';
}

/**
 * Get all cities for a specific continent
 */
export function getCitiesByContinent(continent: Continent): string[] {
  return Object.entries(CITY_TO_CONTINENT)
    .filter(([_, cont]) => cont === continent)
    .map(([city, _]) => city);
}

/**
 * Get count of cities by continent
 */
export function getCityCountByContinent(): Record<Continent, number> {
  const counts: Record<Continent, number> = {
    'North America': 0,
    'South America': 0,
    'Europe': 0,
    'Asia': 0,
    'Africa': 0,
    'Oceania': 0,
    'Antarctica': 0,
  };
  
  Object.values(CITY_TO_CONTINENT).forEach(continent => {
    counts[continent]++;
  });
  
  return counts;
}

/**
 * Check if a city is mapped
 */
export function isCityMapped(cityName: string): boolean {
  const normalizedCity = cityName.trim();
  return CITY_TO_CONTINENT[normalizedCity] !== undefined ||
         Object.keys(CITY_TO_CONTINENT).some(
           key => key.toLowerCase() === normalizedCity.toLowerCase()
         );
}

/**
 * Add a new city to the mapping (for future use)
 */
export function suggestCityMapping(cityName: string, continent: Continent): void {
  console.log(`[CrewMate] Suggestion: Add "${cityName}" → "${continent}" to CITY_TO_CONTINENT`);
}
