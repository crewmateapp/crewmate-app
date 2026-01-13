// utils/airportData.ts - Comprehensive airport database for CrewMate

export type AirportData = {
  code: string;
  name: string;
  fullName: string;
  lat: number;
  lng: number;
  areas: string[];
  country: string;
};

// Helper to create airport entry with default areas
const a = (code: string, name: string, fullName: string, lat: number, lng: number, country: string, extraAreas: string[] = []): AirportData => ({
  code, name, fullName, lat, lng, country,
  areas: [`${code} Airport Area`, 'Downtown', ...extraAreas]
});

export const AIRPORTS: Record<string, AirportData> = {
  // US MAJOR HUBS
  ATL: a('ATL', 'Atlanta', 'Hartsfield-Jackson Atlanta International', 33.6407, -84.4277, 'US', ['Buckhead', 'Midtown']),
  BOS: a('BOS', 'Boston', 'Boston Logan International', 42.3656, -71.0096, 'US', ['Back Bay', 'Cambridge']),
  CLT: a('CLT', 'Charlotte', 'Charlotte Douglas International', 35.2140, -80.9431, 'US', ['South End', 'NoDa']),
  DCA: a('DCA', 'Washington DC', 'Reagan National', 38.8521, -77.0377, 'US', ['Georgetown', 'Arlington']),
  DEN: a('DEN', 'Denver', 'Denver International', 39.8561, -104.6737, 'US', ['LoDo', 'Cherry Creek']),
  DFW: a('DFW', 'Dallas-Fort Worth', 'DFW International', 32.8998, -97.0403, 'US', ['Uptown', 'Fort Worth']),
  DTW: a('DTW', 'Detroit', 'Detroit Metro', 42.2124, -83.3534, 'US', ['Dearborn', 'Ann Arbor']),
  EWR: a('EWR', 'Newark', 'Newark Liberty International', 40.6895, -74.1745, 'US', ['Jersey City', 'Hoboken']),
  FLL: a('FLL', 'Fort Lauderdale', 'Fort Lauderdale-Hollywood International', 26.0742, -80.1506, 'US', ['Las Olas', 'Hollywood']),
  IAD: a('IAD', 'Washington Dulles', 'Dulles International', 38.9531, -77.4565, 'US', ['Reston', 'Tysons']),
  IAH: a('IAH', 'Houston', 'George Bush Intercontinental', 29.9902, -95.3368, 'US', ['Galleria', 'Midtown']),
  JFK: a('JFK', 'New York JFK', 'John F Kennedy International', 40.6413, -73.7781, 'US', ['Manhattan', 'Brooklyn']),
  LAS: a('LAS', 'Las Vegas', 'Harry Reid International', 36.0840, -115.1537, 'US', ['The Strip', 'Henderson']),
  LAX: a('LAX', 'Los Angeles', 'Los Angeles International', 33.9416, -118.4085, 'US', ['Santa Monica', 'Hollywood']),
  LGA: a('LGA', 'New York LaGuardia', 'LaGuardia', 40.7769, -73.8740, 'US', ['Manhattan', 'Queens']),
  MCO: a('MCO', 'Orlando', 'Orlando International', 28.4312, -81.3081, 'US', ['International Drive', 'Disney']),
  MIA: a('MIA', 'Miami', 'Miami International', 25.7959, -80.2870, 'US', ['South Beach', 'Brickell']),
  MSP: a('MSP', 'Minneapolis', 'Minneapolis-St Paul International', 44.8848, -93.2223, 'US', ['Mall of America', 'St Paul']),
  ORD: a('ORD', 'Chicago', "O'Hare International", 41.9742, -87.9073, 'US', ['River North', 'Loop']),
  PHL: a('PHL', 'Philadelphia', 'Philadelphia International', 39.8729, -75.2437, 'US', ['Center City', 'Old City']),
  PHX: a('PHX', 'Phoenix', 'Phoenix Sky Harbor', 33.4373, -112.0078, 'US', ['Scottsdale', 'Tempe']),
  SEA: a('SEA', 'Seattle', 'Seattle-Tacoma International', 47.4502, -122.3088, 'US', ['Capitol Hill', 'Bellevue']),
  SFO: a('SFO', 'San Francisco', 'San Francisco International', 37.6213, -122.3790, 'US', ['Mission', 'SOMA']),
  SLC: a('SLC', 'Salt Lake City', 'Salt Lake City International', 40.7899, -111.9791, 'US', ['Sugar House', 'Park City']),
  TPA: a('TPA', 'Tampa', 'Tampa International', 27.9756, -82.5333, 'US', ['Ybor City', 'Clearwater']),

  // US SECONDARY
  ABQ: a('ABQ', 'Albuquerque', 'Albuquerque Sunport', 35.0402, -106.6090, 'US', ['Old Town', 'Nob Hill']),
  ANC: a('ANC', 'Anchorage', 'Ted Stevens Anchorage International', 61.1743, -149.9962, 'US'),
  AUS: a('AUS', 'Austin', 'Austin-Bergstrom International', 30.1975, -97.6664, 'US', ['6th Street', 'South Congress']),
  BDL: a('BDL', 'Hartford', 'Bradley International', 41.9389, -72.6832, 'US', ['West Hartford']),
  BHM: a('BHM', 'Birmingham', 'Birmingham-Shuttlesworth International', 33.5629, -86.7535, 'US', ['Five Points']),
  BNA: a('BNA', 'Nashville', 'Nashville International', 36.1263, -86.6774, 'US', ['Broadway', 'The Gulch']),
  BTV: a('BTV', 'Burlington', 'Burlington International', 44.4719, -73.1533, 'US', ['Church Street']),
  BUF: a('BUF', 'Buffalo', 'Buffalo Niagara International', 42.9405, -78.7322, 'US', ['Elmwood']),
  BUR: a('BUR', 'Burbank', 'Hollywood Burbank', 34.2005, -118.3585, 'US', ['North Hollywood']),
  BWI: a('BWI', 'Baltimore', 'Baltimore-Washington International', 39.1754, -76.6683, 'US', ['Inner Harbor', 'Fells Point']),
  CHS: a('CHS', 'Charleston SC', 'Charleston International', 32.8986, -80.0405, 'US', ['King Street', 'Mount Pleasant']),
  CLE: a('CLE', 'Cleveland', 'Cleveland Hopkins International', 41.4117, -81.8498, 'US', ['Ohio City', 'Tremont']),
  CMH: a('CMH', 'Columbus', 'John Glenn Columbus International', 39.9980, -82.8919, 'US', ['Short North', 'German Village']),
  CVG: a('CVG', 'Cincinnati', 'Cincinnati/Northern Kentucky International', 39.0488, -84.6678, 'US', ['Over-the-Rhine']),
  DAL: a('DAL', 'Dallas Love Field', 'Dallas Love Field', 32.8471, -96.8518, 'US', ['Uptown', 'Oak Lawn']),
  DSM: a('DSM', 'Des Moines', 'Des Moines International', 41.5341, -93.6631, 'US', ['East Village']),
  ELP: a('ELP', 'El Paso', 'El Paso International', 31.8072, -106.3778, 'US'),
  GRR: a('GRR', 'Grand Rapids', 'Gerald R Ford International', 42.8808, -85.5228, 'US', ['East Hills']),
  GSO: a('GSO', 'Greensboro', 'Piedmont Triad International', 36.0978, -79.9373, 'US'),
  GSP: a('GSP', 'Greenville SC', 'Greenville-Spartanburg International', 34.8957, -82.2189, 'US', ['Falls Park', 'Main Street']),
  HNL: a('HNL', 'Honolulu', 'Daniel K Inouye International', 21.3187, -157.9225, 'US', ['Waikiki', 'Ala Moana']),
  HOU: a('HOU', 'Houston Hobby', 'William P Hobby', 29.6454, -95.2789, 'US', ['Montrose']),
  IND: a('IND', 'Indianapolis', 'Indianapolis International', 39.7173, -86.2944, 'US', ['Mass Ave', 'Broad Ripple']),
  JAX: a('JAX', 'Jacksonville', 'Jacksonville International', 30.4941, -81.6879, 'US', ['San Marco', 'Riverside']),
  KOA: a('KOA', 'Kona', 'Ellison Onizuka Kona International', 19.7388, -156.0456, 'US', ['Kailua-Kona']),
  LIH: a('LIH', 'Lihue', 'Lihue Airport', 21.9760, -159.3389, 'US', ['Poipu', 'Kapaa']),
  LIT: a('LIT', 'Little Rock', 'Clinton National', 34.7294, -92.2243, 'US', ['River Market']),
  MCI: a('MCI', 'Kansas City', 'Kansas City International', 39.2976, -94.7139, 'US', ['Power & Light', 'Westport']),
  MDW: a('MDW', 'Chicago Midway', 'Chicago Midway', 41.7868, -87.7522, 'US', ['Chinatown']),
  MEM: a('MEM', 'Memphis', 'Memphis International', 35.0424, -89.9767, 'US', ['Beale Street']),
  MKE: a('MKE', 'Milwaukee', 'General Mitchell International', 42.9472, -87.8966, 'US', ['Third Ward']),
  MSY: a('MSY', 'New Orleans', 'Louis Armstrong New Orleans International', 29.9934, -90.2580, 'US', ['French Quarter', 'Garden District']),
  MYR: a('MYR', 'Myrtle Beach', 'Myrtle Beach International', 33.6797, -78.9283, 'US', ['The Strip']),
  OAK: a('OAK', 'Oakland', 'Oakland International', 37.7213, -122.2208, 'US', ['Jack London Square']),
  OGG: a('OGG', 'Maui', 'Kahului Airport', 20.8986, -156.4305, 'US', ['Lahaina', 'Wailea', 'Kihei']),
  OKC: a('OKC', 'Oklahoma City', 'Will Rogers World', 35.3931, -97.6007, 'US', ['Bricktown']),
  OMA: a('OMA', 'Omaha', 'Eppley Airfield', 41.3032, -95.8941, 'US', ['Old Market']),
  ONT: a('ONT', 'Ontario CA', 'Ontario International', 34.0560, -117.6012, 'US', ['Rancho Cucamonga']),
  PBI: a('PBI', 'West Palm Beach', 'Palm Beach International', 26.6832, -80.0956, 'US', ['City Place']),
  PDX: a('PDX', 'Portland', 'Portland International', 45.5898, -122.5951, 'US', ['Pearl District', 'Alberta']),
  PIT: a('PIT', 'Pittsburgh', 'Pittsburgh International', 40.4915, -80.2329, 'US', ['Strip District', 'South Side']),
  PVD: a('PVD', 'Providence', 'TF Green International', 41.7240, -71.4282, 'US', ['Federal Hill']),
  RDU: a('RDU', 'Raleigh-Durham', 'Raleigh-Durham International', 35.8776, -78.7875, 'US', ['Durham', 'Chapel Hill']),
  RIC: a('RIC', 'Richmond', 'Richmond International', 37.5052, -77.3197, 'US', ['The Fan', 'Carytown']),
  RNO: a('RNO', 'Reno', 'Reno-Tahoe International', 39.4991, -119.7681, 'US', ['Lake Tahoe']),
  ROC: a('ROC', 'Rochester NY', 'Greater Rochester International', 43.1189, -77.6724, 'US'),
  RSW: a('RSW', 'Fort Myers', 'Southwest Florida International', 26.5362, -81.7552, 'US', ['Naples']),
  SAN: a('SAN', 'San Diego', 'San Diego International', 32.7336, -117.1897, 'US', ['Gaslamp', 'La Jolla']),
  SAT: a('SAT', 'San Antonio', 'San Antonio International', 29.5337, -98.4698, 'US', ['River Walk', 'Pearl']),
  SAV: a('SAV', 'Savannah', 'Savannah/Hilton Head International', 32.1276, -81.2021, 'US', ['Historic District']),
  SDF: a('SDF', 'Louisville', 'Louisville Muhammad Ali International', 38.1744, -85.7360, 'US', ['NuLu', 'Highlands']),
  SJC: a('SJC', 'San Jose', 'Norman Y Mineta San Jose International', 37.3626, -121.9290, 'US', ['Santana Row']),
  SJU: a('SJU', 'San Juan', 'Luis Muñoz Marín International', 18.4394, -66.0018, 'PR', ['Old San Juan', 'Condado']),
  SMF: a('SMF', 'Sacramento', 'Sacramento International', 38.6954, -121.5908, 'US', ['Midtown']),
  SNA: a('SNA', 'Orange County', 'John Wayne Airport', 33.6762, -117.8682, 'US', ['Newport Beach']),
  STL: a('STL', 'St Louis', 'St Louis Lambert International', 38.7487, -90.3700, 'US', ['The Hill', 'Downtown']),
  TUS: a('TUS', 'Tucson', 'Tucson International', 32.1161, -110.9410, 'US', ['Downtown']),
  
  // US SMALLER
  AVL: a('AVL', 'Asheville', 'Asheville Regional', 35.4362, -82.5418, 'US', ['Downtown']),
  BDL: a('BDL', 'Hartford', 'Bradley International', 41.9389, -72.6832, 'US', ['West Hartford']),
  BGR: a('BGR', 'Bangor', 'Bangor International', 44.8074, -68.8281, 'US'),
  BIL: a('BIL', 'Billings', 'Billings Logan International', 45.8077, -108.5430, 'US'),
  BOI: a('BOI', 'Boise', 'Boise Air Terminal', 43.5644, -116.2228, 'US', ['Downtown']),
  BTR: a('BTR', 'Baton Rouge', 'Baton Rouge Metropolitan', 30.5332, -91.1496, 'US'),
  CAE: a('CAE', 'Columbia SC', 'Columbia Metropolitan', 33.9388, -81.1195, 'US', ['Five Points']),
  CAK: a('CAK', 'Akron', 'Akron-Canton Airport', 40.9161, -81.4422, 'US'),
  CHA: a('CHA', 'Chattanooga', 'Chattanooga Metropolitan', 35.0354, -85.2038, 'US', ['Riverfront']),
  CHS: a('CHS', 'Charleston SC', 'Charleston International', 32.8986, -80.0405, 'US', ['King Street', 'Mount Pleasant']),
  CID: a('CID', 'Cedar Rapids', 'Eastern Iowa Airport', 41.8847, -91.7108, 'US'),
  COS: a('COS', 'Colorado Springs', 'Colorado Springs Airport', 38.8058, -104.7004, 'US', ['Old Colorado City']),
  CRW: a('CRW', 'Charleston WV', 'Yeager Airport', 38.3731, -81.5932, 'US'),
  DAB: a('DAB', 'Daytona Beach', 'Daytona Beach International', 29.1799, -81.0581, 'US', ['Beach Street']),
  DAY: a('DAY', 'Dayton', 'James M Cox Dayton International', 39.9024, -84.2194, 'US'),
  FAI: a('FAI', 'Fairbanks', 'Fairbanks International', 64.8151, -147.8561, 'US'),
  FAR: a('FAR', 'Fargo', 'Hector International', 46.9207, -96.8158, 'US'),
  FAY: a('FAY', 'Fayetteville NC', 'Fayetteville Regional', 34.9912, -78.8803, 'US'),
  FSD: a('FSD', 'Sioux Falls', 'Sioux Falls Regional', 43.5820, -96.7420, 'US'),
  GEG: a('GEG', 'Spokane', 'Spokane International', 47.6199, -117.5339, 'US', ['Downtown']),
  GPT: a('GPT', 'Gulfport', 'Gulfport-Biloxi International', 30.4073, -89.0701, 'US'),
  GRB: a('GRB', 'Green Bay', 'Green Bay Austin Straubel International', 44.4851, -88.1296, 'US'),
  GRR: a('GRR', 'Grand Rapids', 'Gerald R Ford International', 42.8808, -85.5228, 'US', ['East Hills']),
  GSO: a('GSO', 'Greensboro', 'Piedmont Triad International', 36.0978, -79.9373, 'US'),
  GSP: a('GSP', 'Greenville SC', 'Greenville-Spartanburg International', 34.8957, -82.2189, 'US', ['Falls Park', 'Main Street']),
  HPN: a('HPN', 'White Plains', 'Westchester County Airport', 41.0670, -73.7077, 'US'),
  HSV: a('HSV', 'Huntsville', 'Huntsville International', 34.6372, -86.7751, 'US'),
  ICT: a('ICT', 'Wichita', 'Wichita Dwight D Eisenhower National', 37.6499, -97.4331, 'US'),
  ILM: a('ILM', 'Wilmington NC', 'Wilmington International', 34.2706, -77.9026, 'US', ['Riverwalk']),
  JAN: a('JAN', 'Jackson MS', 'Jackson-Medgar Wiley Evers International', 32.3112, -90.0759, 'US'),
  LBB: a('LBB', 'Lubbock', 'Lubbock Preston Smith International', 33.6636, -101.8228, 'US'),
  LEX: a('LEX', 'Lexington', 'Blue Grass Airport', 38.0365, -84.6059, 'US', ['Downtown']),
  LGB: a('LGB', 'Long Beach', 'Long Beach Airport', 33.8177, -118.1516, 'US', ['2nd Street']),
  MAF: a('MAF', 'Midland', 'Midland International Air and Space Port', 31.9425, -102.2019, 'US'),
  MHT: a('MHT', 'Manchester NH', 'Manchester-Boston Regional', 42.9326, -71.4357, 'US'),
  MLB: a('MLB', 'Melbourne FL', 'Melbourne Orlando International', 28.1028, -80.6453, 'US'),
  MOB: a('MOB', 'Mobile', 'Mobile Regional', 30.6913, -88.2428, 'US', ['Downtown']),
  MSN: a('MSN', 'Madison', 'Dane County Regional', 43.1399, -89.3375, 'US', ['State Street']),
  OKC: a('OKC', 'Oklahoma City', 'Will Rogers World', 35.3931, -97.6007, 'US', ['Bricktown']),
  OMA: a('OMA', 'Omaha', 'Eppley Airfield', 41.3032, -95.8941, 'US', ['Old Market']),
  ORF: a('ORF', 'Norfolk', 'Norfolk International', 36.8946, -76.2012, 'US', ['Ghent']),
  PNS: a('PNS', 'Pensacola', 'Pensacola International', 30.4734, -87.1866, 'US', ['Downtown']),
  PSP: a('PSP', 'Palm Springs', 'Palm Springs International', 33.8297, -116.5067, 'US', ['Downtown']),
  PWM: a('PWM', 'Portland ME', 'Portland International Jetport', 43.6462, -70.3093, 'US', ['Old Port']),
  RFD: a('RFD', 'Rockford', 'Chicago Rockford International', 42.1954, -89.0972, 'US'),
  SBN: a('SBN', 'South Bend', 'South Bend International', 41.7087, -86.3173, 'US', ['Notre Dame']),
  TLH: a('TLH', 'Tallahassee', 'Tallahassee International', 30.3965, -84.3503, 'US'),
  TYS: a('TYS', 'Knoxville', 'McGhee Tyson Airport', 35.8110, -83.9940, 'US', ['Market Square']),
  VPS: a('VPS', 'Destin-Fort Walton', 'Destin-Fort Walton Beach Airport', 30.4832, -86.5254, 'US', ['Destin']),
  XNA: a('XNA', 'Northwest Arkansas', 'Northwest Arkansas National', 36.2819, -94.3068, 'US', ['Bentonville', 'Fayetteville']),

  // CARIBBEAN & MEXICO
  CUN: a('CUN', 'Cancun', 'Cancún International', 21.0365, -86.8771, 'MX', ['Hotel Zone', 'Playa del Carmen']),
  GDL: a('GDL', 'Guadalajara', 'Guadalajara International', 20.5218, -103.3111, 'MX', ['Centro Historico']),
  MEX: a('MEX', 'Mexico City', 'Mexico City International', 19.4363, -99.0721, 'MX', ['Roma Norte', 'Condesa', 'Polanco']),
  NAS: a('NAS', 'Nassau', 'Lynden Pindling International', 25.0390, -77.4662, 'BS', ['Paradise Island']),
  PUJ: a('PUJ', 'Punta Cana', 'Punta Cana International', 18.5674, -68.3634, 'DO', ['Bavaro']),
  SJO: a('SJO', 'San Jose CR', 'Juan Santamaría International', 9.9939, -84.2088, 'CR', ['Escazú']),

  // CANADA
  YUL: a('YUL', 'Montreal', 'Montreal-Trudeau International', 45.4706, -73.7408, 'CA', ['Old Montreal', 'Plateau']),
  YVR: a('YVR', 'Vancouver', 'Vancouver International', 49.1967, -123.1815, 'CA', ['Gastown', 'Granville Island']),
  YYC: a('YYC', 'Calgary', 'Calgary International', 51.1215, -114.0076, 'CA', ['Kensington']),
  YYZ: a('YYZ', 'Toronto', 'Toronto Pearson International', 43.6777, -79.6248, 'CA', ['Yorkville', 'Distillery']),

  // EUROPE
  AMS: a('AMS', 'Amsterdam', 'Amsterdam Schiphol', 52.3105, 4.7683, 'NL', ['Jordaan', 'De Pijp']),
  ARN: a('ARN', 'Stockholm', 'Stockholm Arlanda', 59.6519, 17.9186, 'SE', ['Gamla Stan']),
  ATH: a('ATH', 'Athens', 'Athens International', 37.9364, 23.9445, 'GR', ['Plaka', 'Monastiraki']),
  BCN: a('BCN', 'Barcelona', 'Barcelona-El Prat', 41.2971, 2.0785, 'ES', ['Gothic Quarter', 'Eixample']),
  BRU: a('BRU', 'Brussels', 'Brussels Airport', 50.9014, 4.4844, 'BE', ['Grand Place']),
  CDG: a('CDG', 'Paris CDG', 'Paris Charles de Gaulle', 49.0097, 2.5479, 'FR', ['Le Marais', 'Montmartre']),
  CPH: a('CPH', 'Copenhagen', 'Copenhagen Airport', 55.6181, 12.6560, 'DK', ['Nyhavn', 'Tivoli']),
  DUB: a('DUB', 'Dublin', 'Dublin Airport', 53.4264, -6.2499, 'IE', ['Temple Bar']),
  EDI: a('EDI', 'Edinburgh', 'Edinburgh Airport', 55.9500, -3.3725, 'GB', ['Old Town', 'Royal Mile']),
  FCO: a('FCO', 'Rome', 'Rome Fiumicino', 41.8003, 12.2389, 'IT', ['Trastevere', 'Vatican']),
  FRA: a('FRA', 'Frankfurt', 'Frankfurt Airport', 50.0379, 8.5622, 'DE', ['Sachsenhausen']),
  LGW: a('LGW', 'London Gatwick', 'London Gatwick', 51.1537, -0.1821, 'GB', ['Central London']),
  LHR: a('LHR', 'London Heathrow', 'London Heathrow', 51.4700, -0.4543, 'GB', ['Westminster', 'Soho']),
  LIS: a('LIS', 'Lisbon', 'Lisbon Airport', 38.7813, -9.1359, 'PT', ['Alfama', 'Bairro Alto']),
  MAD: a('MAD', 'Madrid', 'Madrid Barajas', 40.4983, -3.5676, 'ES', ['Centro', 'Salamanca']),
  MAN: a('MAN', 'Manchester UK', 'Manchester Airport', 53.3588, -2.2727, 'GB', ['Northern Quarter']),
  MUC: a('MUC', 'Munich', 'Munich Airport', 48.3537, 11.7750, 'DE', ['Marienplatz']),
  ORY: a('ORY', 'Paris Orly', 'Paris Orly', 48.7262, 2.3652, 'FR', ['Latin Quarter']),
  VIE: a('VIE', 'Vienna', 'Vienna International', 48.1103, 16.5697, 'AT', ['Innere Stadt']),
  ZRH: a('ZRH', 'Zurich', 'Zurich Airport', 47.4647, 8.5492, 'CH', ['Old Town']),

  // ASIA PACIFIC
  BKK: a('BKK', 'Bangkok', 'Suvarnabhumi Airport', 13.6900, 100.7501, 'TH', ['Sukhumvit', 'Silom']),
  DEL: a('DEL', 'New Delhi', 'Indira Gandhi International', 28.5562, 77.1000, 'IN', ['Connaught Place']),
  DXB: a('DXB', 'Dubai', 'Dubai International', 25.2532, 55.3657, 'AE', ['Dubai Marina', 'Jumeirah']),
  HKG: a('HKG', 'Hong Kong', 'Hong Kong International', 22.3080, 113.9185, 'HK', ['Central', 'Tsim Sha Tsui']),
  HND: a('HND', 'Tokyo Haneda', 'Tokyo Haneda', 35.5494, 139.7798, 'JP', ['Shibuya', 'Shinjuku']),
  ICN: a('ICN', 'Seoul', 'Incheon International', 37.4602, 126.4407, 'KR', ['Myeongdong', 'Gangnam']),
  KIX: a('KIX', 'Osaka', 'Kansai International', 34.4347, 135.2441, 'JP', ['Namba', 'Dotonbori']),
  MNL: a('MNL', 'Manila', 'Ninoy Aquino International', 14.5086, 121.0197, 'PH', ['Makati', 'BGC']),
  NRT: a('NRT', 'Tokyo Narita', 'Narita International', 35.7720, 140.3929, 'JP', ['Shinjuku', 'Ginza']),
  PEK: a('PEK', 'Beijing', 'Beijing Capital International', 40.0799, 116.6031, 'CN', ['Forbidden City']),
  PVG: a('PVG', 'Shanghai', 'Shanghai Pudong International', 31.1443, 121.8083, 'CN', ['The Bund']),
  SIN: a('SIN', 'Singapore', 'Singapore Changi', 1.3644, 103.9915, 'SG', ['Marina Bay', 'Orchard']),
  SYD: a('SYD', 'Sydney', 'Sydney Kingsford Smith', -33.9399, 151.1753, 'AU', ['Darling Harbour', 'Bondi']),
  TPE: a('TPE', 'Taipei', 'Taiwan Taoyuan International', 25.0797, 121.2342, 'TW', ['Ximending']),

  // MIDDLE EAST & AFRICA
  AUH: a('AUH', 'Abu Dhabi', 'Abu Dhabi International', 24.4330, 54.6511, 'AE', ['Corniche', 'Yas Island']),
  CAI: a('CAI', 'Cairo', 'Cairo International', 30.1219, 31.4056, 'EG', ['Zamalek', 'Giza']),
  CPT: a('CPT', 'Cape Town', 'Cape Town International', -33.9715, 18.6021, 'ZA', ['V&A Waterfront']),
  DOH: a('DOH', 'Doha', 'Hamad International', 25.2731, 51.6081, 'QA', ['Souq Waqif', 'The Pearl']),
  JNB: a('JNB', 'Johannesburg', 'OR Tambo International', -26.1367, 28.2411, 'ZA', ['Sandton']),
  TLV: a('TLV', 'Tel Aviv', 'Ben Gurion Airport', 32.0055, 34.8854, 'IL', ['Jaffa', 'Rothschild']),
};

// Search airports by code, city name, or airport name
// Optionally accepts lat/lon for GPS-based recommendations
export function searchAirports(lat?: number, lon?: number, query?: string): AirportData[] {
  // If lat/lon provided but no query, return nearby airports
  if (lat !== undefined && lon !== undefined && (!query || query === '')) {
    return Object.values(AIRPORTS)
      .map(airport => ({
        airport,
        distance: Math.sqrt(
          Math.pow(airport.lat - lat, 2) + 
          Math.pow(airport.lng - lon, 2)
        )
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10)
      .map(item => item.airport);
  }
  
  // Otherwise, search by query
  const q = (query || '').toUpperCase().trim();
  if (!q) return [];
  
  // Exact code match first
  if (AIRPORTS[q]) return [AIRPORTS[q]];
  
  // Search by partial code, city name, or full name
  return Object.values(AIRPORTS)
    .filter(airport => 
      airport.code.includes(q) ||
      airport.name.toUpperCase().includes(q) ||
      airport.fullName.toUpperCase().includes(q)
    )
    .slice(0, 10);
}

// Get airport by exact code
export function getAirportByCode(code: string): AirportData | null {
  return AIRPORTS[code.toUpperCase().trim()] || null;
}

// Check if airport exists
export function airportExists(code: string): boolean {
  return !!AIRPORTS[code.toUpperCase().trim()];
}

// Get all airports
export function getAllAirports(): AirportData[] {
  return Object.values(AIRPORTS).sort((a, b) => a.code.localeCompare(b.code));
}
