export const airlineDomains = [
  // US Major Airlines
  'delta.com',
  'united.com',
  'aa.com',              // American Airlines
  'southwest.com',
  'alaskaair.com',
  'jetblue.com',
  'spiritairlines.com',
  'frontierairlines.com',
  'hawaiianairlines.com',
  
  // US Regional/Low-Cost
  'allegiantair.com',
  'sunjets.com',         // Sun Country
  'breezeairways.com',
  
  // International Major
  'emirates.com',
  'britishairways.com',
  'lufthansa.com',
  'airfrance.com',
  'klm.com',
  'qantas.com',
  'aircanada.ca',
  'westjet.com',
  
  // Testing
  'crewmate.app',
  
  // Add more as needed
];

export const airlineNames: { [domain: string]: string } = {
  'delta.com': 'Delta Air Lines',
  'united.com': 'United Airlines',
  'aa.com': 'American Airlines',
  'southwest.com': 'Southwest Airlines',
  'alaskaair.com': 'Alaska Airlines',
  'jetblue.com': 'JetBlue Airways',
  'spiritairlines.com': 'Spirit Airlines',
  'frontierairlines.com': 'Frontier Airlines',
  'hawaiianairlines.com': 'Hawaiian Airlines',
  'allegiantair.com': 'Allegiant Air',
  'sunjets.com': 'Sun Country Airlines',
  'breezeairways.com': 'Breeze Airways',
  'emirates.com': 'Emirates',
  'britishairways.com': 'British Airways',
  'lufthansa.com': 'Lufthansa',
  'airfrance.com': 'Air France',
  'klm.com': 'KLM',
  'qantas.com': 'Qantas',
  'aircanada.ca': 'Air Canada',
  'westjet.com': 'WestJet',
  'crewmate.app': 'CrewMate Test',
};

export function isValidAirlineEmail(email: string): boolean {
  const emailLower = email.toLowerCase().trim();
  const domain = emailLower.split('@')[1];
  return airlineDomains.includes(domain);
}

export function getAirlineFromEmail(email: string): string {
  const emailLower = email.toLowerCase().trim();
  const domain = emailLower.split('@')[1];
  return airlineNames[domain] || 'Airline';
}