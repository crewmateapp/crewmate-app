import 'dotenv/config';

// scripts/seed-all-cities.ts
// Seeds all airports from airportData.ts into Firestore cities collection
// Skips any that already exist

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Inline the airport data so the script is self-contained
const a = (code: string, name: string, lat: number, lng: number, areas: string[]) => ({
  code, name, lat, lng, areas: [`${code} Airport Area`, 'Downtown', ...areas]
});

const AIRPORTS = {
  // US MAJOR HUBS
  ATL: a('ATL', 'Atlanta', 33.6407, -84.4277, ['Buckhead', 'Midtown']),
  BOS: a('BOS', 'Boston', 42.3656, -71.0096, ['Back Bay', 'Cambridge']),
  CLT: a('CLT', 'Charlotte', 35.2140, -80.9431, ['South End', 'NoDa']),
  DCA: a('DCA', 'Washington DC', 38.8521, -77.0377, ['Georgetown', 'Arlington']),
  DEN: a('DEN', 'Denver', 39.8561, -104.6737, ['LoDo', 'Cherry Creek']),
  DFW: a('DFW', 'Dallas-Fort Worth', 32.8998, -97.0403, ['Uptown', 'Fort Worth']),
  DTW: a('DTW', 'Detroit', 42.2124, -83.3534, ['Dearborn', 'Ann Arbor']),
  EWR: a('EWR', 'Newark', 40.6895, -74.1745, ['Jersey City', 'Hoboken']),
  FLL: a('FLL', 'Fort Lauderdale', 26.0742, -80.1506, ['Las Olas', 'Hollywood']),
  IAD: a('IAD', 'Washington Dulles', 38.9531, -77.4565, ['Reston', 'Tysons']),
  IAH: a('IAH', 'Houston', 29.9902, -95.3368, ['Galleria', 'Midtown']),
  JFK: a('JFK', 'New York JFK', 40.6413, -73.7781, ['Manhattan', 'Brooklyn']),
  LAS: a('LAS', 'Las Vegas', 36.0840, -115.1537, ['The Strip', 'Henderson']),
  LAX: a('LAX', 'Los Angeles', 33.9416, -118.4085, ['Santa Monica', 'Hollywood']),
  LGA: a('LGA', 'New York LaGuardia', 40.7769, -73.8740, ['Manhattan', 'Queens']),
  MCO: a('MCO', 'Orlando', 28.4312, -81.3081, ['International Drive', 'Disney']),
  MIA: a('MIA', 'Miami', 25.7959, -80.2870, ['South Beach', 'Brickell']),
  MSP: a('MSP', 'Minneapolis—St. Paul', 44.8848, -93.2223, ['Mall of America', 'St Paul']),
  ORD: a('ORD', 'Chicago', 41.9742, -87.9073, ['River North', 'Loop']),
  PHL: a('PHL', 'Philadelphia', 39.8729, -75.2437, ['Center City', 'Old City']),
  PHX: a('PHX', 'Phoenix', 33.4373, -112.0078, ['Scottsdale', 'Tempe']),
  SEA: a('SEA', 'Seattle', 47.4502, -122.3088, ['Capitol Hill', 'Bellevue']),
  SFO: a('SFO', 'San Francisco', 37.6213, -122.3790, ['Mission', 'SOMA']),
  SLC: a('SLC', 'Salt Lake City', 40.7899, -111.9791, ['Sugar House', 'Park City']),
  TPA: a('TPA', 'Tampa', 27.9756, -82.5333, ['Ybor City', 'Clearwater']),

  // US SECONDARY
  ABQ: a('ABQ', 'Albuquerque', 35.0402, -106.6090, ['Old Town', 'Nob Hill']),
  ANC: a('ANC', 'Anchorage', 61.1743, -149.9962, []),
  AUS: a('AUS', 'Austin', 30.1975, -97.6664, ['6th Street', 'South Congress']),
  BNA: a('BNA', 'Nashville', 36.1263, -86.6774, ['Broadway', 'The Gulch']),
  BUF: a('BUF', 'Buffalo', 42.9405, -78.7322, ['Elmwood']),
  BUR: a('BUR', 'Burbank', 34.2005, -118.3585, ['North Hollywood']),
  BWI: a('BWI', 'Baltimore', 39.1754, -76.6683, ['Inner Harbor', 'Fells Point']),
  CHS: a('CHS', 'Charleston SC', 32.8986, -80.0405, ['King Street', 'Mount Pleasant']),
  CLE: a('CLE', 'Cleveland', 41.4117, -81.8498, ['Ohio City', 'Tremont']),
  CMH: a('CMH', 'Columbus', 39.9980, -82.8919, ['Short North', 'German Village']),
  CVG: a('CVG', 'Cincinnati', 39.0488, -84.6678, ['Over-the-Rhine']),
  DAL: a('DAL', 'Dallas Love Field', 32.8471, -96.8518, ['Uptown', 'Oak Lawn']),
  HNL: a('HNL', 'Honolulu', 21.3187, -157.9225, ['Waikiki', 'Ala Moana']),
  HOU: a('HOU', 'Houston Hobby', 29.6454, -95.2789, ['Montrose']),
  IND: a('IND', 'Indianapolis', 39.7173, -86.2944, ['Mass Ave', 'Broad Ripple']),
  JAX: a('JAX', 'Jacksonville', 30.4941, -81.6879, ['San Marco', 'Riverside']),
  KOA: a('KOA', 'Kona', 19.7388, -156.0456, ['Kailua-Kona']),
  LIH: a('LIH', 'Lihue', 21.9760, -159.3389, ['Poipu', 'Kapaa']),
  MCI: a('MCI', 'Kansas City', 39.2976, -94.7139, ['Power & Light', 'Westport']),
  MDW: a('MDW', 'Chicago Midway', 41.7868, -87.7522, ['Chinatown']),
  MEM: a('MEM', 'Memphis', 35.0424, -89.9767, ['Beale Street']),
  MKE: a('MKE', 'Milwaukee', 42.9472, -87.8966, ['Third Ward']),
  MSY: a('MSY', 'New Orleans', 29.9934, -90.2580, ['French Quarter', 'Garden District']),
  OAK: a('OAK', 'Oakland', 37.7213, -122.2208, ['Jack London Square']),
  OGG: a('OGG', 'Maui', 20.8986, -156.4305, ['Lahaina', 'Wailea', 'Kihei']),
  ONT: a('ONT', 'Ontario CA', 34.0560, -117.6012, ['Rancho Cucamonga']),
  PBI: a('PBI', 'West Palm Beach', 26.6832, -80.0956, ['City Place']),
  PDX: a('PDX', 'Portland', 45.5898, -122.5951, ['Pearl District', 'Alberta']),
  PIT: a('PIT', 'Pittsburgh', 40.4915, -80.2329, ['Strip District', 'South Side']),
  RDU: a('RDU', 'Raleigh—Durham', 35.8776, -78.7875, ['Durham', 'Chapel Hill']),
  RSW: a('RSW', 'Fort Myers', 26.5362, -81.7552, ['Naples']),
  SAN: a('SAN', 'San Diego', 32.7336, -117.1897, ['Gaslamp', 'La Jolla']),
  SAT: a('SAT', 'San Antonio', 29.5337, -98.4698, ['River Walk', 'Pearl']),
  SBA: a('SBA', 'Santa Barbara', 34.4262, -119.8415, ['Funk Zone', 'State Street']),
  SDF: a('SDF', 'Louisville', 38.1744, -85.7360, ['NuLu', 'Highlands']),
  SJC: a('SJC', 'San Jose', 37.3626, -121.9290, ['Santana Row']),
  SJU: a('SJU', 'San Juan', 18.4394, -66.0018, ['Old San Juan', 'Condado']),
  SMF: a('SMF', 'Sacramento', 38.6954, -121.5908, ['Midtown']),
  SNA: a('SNA', 'Orange County', 33.6762, -117.8682, ['Newport Beach']),
  STL: a('STL', 'St Louis', 38.7487, -90.3700, ['The Hill', 'Downtown']),

  // US SMALLER / REGIONAL
  ACY: a('ACY', 'Atlantic City', 39.4576, -74.5772, ['Boardwalk']),
  ALB: a('ALB', 'Albany', 42.7483, -73.8017, []),
  AVL: a('AVL', 'Asheville', 35.4362, -82.5418, []),
  BDL: a('BDL', 'Hartford', 41.9389, -72.6832, ['West Hartford']),
  BGR: a('BGR', 'Bangor', 44.8074, -68.8281, []),
  BHM: a('BHM', 'Birmingham', 33.5629, -86.7535, ['Five Points']),
  BIL: a('BIL', 'Billings', 45.8077, -108.5430, []),
  BOI: a('BOI', 'Boise', 43.5644, -116.2228, []),
  BTR: a('BTR', 'Baton Rouge', 30.5332, -91.1496, []),
  BTV: a('BTV', 'Burlington', 44.4719, -73.1533, ['Church Street']),
  BZN: a('BZN', 'Bozeman', 45.7775, -111.1530, []),
  CAE: a('CAE', 'Columbia SC', 33.9388, -81.1195, ['Five Points']),
  CAK: a('CAK', 'Akron', 40.9161, -81.4422, []),
  CID: a('CID', 'Cedar Rapids', 41.8847, -91.7108, []),
  COS: a('COS', 'Colorado Springs', 38.8058, -104.7008, ['Old Colorado City']),
  CRP: a('CRP', 'Corpus Christi', 27.7704, -97.5012, []),
  DAY: a('DAY', 'Dayton', 39.9024, -84.2194, []),
  DSM: a('DSM', 'Des Moines', 41.5341, -93.6631, ['East Village']),
  ELP: a('ELP', 'El Paso', 31.8072, -106.3778, []),
  EUG: a('EUG', 'Eugene', 44.1246, -123.2119, []),
  EYW: a('EYW', 'Key West', 24.5561, -81.7596, ['Duval Street']),
  FAI: a('FAI', 'Fairbanks', 64.8151, -147.8561, []),
  FAT: a('FAT', 'Fresno', 36.7762, -119.7181, []),
  FNT: a('FNT', 'Flint', 42.9654, -83.7436, []),
  GEG: a('GEG', 'Spokane', 47.6199, -117.5338, []),
  GPT: a('GPT', 'Gulfport', 30.4073, -89.0701, ['Biloxi']),
  GRR: a('GRR', 'Grand Rapids', 42.8808, -85.5228, ['East Hills']),
  GSO: a('GSO', 'Greensboro', 36.0978, -79.9373, []),
  GSP: a('GSP', 'Greenville SC', 34.8957, -82.2189, ['Falls Park', 'Main Street']),
  HSV: a('HSV', 'Huntsville', 34.6372, -86.7751, []),
  ICT: a('ICT', 'Wichita', 37.6499, -97.4331, []),
  ITO: a('ITO', 'Hilo', 19.7214, -155.0484, []),
  JAC: a('JAC', 'Jackson Hole', 43.6073, -110.7377, ['Town Square']),
  LEX: a('LEX', 'Lexington', 38.0365, -84.6059, ['Horse Country']),
  LIT: a('LIT', 'Little Rock', 34.7294, -92.2243, ['River Market']),
  MFR: a('MFR', 'Medford', 42.3742, -122.8735, []),
  MHT: a('MHT', 'Manchester NH', 42.9326, -71.4357, []),
  MOB: a('MOB', 'Mobile', 30.6914, -88.2428, []),
  MYR: a('MYR', 'Myrtle Beach', 33.6797, -78.9283, ['The Strip']),
  OKC: a('OKC', 'Oklahoma City', 35.3931, -97.6007, ['Bricktown']),
  OMA: a('OMA', 'Omaha', 41.3032, -95.8941, ['Old Market']),
  PNS: a('PNS', 'Pensacola', 30.4734, -87.1866, ['Palafox Street']),
  PSP: a('PSP', 'Palm Springs', 33.8297, -116.5067, []),
  PVD: a('PVD', 'Providence', 41.7240, -71.4282, ['Federal Hill']),
  PWM: a('PWM', 'Portland ME', 43.6462, -70.3093, ['Old Port']),
  RIC: a('RIC', 'Richmond', 37.5052, -77.3197, ['The Fan', 'Carytown']),
  RNO: a('RNO', 'Reno', 39.4991, -119.7681, ['Lake Tahoe']),
  ROC: a('ROC', 'Rochester NY', 43.1189, -77.6724, []),
  SAV: a('SAV', 'Savannah', 32.1276, -81.2021, ['Historic District']),
  SBN: a('SBN', 'South Bend', 41.7087, -86.3173, ['Notre Dame']),
  SFB: a('SFB', 'Sanford', 28.7776, -81.2375, []),
  SGF: a('SGF', 'Springfield MO', 37.2457, -93.3886, []),
  SHV: a('SHV', 'Shreveport', 32.4466, -93.8256, []),
  SRQ: a('SRQ', 'Sarasota', 27.3954, -82.5544, ['Siesta Key', 'St Armands']),
  SYR: a('SYR', 'Syracuse', 43.1112, -76.1063, []),
  TLH: a('TLH', 'Tallahassee', 30.3965, -84.3503, []),
  TUL: a('TUL', 'Tulsa', 36.1984, -95.8881, ['Blue Dome District']),
  TUS: a('TUS', 'Tucson', 32.1161, -110.9410, []),
  TYS: a('TYS', 'Knoxville', 35.8110, -83.9940, ['Market Square']),
  VPS: a('VPS', 'Destin-Fort Walton', 30.4832, -86.5254, ['Destin']),
  XNA: a('XNA', 'Northwest Arkansas', 36.2819, -94.3068, ['Bentonville', 'Fayetteville']),

  // US TERRITORIES
  GUM: a('GUM', 'Guam', 13.4834, 144.7960, ['Tumon Bay']),
  STT: a('STT', 'St Thomas', 18.3373, -64.9734, ['Charlotte Amalie']),
  STX: a('STX', 'St Croix', 17.7019, -64.7986, ['Christiansted']),

  // CANADA
  YEG: a('YEG', 'Edmonton', 53.3097, -113.5797, ['Whyte Avenue']),
  YHZ: a('YHZ', 'Halifax', 44.8808, -63.5085, ['Waterfront']),
  YOW: a('YOW', 'Ottawa', 45.3225, -75.6692, ['ByWard Market']),
  YQB: a('YQB', 'Quebec City', 46.7911, -71.3934, ['Old Quebec']),
  YUL: a('YUL', 'Montreal', 45.4706, -73.7408, ['Old Montreal', 'Plateau']),
  YVR: a('YVR', 'Vancouver', 49.1967, -123.1815, ['Gastown', 'Granville Island']),
  YWG: a('YWG', 'Winnipeg', 49.9100, -97.2399, ['The Forks']),
  YYC: a('YYC', 'Calgary', 51.1215, -114.0076, ['Kensington']),
  YYZ: a('YYZ', 'Toronto', 43.6777, -79.6248, ['Yorkville', 'Distillery']),

  // CARIBBEAN
  AUA: a('AUA', 'Aruba', 12.5014, -70.0152, ['Palm Beach', 'Oranjestad']),
  BGI: a('BGI', 'Barbados', 13.0746, -59.4925, ['Bridgetown']),
  BDA: a('BDA', 'Bermuda', 32.3640, -64.6787, ['Hamilton']),
  CUR: a('CUR', 'Curaçao', 12.1889, -68.9598, ['Willemstad']),
  GCM: a('GCM', 'Grand Cayman', 19.2928, -81.3577, ['Seven Mile Beach']),
  KIN: a('KIN', 'Kingston', 17.9357, -76.7875, ['New Kingston']),
  MBJ: a('MBJ', 'Montego Bay', 18.5037, -77.9134, ['Hip Strip']),
  NAS: a('NAS', 'Nassau', 25.0390, -77.4662, ['Paradise Island']),
  POS: a('POS', 'Port of Spain', 10.5954, -61.3372, []),
  PTP: a('PTP', 'Guadeloupe', 16.2653, -61.5318, []),
  PUJ: a('PUJ', 'Punta Cana', 18.5674, -68.3634, ['Bavaro']),
  SDQ: a('SDQ', 'Santo Domingo', 18.4297, -69.6689, ['Zona Colonial', 'Piantini']),
  SXM: a('SXM', 'St Maarten', 18.0410, -63.1089, ['Philipsburg', 'Maho Beach']),
  UVF: a('UVF', 'St Lucia', 13.7332, -60.9526, ['Rodney Bay']),

  // MEXICO
  ACA: a('ACA', 'Acapulco', 16.7571, -99.7540, ['Zona Dorada']),
  BJX: a('BJX', 'León-Guanajuato', 20.9935, -101.4808, ['San Miguel de Allende']),
  CUN: a('CUN', 'Cancún', 21.0365, -86.8771, ['Hotel Zone', 'Playa del Carmen']),
  GDL: a('GDL', 'Guadalajara', 20.5218, -103.3111, ['Centro Historico']),
  HMO: a('HMO', 'Hermosillo', 29.0959, -111.0480, []),
  MEX: a('MEX', 'Mexico City', 19.4363, -99.0721, ['Roma Norte', 'Condesa', 'Polanco']),
  MID: a('MID', 'Mérida', 20.9370, -89.6577, ['Centro']),
  MLM: a('MLM', 'Morelia', 19.8499, -101.0251, []),
  MTY: a('MTY', 'Monterrey', 25.7785, -100.1069, ['Barrio Antiguo']),
  OAX: a('OAX', 'Oaxaca', 16.9999, -96.7266, ['Centro']),
  PVR: a('PVR', 'Puerto Vallarta', 20.6801, -105.2542, ['Zona Romántica', 'Marina']),
  QRO: a('QRO', 'Querétaro', 20.6173, -100.1856, ['Centro Historico']),
  SJD: a('SJD', 'Los Cabos', 23.1518, -109.7215, ['Cabo San Lucas', 'San José del Cabo']),
  TIJ: a('TIJ', 'Tijuana', 32.5411, -116.9700, []),
  ZIH: a('ZIH', 'Ixtapa-Zihuatanejo', 17.6016, -101.4606, []),

  // CENTRAL AMERICA
  BZE: a('BZE', 'Belize City', 17.5391, -88.3082, []),
  GUA: a('GUA', 'Guatemala City', 14.5833, -90.5275, ['Zona Viva']),
  MGA: a('MGA', 'Managua', 12.1415, -86.1682, []),
  PTY: a('PTY', 'Panama City', 9.0714, -79.3835, ['Casco Viejo', 'Panama Canal']),
  SAL: a('SAL', 'San Salvador', 13.4409, -89.0557, []),
  SAP: a('SAP', 'San Pedro Sula', 15.4526, -87.9236, []),
  SJO: a('SJO', 'San José CR', 9.9939, -84.2088, ['Escazú']),
  TGU: a('TGU', 'Tegucigalpa', 14.0611, -87.2172, []),

  // SOUTH AMERICA
  BOG: a('BOG', 'Bogotá', 4.7016, -74.1469, ['Zona Rosa', 'La Candelaria']),
  BSB: a('BSB', 'Brasília', -15.8711, -47.9186, []),
  CLO: a('CLO', 'Cali', 3.5432, -76.3816, []),
  CTG: a('CTG', 'Cartagena', 10.4424, -75.5130, ['Old City', 'Bocagrande']),
  CUZ: a('CUZ', 'Cusco', -13.5357, -71.9388, ['Plaza de Armas']),
  EZE: a('EZE', 'Buenos Aires', -34.8222, -58.5358, ['Palermo', 'Recoleta', 'San Telmo']),
  GIG: a('GIG', 'Rio de Janeiro', -22.8100, -43.2505, ['Copacabana', 'Ipanema', 'Leblon']),
  GRU: a('GRU', 'São Paulo', -23.4356, -46.4731, ['Jardins', 'Paulista', 'Vila Madalena']),
  GYE: a('GYE', 'Guayaquil', -2.1574, -79.8837, ['Malecón']),
  LIM: a('LIM', 'Lima', -12.0219, -77.1143, ['Miraflores', 'Barranco']),
  MDE: a('MDE', 'Medellín', 6.1645, -75.4231, ['El Poblado', 'Laureles']),
  MVD: a('MVD', 'Montevideo', -34.8384, -56.0308, ['Ciudad Vieja', 'Pocitos']),
  SCL: a('SCL', 'Santiago', -33.3930, -70.7858, ['Bellavista', 'Lastarria']),
  UIO: a('UIO', 'Quito', -0.1292, -78.3575, ['Old Town', 'La Mariscal']),
  VVI: a('VVI', 'Santa Cruz', -17.6448, -63.1354, []),

  // WESTERN EUROPE
  AMS: a('AMS', 'Amsterdam', 52.3105, 4.7683, ['Jordaan', 'De Pijp']),
  BCN: a('BCN', 'Barcelona', 41.2971, 2.0785, ['Gothic Quarter', 'Eixample']),
  BRU: a('BRU', 'Brussels', 50.9014, 4.4844, ['Grand Place']),
  CDG: a('CDG', 'Paris CDG', 49.0097, 2.5479, ['Le Marais', 'Montmartre']),
  CPH: a('CPH', 'Copenhagen', 55.6181, 12.6560, ['Nyhavn', 'Tivoli']),
  DUB: a('DUB', 'Dublin', 53.4264, -6.2499, ['Temple Bar']),
  DUS: a('DUS', 'Düsseldorf', 51.2895, 6.7668, ['Altstadt']),
  EDI: a('EDI', 'Edinburgh', 55.9500, -3.3725, ['Old Town', 'Royal Mile']),
  FAO: a('FAO', 'Faro', 37.0144, -7.9659, ['Algarve']),
  FCO: a('FCO', 'Rome', 41.8003, 12.2389, ['Trastevere', 'Vatican']),
  FRA: a('FRA', 'Frankfurt', 50.0379, 8.5622, ['Sachsenhausen']),
  GVA: a('GVA', 'Geneva', 46.2381, 6.1089, ['Old Town']),
  HAM: a('HAM', 'Hamburg', 53.6304, 9.9882, ['St Pauli', 'Speicherstadt']),
  HEL: a('HEL', 'Helsinki', 60.3172, 24.9633, ['Kallio', 'Design District']),
  LGW: a('LGW', 'London Gatwick', 51.1537, -0.1821, ['Central London']),
  LHR: a('LHR', 'London Heathrow', 51.4700, -0.4543, ['Westminster', 'Soho']),
  LIS: a('LIS', 'Lisbon', 38.7813, -9.1359, ['Alfama', 'Bairro Alto']),
  LTN: a('LTN', 'London Luton', 51.8747, -0.3683, []),
  MAD: a('MAD', 'Madrid', 40.4983, -3.5676, ['Centro', 'Salamanca']),
  MAN: a('MAN', 'Manchester UK', 53.3588, -2.2727, ['Northern Quarter']),
  MLA: a('MLA', 'Malta', 35.8575, 14.4775, ['Valletta']),
  MRS: a('MRS', 'Marseille', 43.4393, 5.2214, ['Vieux Port']),
  MUC: a('MUC', 'Munich', 48.3537, 11.7750, ['Marienplatz']),
  MXP: a('MXP', 'Milan', 45.6306, 8.7281, ['Duomo', 'Navigli']),
  NCE: a('NCE', 'Nice', 43.6584, 7.2159, ['Promenade des Anglais']),
  OPO: a('OPO', 'Porto', 41.2481, -8.6814, ['Ribeira']),
  ORY: a('ORY', 'Paris Orly', 48.7262, 2.3652, ['Latin Quarter']),
  OSL: a('OSL', 'Oslo', 60.1939, 11.1004, ['Aker Brygge']),
  PMI: a('PMI', 'Palma de Mallorca', 39.5517, 2.7388, ['Old Town']),
  STN: a('STN', 'London Stansted', 51.8850, 0.2350, []),
  SVQ: a('SVQ', 'Seville', 37.4180, -5.8931, ['Santa Cruz']),
  TXL: a('TXL', 'Berlin', 52.3667, 13.5033, ['Mitte', 'Kreuzberg']),
  VCE: a('VCE', 'Venice', 45.5053, 12.3519, ['San Marco', 'Dorsoduro']),
  VIE: a('VIE', 'Vienna', 48.1103, 16.5697, ['Innere Stadt']),
  ZRH: a('ZRH', 'Zurich', 47.4647, 8.5492, ['Old Town']),

  // NORTHERN EUROPE & SCANDINAVIA
  ARN: a('ARN', 'Stockholm', 59.6519, 17.9186, ['Gamla Stan']),
  GOT: a('GOT', 'Gothenburg', 57.6628, 12.2798, []),
  KEF: a('KEF', 'Reykjavik', 63.9850, -22.6056, ['Laugavegur']),
  RIX: a('RIX', 'Riga', 56.9236, 23.9711, ['Old Riga']),
  TLL: a('TLL', 'Tallinn', 59.4133, 24.8328, ['Old Town']),
  VNO: a('VNO', 'Vilnius', 54.6341, 25.2858, ['Old Town']),

  // EASTERN EUROPE
  ATH: a('ATH', 'Athens', 37.9364, 23.9445, ['Plaka', 'Monastiraki']),
  BEG: a('BEG', 'Belgrade', 44.8184, 20.3091, ['Knez Mihailova']),
  BUD: a('BUD', 'Budapest', 47.4298, 19.2611, ['District V', 'Ruin Bars']),
  DBV: a('DBV', 'Dubrovnik', 42.5614, 18.2682, ['Old Town']),
  IST: a('IST', 'Istanbul', 41.2753, 28.7519, ['Sultanahmet', 'Beyoğlu']),
  KRK: a('KRK', 'Krakow', 50.0777, 19.7848, ['Old Town', 'Kazimierz']),
  LJU: a('LJU', 'Ljubljana', 46.2237, 14.4576, ['Old Town']),
  OTP: a('OTP', 'Bucharest', 44.5711, 26.0850, ['Old Town', 'Lipscani']),
  PRG: a('PRG', 'Prague', 50.1008, 14.2600, ['Old Town', 'Malá Strana']),
  SAW: a('SAW', 'Istanbul Sabiha', 40.8986, 29.3092, ['Kadıköy']),
  SOF: a('SOF', 'Sofia', 42.6952, 23.4062, ['Vitosha Blvd']),
  SPU: a('SPU', 'Split', 43.5389, 16.2980, []),
  WAW: a('WAW', 'Warsaw', 52.1657, 20.9671, ['Old Town']),
  ZAG: a('ZAG', 'Zagreb', 45.7429, 16.0688, ['Upper Town']),

  // MIDDLE EAST
  AMM: a('AMM', 'Amman', 31.7226, 35.9932, ['Rainbow Street']),
  AUH: a('AUH', 'Abu Dhabi', 24.4330, 54.6511, ['Corniche', 'Yas Island']),
  BAH: a('BAH', 'Bahrain', 26.2708, 50.6336, ['Manama']),
  DOH: a('DOH', 'Doha', 25.2731, 51.6081, ['Souq Waqif', 'The Pearl']),
  DXB: a('DXB', 'Dubai', 25.2532, 55.3657, ['Dubai Marina', 'Jumeirah']),
  JED: a('JED', 'Jeddah', 21.6796, 39.1565, ['Al-Balad']),
  KWI: a('KWI', 'Kuwait City', 29.2266, 47.9689, []),
  MCT: a('MCT', 'Muscat', 23.5933, 58.2844, ['Mutrah']),
  RUH: a('RUH', 'Riyadh', 24.9578, 46.6989, ['Diriyah']),
  TLV: a('TLV', 'Tel Aviv', 32.0055, 34.8854, ['Jaffa', 'Rothschild']),

  // AFRICA
  ABJ: a('ABJ', 'Abidjan', 5.2614, -3.9263, ['Plateau']),
  ACC: a('ACC', 'Accra', 5.6052, -0.1718, ['Osu']),
  ADD: a('ADD', 'Addis Ababa', 8.9779, 38.7993, ['Piazza']),
  ALG: a('ALG', 'Algiers', 36.6910, 3.2154, []),
  CAI: a('CAI', 'Cairo', 30.1219, 31.4056, ['Zamalek', 'Giza']),
  CMN: a('CMN', 'Casablanca', 33.3675, -7.5898, ['Habous Quarter']),
  CPT: a('CPT', 'Cape Town', -33.9715, 18.6021, ['V&A Waterfront']),
  DAR: a('DAR', 'Dar es Salaam', -6.8781, 39.2026, []),
  DKR: a('DKR', 'Dakar', 14.6708, -17.0733, []),
  JNB: a('JNB', 'Johannesburg', -26.1367, 28.2411, ['Sandton']),
  LOS: a('LOS', 'Lagos', 6.5774, 3.3212, ['Victoria Island']),
  MBA: a('MBA', 'Mombasa', -4.0348, 39.5942, ['Old Town']),
  NBO: a('NBO', 'Nairobi', -1.3192, 36.9278, ['Karen', 'Westlands']),
  RAK: a('RAK', 'Marrakech', 31.6069, -8.0363, ['Medina']),
  TUN: a('TUN', 'Tunis', 36.8510, 10.2272, ['Medina']),
  WDH: a('WDH', 'Windhoek', -22.4799, 17.4709, []),
  ZNZ: a('ZNZ', 'Zanzibar', -6.2220, 39.2249, ['Stone Town']),

  // EAST ASIA
  CAN: a('CAN', 'Guangzhou', 23.3924, 113.2988, []),
  CJU: a('CJU', 'Jeju', 33.5113, 126.4929, ['Jeju City']),
  CTS: a('CTS', 'Sapporo', 42.7752, 141.6925, ['Susukino']),
  FUK: a('FUK', 'Fukuoka', 33.5859, 130.4513, ['Tenjin', 'Hakata']),
  GMP: a('GMP', 'Seoul Gimpo', 37.5583, 126.7906, ['Hongdae']),
  HKG: a('HKG', 'Hong Kong', 22.3080, 113.9185, ['Central', 'Tsim Sha Tsui']),
  HND: a('HND', 'Tokyo Haneda', 35.5494, 139.7798, ['Shibuya', 'Shinjuku']),
  ICN: a('ICN', 'Seoul', 37.4602, 126.4407, ['Myeongdong', 'Gangnam']),
  KIX: a('KIX', 'Osaka', 34.4347, 135.2441, ['Namba', 'Dotonbori']),
  MFM: a('MFM', 'Macau', 22.1496, 113.5919, ['Cotai Strip']),
  NGO: a('NGO', 'Nagoya', 34.8584, 136.8125, []),
  NRT: a('NRT', 'Tokyo Narita', 35.7720, 140.3929, ['Shinjuku', 'Ginza']),
  PEK: a('PEK', 'Beijing', 40.0799, 116.6031, ['Forbidden City']),
  PKX: a('PKX', 'Beijing Daxing', 39.5098, 116.4105, []),
  PUS: a('PUS', 'Busan', 35.1796, 128.9382, ['Haeundae', 'Seomyeon']),
  PVG: a('PVG', 'Shanghai', 31.1443, 121.8083, ['The Bund']),
  SHA: a('SHA', 'Shanghai Hongqiao', 31.1979, 121.3360, ['French Concession']),
  SZX: a('SZX', 'Shenzhen', 22.6393, 113.8106, []),
  TAO: a('TAO', 'Qingdao', 36.2461, 120.0955, []),
  TPE: a('TPE', 'Taipei', 25.0797, 121.2342, ['Ximending']),
  TSA: a('TSA', 'Taipei Songshan', 25.0694, 121.5525, []),
  XIY: a('XIY', "Xi'an", 34.4471, 108.7516, ['Muslim Quarter']),

  // SOUTHEAST ASIA
  BKK: a('BKK', 'Bangkok', 13.6900, 100.7501, ['Sukhumvit', 'Silom']),
  CEB: a('CEB', 'Cebu', 10.3075, 123.9794, []),
  CGK: a('CGK', 'Jakarta', -6.1256, 106.6559, ['Kota Tua']),
  CMB: a('CMB', 'Colombo', 7.1808, 79.8841, ['Galle Face']),
  CNX: a('CNX', 'Chiang Mai', 18.7668, 98.9626, ['Old City', 'Nimman']),
  DAD: a('DAD', 'Da Nang', 16.0439, 108.1992, ['Hoi An']),
  DPS: a('DPS', 'Bali', -8.7482, 115.1672, ['Seminyak', 'Ubud', 'Canggu']),
  DMK: a('DMK', 'Bangkok Don Mueang', 13.9126, 100.6068, []),
  HAN: a('HAN', 'Hanoi', 21.2187, 105.8042, ['Old Quarter']),
  HKT: a('HKT', 'Phuket', 8.1132, 98.3169, ['Patong', 'Old Town']),
  KUL: a('KUL', 'Kuala Lumpur', 2.7456, 101.7099, ['Bukit Bintang', 'KLCC']),
  MNL: a('MNL', 'Manila', 14.5086, 121.0197, ['Makati', 'BGC']),
  PEN: a('PEN', 'Penang', 5.2972, 100.2769, ['George Town']),
  PNH: a('PNH', 'Phnom Penh', 11.5466, 104.8441, ['Riverside']),
  REP: a('REP', 'Siem Reap', 13.4107, 103.8128, ['Pub Street', 'Angkor Wat']),
  RGN: a('RGN', 'Yangon', 16.9073, 96.1332, []),
  SGN: a('SGN', 'Ho Chi Minh City', 10.8188, 106.6520, ['District 1', 'Bui Vien']),
  SIN: a('SIN', 'Singapore', 1.3644, 103.9915, ['Marina Bay', 'Orchard']),
  VTE: a('VTE', 'Vientiane', 17.9884, 102.5633, []),

  // SOUTH ASIA
  BLR: a('BLR', 'Bangalore', 13.1986, 77.7066, ['MG Road', 'Indiranagar']),
  BOM: a('BOM', 'Mumbai', 19.0896, 72.8656, ['Colaba', 'Bandra']),
  CCU: a('CCU', 'Kolkata', 22.6520, 88.4463, ['Park Street']),
  DAC: a('DAC', 'Dhaka', 23.8433, 90.3978, []),
  DEL: a('DEL', 'New Delhi', 28.5562, 77.1000, ['Connaught Place']),
  GOI: a('GOI', 'Goa', 15.3809, 73.8314, ['Panjim', 'Calangute']),
  HYD: a('HYD', 'Hyderabad', 17.2403, 78.4294, []),
  KTM: a('KTM', 'Kathmandu', 27.6966, 85.3591, ['Thamel']),
  MAA: a('MAA', 'Chennai', 12.9941, 80.1709, ['T Nagar']),
  MLE: a('MLE', 'Malé', 4.1918, 73.5290, []),

  // OCEANIA & PACIFIC
  AKL: a('AKL', 'Auckland', -37.0082, 174.7850, ['Viaduct Harbour', 'Ponsonby']),
  BNE: a('BNE', 'Brisbane', -27.3842, 153.1175, ['South Bank', 'Fortitude Valley']),
  CHC: a('CHC', 'Christchurch', -43.4894, 172.5322, []),
  DRW: a('DRW', 'Darwin', -12.4147, 130.8769, []),
  MEL: a('MEL', 'Melbourne', -37.6690, 144.8410, ['Southbank', 'Fitzroy']),
  NAN: a('NAN', 'Nadi', -17.7554, 177.4431, ['Denarau Island']),
  NOU: a('NOU', 'Nouméa', -22.0146, 166.2129, []),
  PER: a('PER', 'Perth', -31.9403, 115.9670, ['Northbridge', 'Fremantle']),
  PPT: a('PPT', 'Tahiti', -17.5537, -149.6073, ['Papeete']),
  SYD: a('SYD', 'Sydney', -33.9399, 151.1753, ['Darling Harbour', 'Bondi']),
  WLG: a('WLG', 'Wellington', -41.3272, 174.8053, ['Cuba Street']),
};

async function main() {
  console.log('🌍 Seeding all cities from airport database');
  console.log('============================================\n');

  // Load existing cities
  const citiesSnapshot = await getDocs(collection(db, 'cities'));
  const existingCodes = new Set(citiesSnapshot.docs.map(d => d.id));
  console.log(`📦 ${existingCodes.size} cities already exist in Firestore\n`);

  const entries = Object.entries(AIRPORTS);
  let added = 0;
  let skipped = 0;

  for (const [code, airport] of entries) {
    if (existingCodes.has(code)) {
      skipped++;
      continue;
    }

    await setDoc(doc(db, 'cities', code), {
      name: airport.name,
      code: airport.code,
      lat: airport.lat,
      lng: airport.lng,
      areas: airport.areas,
      status: 'active',
      createdAt: serverTimestamp(),
    });

    console.log(`✅ Added ${airport.name} (${code})`);
    added++;
  }

  console.log(`\n📊 SUMMARY`);
  console.log(`==========`);
  console.log(`Already existed: ${skipped}`);
  console.log(`Newly added:     ${added}`);
  console.log(`Total now:       ${skipped + added}`);
}

main()
  .then(() => { console.log('\n✅ Done!'); process.exit(0); })
  .catch(err => { console.error('\n💥 Failed:', err); process.exit(1); });
