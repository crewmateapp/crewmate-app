// utils/airportData.ts - Comprehensive airport database for CrewMate
// ~400 airports covering major crew layover destinations worldwide

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

  // ═══════════════════════════════════════════════════════════════
  // US MAJOR HUBS
  // ═══════════════════════════════════════════════════════════════
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
  MSP: a('MSP', 'Minneapolis—St. Paul', 'Minneapolis-St Paul International', 44.8848, -93.2223, 'US', ['Mall of America', 'St Paul']),
  ORD: a('ORD', 'Chicago', "O'Hare International", 41.9742, -87.9073, 'US', ['River North', 'Loop']),
  PHL: a('PHL', 'Philadelphia', 'Philadelphia International', 39.8729, -75.2437, 'US', ['Center City', 'Old City']),
  PHX: a('PHX', 'Phoenix', 'Phoenix Sky Harbor', 33.4373, -112.0078, 'US', ['Scottsdale', 'Tempe']),
  SEA: a('SEA', 'Seattle', 'Seattle-Tacoma International', 47.4502, -122.3088, 'US', ['Capitol Hill', 'Bellevue']),
  SFO: a('SFO', 'San Francisco', 'San Francisco International', 37.6213, -122.3790, 'US', ['Mission', 'SOMA']),
  SLC: a('SLC', 'Salt Lake City', 'Salt Lake City International', 40.7899, -111.9791, 'US', ['Sugar House', 'Park City']),
  TPA: a('TPA', 'Tampa', 'Tampa International', 27.9756, -82.5333, 'US', ['Ybor City', 'Clearwater']),

  // ═══════════════════════════════════════════════════════════════
  // US SECONDARY
  // ═══════════════════════════════════════════════════════════════
  ABQ: a('ABQ', 'Albuquerque', 'Albuquerque Sunport', 35.0402, -106.6090, 'US', ['Old Town', 'Nob Hill']),
  ANC: a('ANC', 'Anchorage', 'Ted Stevens Anchorage International', 61.1743, -149.9962, 'US'),
  AUS: a('AUS', 'Austin', 'Austin-Bergstrom International', 30.1975, -97.6664, 'US', ['6th Street', 'South Congress']),
  BNA: a('BNA', 'Nashville', 'Nashville International', 36.1263, -86.6774, 'US', ['Broadway', 'The Gulch']),
  BUF: a('BUF', 'Buffalo', 'Buffalo Niagara International', 42.9405, -78.7322, 'US', ['Elmwood']),
  BUR: a('BUR', 'Burbank', 'Hollywood Burbank', 34.2005, -118.3585, 'US', ['North Hollywood']),
  BWI: a('BWI', 'Baltimore', 'Baltimore-Washington International', 39.1754, -76.6683, 'US', ['Inner Harbor', 'Fells Point']),
  CHS: a('CHS', 'Charleston SC', 'Charleston International', 32.8986, -80.0405, 'US', ['King Street', 'Mount Pleasant']),
  CLE: a('CLE', 'Cleveland', 'Cleveland Hopkins International', 41.4117, -81.8498, 'US', ['Ohio City', 'Tremont']),
  CMH: a('CMH', 'Columbus', 'John Glenn Columbus International', 39.9980, -82.8919, 'US', ['Short North', 'German Village']),
  CVG: a('CVG', 'Cincinnati', 'Cincinnati/Northern Kentucky International', 39.0488, -84.6678, 'US', ['Over-the-Rhine']),
  DAL: a('DAL', 'Dallas Love Field', 'Dallas Love Field', 32.8471, -96.8518, 'US', ['Uptown', 'Oak Lawn']),
  HNL: a('HNL', 'Honolulu', 'Daniel K Inouye International', 21.3187, -157.9225, 'US', ['Waikiki', 'Ala Moana']),
  HOU: a('HOU', 'Houston Hobby', 'William P Hobby', 29.6454, -95.2789, 'US', ['Montrose']),
  IND: a('IND', 'Indianapolis', 'Indianapolis International', 39.7173, -86.2944, 'US', ['Mass Ave', 'Broad Ripple']),
  JAX: a('JAX', 'Jacksonville', 'Jacksonville International', 30.4941, -81.6879, 'US', ['San Marco', 'Riverside']),
  KOA: a('KOA', 'Kona', 'Ellison Onizuka Kona International', 19.7388, -156.0456, 'US', ['Kailua-Kona']),
  LIH: a('LIH', 'Lihue', 'Lihue Airport', 21.9760, -159.3389, 'US', ['Poipu', 'Kapaa']),
  MCI: a('MCI', 'Kansas City', 'Kansas City International', 39.2976, -94.7139, 'US', ['Power & Light', 'Westport']),
  MDW: a('MDW', 'Chicago Midway', 'Chicago Midway', 41.7868, -87.7522, 'US', ['Chinatown']),
  MEM: a('MEM', 'Memphis', 'Memphis International', 35.0424, -89.9767, 'US', ['Beale Street']),
  MKE: a('MKE', 'Milwaukee', 'General Mitchell International', 42.9472, -87.8966, 'US', ['Third Ward']),
  MSY: a('MSY', 'New Orleans', 'Louis Armstrong New Orleans International', 29.9934, -90.2580, 'US', ['French Quarter', 'Garden District']),
  OAK: a('OAK', 'Oakland', 'Oakland International', 37.7213, -122.2208, 'US', ['Jack London Square']),
  OGG: a('OGG', 'Maui', 'Kahului Airport', 20.8986, -156.4305, 'US', ['Lahaina', 'Wailea', 'Kihei']),
  ONT: a('ONT', 'Ontario CA', 'Ontario International', 34.0560, -117.6012, 'US', ['Rancho Cucamonga']),
  PBI: a('PBI', 'West Palm Beach', 'Palm Beach International', 26.6832, -80.0956, 'US', ['City Place']),
  PDX: a('PDX', 'Portland', 'Portland International', 45.5898, -122.5951, 'US', ['Pearl District', 'Alberta']),
  PIT: a('PIT', 'Pittsburgh', 'Pittsburgh International', 40.4915, -80.2329, 'US', ['Strip District', 'South Side']),
  RDU: a('RDU', 'Raleigh—Durham', 'Raleigh-Durham International', 35.8776, -78.7875, 'US', ['Durham', 'Chapel Hill']),
  RSW: a('RSW', 'Fort Myers', 'Southwest Florida International', 26.5362, -81.7552, 'US', ['Naples']),
  SAN: a('SAN', 'San Diego', 'San Diego International', 32.7336, -117.1897, 'US', ['Gaslamp', 'La Jolla']),
  SAT: a('SAT', 'San Antonio', 'San Antonio International', 29.5337, -98.4698, 'US', ['River Walk', 'Pearl']),
  SBA: a('SBA', 'Santa Barbara', 'Santa Barbara Airport', 34.4262, -119.8415, 'US', ['Funk Zone', 'State Street']),
  SDF: a('SDF', 'Louisville', 'Louisville Muhammad Ali International', 38.1744, -85.7360, 'US', ['NuLu', 'Highlands']),
  SJC: a('SJC', 'San Jose', 'Norman Y Mineta San Jose International', 37.3626, -121.9290, 'US', ['Santana Row']),
  SJU: a('SJU', 'San Juan', 'Luis Muñoz Marín International', 18.4394, -66.0018, 'PR', ['Old San Juan', 'Condado']),
  SMF: a('SMF', 'Sacramento', 'Sacramento International', 38.6954, -121.5908, 'US', ['Midtown']),
  SNA: a('SNA', 'Orange County', 'John Wayne Airport', 33.6762, -117.8682, 'US', ['Newport Beach']),
  STL: a('STL', 'St Louis', 'St Louis Lambert International', 38.7487, -90.3700, 'US', ['The Hill', 'Downtown']),

  // ═══════════════════════════════════════════════════════════════
  // US SMALLER / REGIONAL
  // ═══════════════════════════════════════════════════════════════
  ACY: a('ACY', 'Atlantic City', 'Atlantic City International', 39.4576, -74.5772, 'US', ['Boardwalk']),
  ALB: a('ALB', 'Albany', 'Albany International', 42.7483, -73.8017, 'US'),
  AMA: a('AMA', 'Amarillo', 'Rick Husband Amarillo International', 35.2194, -101.7059, 'US', ['Route 66 District']),
  AVL: a('AVL', 'Asheville', 'Asheville Regional', 35.4362, -82.5418, 'US', ['Downtown']),
  AVP: a('AVP', 'Scranton', 'Wilkes-Barre/Scranton International', 41.3385, -75.7234, 'US', ['Downtown Scranton']),
  BDL: a('BDL', 'Hartford', 'Bradley International', 41.9389, -72.6832, 'US', ['West Hartford']),
  BGR: a('BGR', 'Bangor', 'Bangor International', 44.8074, -68.8281, 'US'),
  BHM: a('BHM', 'Birmingham', 'Birmingham-Shuttlesworth International', 33.5629, -86.7535, 'US', ['Five Points']),
  BIL: a('BIL', 'Billings', 'Billings Logan International', 45.8077, -108.5430, 'US'),
  BFL: a('BFL', 'Bakersfield', 'Meadows Field', 35.4336, -119.0568, 'US'),
  BOI: a('BOI', 'Boise', 'Boise Air Terminal', 43.5644, -116.2228, 'US', ['Downtown']),
  BTR: a('BTR', 'Baton Rouge', 'Baton Rouge Metropolitan', 30.5332, -91.1496, 'US'),
  BTV: a('BTV', 'Burlington', 'Burlington International', 44.4719, -73.1533, 'US', ['Church Street']),
  BZN: a('BZN', 'Bozeman', 'Bozeman Yellowstone International', 45.7775, -111.1530, 'US'),
  CAE: a('CAE', 'Columbia SC', 'Columbia Metropolitan', 33.9388, -81.1195, 'US', ['Five Points']),
  CAK: a('CAK', 'Akron', 'Akron-Canton Airport', 40.9161, -81.4422, 'US'),
  CID: a('CID', 'Cedar Rapids', 'The Eastern Iowa Airport', 41.8847, -91.7108, 'US'),
  COS: a('COS', 'Colorado Springs', 'Colorado Springs Airport', 38.8058, -104.7008, 'US', ['Old Colorado City']),
  CRP: a('CRP', 'Corpus Christi', 'Corpus Christi International', 27.7704, -97.5012, 'US'),
  DAY: a('DAY', 'Dayton', 'Dayton International', 39.9024, -84.2194, 'US'),
  DAB: a('DAB', 'Daytona Beach', 'Daytona Beach International', 29.1799, -81.0581, 'US', ['Boardwalk']),
  DSM: a('DSM', 'Des Moines', 'Des Moines International', 41.5341, -93.6631, 'US', ['East Village']),
  ELP: a('ELP', 'El Paso', 'El Paso International', 31.8072, -106.3778, 'US'),
  EUG: a('EUG', 'Eugene', 'Mahlon Sweet Field', 44.1246, -123.2119, 'US'),
  ECP: a('ECP', 'Panama City Beach', 'Northwest Florida Beaches International', 30.3571, -85.7956, 'US', ['Pier Park']),
  EGE: a('EGE', 'Eagle-Vail', 'Eagle County Regional', 39.6426, -106.9176, 'US', ['Vail', 'Beaver Creek']),
  EYW: a('EYW', 'Key West', 'Key West International', 24.5561, -81.7596, 'US', ['Duval Street']),
  FAI: a('FAI', 'Fairbanks', 'Fairbanks International', 64.8151, -147.8561, 'US'),
  FAT: a('FAT', 'Fresno', 'Fresno Yosemite International', 36.7762, -119.7181, 'US'),
  FNT: a('FNT', 'Flint', 'Bishop International', 42.9654, -83.7436, 'US'),
  FSD: a('FSD', 'Sioux Falls', 'Joe Foss Field', 43.5820, -96.7419, 'US'),
  GEG: a('GEG', 'Spokane', 'Spokane International', 47.6199, -117.5338, 'US'),
  GPT: a('GPT', 'Gulfport', 'Gulfport-Biloxi International', 30.4073, -89.0701, 'US', ['Biloxi']),
  GRR: a('GRR', 'Grand Rapids', 'Gerald R Ford International', 42.8808, -85.5228, 'US', ['East Hills']),
  GSO: a('GSO', 'Greensboro', 'Piedmont Triad International', 36.0978, -79.9373, 'US'),
  GSP: a('GSP', 'Greenville SC', 'Greenville-Spartanburg International', 34.8957, -82.2189, 'US', ['Falls Park', 'Main Street']),
  HSV: a('HSV', 'Huntsville', 'Huntsville International', 34.6372, -86.7751, 'US'),
  ICT: a('ICT', 'Wichita', 'Wichita Eisenhower National', 37.6499, -97.4331, 'US'),
  ILM: a('ILM', 'Wilmington NC', 'Wilmington International', 34.2706, -77.9026, 'US', ['Riverwalk']),
  ITO: a('ITO', 'Hilo', 'Hilo International', 19.7214, -155.0484, 'US'),
  JAC: a('JAC', 'Jackson Hole', 'Jackson Hole Airport', 43.6073, -110.7377, 'US', ['Town Square']),
  LEX: a('LEX', 'Lexington', 'Blue Grass Airport', 38.0365, -84.6059, 'US', ['Horse Country']),
  LBB: a('LBB', 'Lubbock', 'Lubbock Preston Smith International', 33.6636, -101.8227, 'US'),
  LIT: a('LIT', 'Little Rock', 'Clinton National', 34.7294, -92.2243, 'US', ['River Market']),
  MFR: a('MFR', 'Medford', 'Rogue Valley International', 42.3742, -122.8735, 'US'),
  MDT: a('MDT', 'Harrisburg', 'Harrisburg International', 40.1935, -76.7634, 'US', ['Downtown']),
  MFE: a('MFE', 'McAllen', 'McAllen Miller International', 26.1758, -98.2386, 'US'),
  MHT: a('MHT', 'Manchester NH', 'Manchester-Boston Regional', 42.9326, -71.4357, 'US'),
  MOB: a('MOB', 'Mobile', 'Mobile Regional', 30.6914, -88.2428, 'US'),
  MLB: a('MLB', 'Melbourne FL', 'Orlando Melbourne International', 28.1028, -80.6453, 'US'),
  MRY: a('MRY', 'Monterey', 'Monterey Regional', 36.5870, -121.8430, 'US', ['Cannery Row']),
  MSN: a('MSN', 'Madison', 'Dane County Regional', 43.1399, -89.3375, 'US', ['Capitol Square']),
  MSO: a('MSO', 'Missoula', 'Missoula Montana Airport', 46.9163, -114.0906, 'US', ['Downtown']),
  MTJ: a('MTJ', 'Montrose', 'Montrose Regional', 38.5098, -107.8942, 'US', ['Telluride']),
  MYR: a('MYR', 'Myrtle Beach', 'Myrtle Beach International', 33.6797, -78.9283, 'US', ['The Strip']),
  OKC: a('OKC', 'Oklahoma City', 'Will Rogers World', 35.3931, -97.6007, 'US', ['Bricktown']),
  OMA: a('OMA', 'Omaha', 'Eppley Airfield', 41.3032, -95.8941, 'US', ['Old Market']),
  ORF: a('ORF', 'Norfolk', 'Norfolk International', 36.8946, -76.2012, 'US', ['Ghent']),
  PNS: a('PNS', 'Pensacola', 'Pensacola International', 30.4734, -87.1866, 'US', ['Palafox Street']),
  PSP: a('PSP', 'Palm Springs', 'Palm Springs International', 33.8297, -116.5067, 'US', ['Downtown']),
  PVD: a('PVD', 'Providence', 'TF Green International', 41.7240, -71.4282, 'US', ['Federal Hill']),
  PWM: a('PWM', 'Portland ME', 'Portland International Jetport', 43.6462, -70.3093, 'US', ['Old Port']),
  RIC: a('RIC', 'Richmond', 'Richmond International', 37.5052, -77.3197, 'US', ['The Fan', 'Carytown']),
  RNO: a('RNO', 'Reno', 'Reno-Tahoe International', 39.4991, -119.7681, 'US', ['Lake Tahoe']),
  ROC: a('ROC', 'Rochester NY', 'Greater Rochester International', 43.1189, -77.6724, 'US'),
  SAV: a('SAV', 'Savannah', 'Savannah/Hilton Head International', 32.1276, -81.2021, 'US', ['Historic District']),
  SBN: a('SBN', 'South Bend', 'South Bend International', 41.7087, -86.3173, 'US', ['Notre Dame']),
  SBP: a('SBP', 'San Luis Obispo', 'San Luis Obispo County Regional', 35.2368, -120.6424, 'US', ['Downtown']),
  SFB: a('SFB', 'Sanford', 'Orlando Sanford International', 28.7776, -81.2375, 'US'),
  SGF: a('SGF', 'Springfield MO', 'Springfield-Branson National', 37.2457, -93.3886, 'US'),
  SHV: a('SHV', 'Shreveport', 'Shreveport Regional', 32.4466, -93.8256, 'US'),
  SRQ: a('SRQ', 'Sarasota', 'Sarasota-Bradenton International', 27.3954, -82.5544, 'US', ['Siesta Key', 'St Armands']),
  SYR: a('SYR', 'Syracuse', 'Syracuse Hancock International', 43.1112, -76.1063, 'US'),
  TLH: a('TLH', 'Tallahassee', 'Tallahassee International', 30.3965, -84.3503, 'US'),
  TUL: a('TUL', 'Tulsa', 'Tulsa International', 36.1984, -95.8881, 'US', ['Blue Dome District']),
  TUS: a('TUS', 'Tucson', 'Tucson International', 32.1161, -110.9410, 'US', ['Downtown']),
  TYS: a('TYS', 'Knoxville', 'McGhee Tyson Airport', 35.8110, -83.9940, 'US', ['Market Square']),
  VPS: a('VPS', 'Destin-Fort Walton', 'Destin-Fort Walton Beach Airport', 30.4832, -86.5254, 'US', ['Destin']),
  XNA: a('XNA', 'Northwest Arkansas', 'Northwest Arkansas National', 36.2819, -94.3068, 'US', ['Bentonville', 'Fayetteville']),

  // US TERRITORIES & SPECIAL CODES
  GUM: a('GUM', 'Guam', 'Antonio B Won Pat International', 13.4834, 144.7960, 'GU', ['Tumon Bay']),
  NYC: a('NYC', 'New York City', 'New York City Metro', 40.7128, -74.0060, 'US', ['Manhattan', 'Brooklyn', 'Times Square']),
  STT: a('STT', 'St Thomas', 'Cyril E King Airport', 18.3373, -64.9734, 'VI', ['Charlotte Amalie']),
  STX: a('STX', 'St Croix', 'Henry E Rohlsen Airport', 17.7019, -64.7986, 'VI', ['Christiansted']),
  VQQ: a('VQQ', 'Jacksonville NAS', 'Jacksonville NAS', 30.2187, -81.8767, 'US', ['Jacksonville']),

  // ═══════════════════════════════════════════════════════════════
  // CANADA
  // ═══════════════════════════════════════════════════════════════
  YEG: a('YEG', 'Edmonton', 'Edmonton International', 53.3097, -113.5797, 'CA', ['Whyte Avenue']),
  YHZ: a('YHZ', 'Halifax', 'Halifax Stanfield International', 44.8808, -63.5085, 'CA', ['Waterfront']),
  YOW: a('YOW', 'Ottawa', 'Ottawa Macdonald-Cartier International', 45.3225, -75.6692, 'CA', ['ByWard Market']),
  YQB: a('YQB', 'Quebec City', 'Jean Lesage International', 46.7911, -71.3934, 'CA', ['Old Quebec']),
  YUL: a('YUL', 'Montreal', 'Montreal-Trudeau International', 45.4706, -73.7408, 'CA', ['Old Montreal', 'Plateau']),
  YVR: a('YVR', 'Vancouver', 'Vancouver International', 49.1967, -123.1815, 'CA', ['Gastown', 'Granville Island']),
  YWG: a('YWG', 'Winnipeg', 'Winnipeg James Armstrong Richardson International', 49.9100, -97.2399, 'CA', ['The Forks']),
  YYC: a('YYC', 'Calgary', 'Calgary International', 51.1215, -114.0076, 'CA', ['Kensington']),
  YYZ: a('YYZ', 'Toronto', 'Toronto Pearson International', 43.6777, -79.6248, 'CA', ['Yorkville', 'Distillery']),

  // ═══════════════════════════════════════════════════════════════
  // CARIBBEAN
  // ═══════════════════════════════════════════════════════════════
  ANU: a('ANU', 'Antigua', 'V.C. Bird International', 17.1367, -61.7926, 'AG', ['St Johns', 'English Harbour']),
  AUA: a('AUA', 'Aruba', 'Queen Beatrix International', 12.5014, -70.0152, 'AW', ['Palm Beach', 'Oranjestad']),
  BGI: a('BGI', 'Barbados', 'Grantley Adams International', 13.0746, -59.4925, 'BB', ['Bridgetown']),
  BDA: a('BDA', 'Bermuda', 'LF Wade International', 32.3640, -64.6787, 'BM', ['Hamilton']),
  CUR: a('CUR', 'Curaçao', 'Hato International', 12.1889, -68.9598, 'CW', ['Willemstad']),
  GCM: a('GCM', 'Grand Cayman', 'Owen Roberts International', 19.2928, -81.3577, 'KY', ['Seven Mile Beach']),
  GND: a('GND', 'Grenada', 'Maurice Bishop International', 12.0042, -61.7862, 'GD', ["St George's"]),
  KIN: a('KIN', 'Kingston', 'Norman Manley International', 17.9357, -76.7875, 'JM', ['New Kingston']),
  MBJ: a('MBJ', 'Montego Bay', 'Sangster International', 18.5037, -77.9134, 'JM', ['Hip Strip']),
  NAS: a('NAS', 'Nassau', 'Lynden Pindling International', 25.0390, -77.4662, 'BS', ['Paradise Island']),
  PBM: a('PBM', 'Paramaribo', 'Johan Adolf Pengel International', 5.4528, -55.1876, 'SR', ['Waterkant']),
  POS: a('POS', 'Port of Spain', 'Piarco International', 10.5954, -61.3372, 'TT', ['Port of Spain']),
  PTP: a('PTP', 'Guadeloupe', 'Pointe-à-Pitre International', 16.2653, -61.5318, 'GP'),
  PUJ: a('PUJ', 'Punta Cana', 'Punta Cana International', 18.5674, -68.3634, 'DO', ['Bavaro']),
  SDQ: a('SDQ', 'Santo Domingo', 'Las Américas International', 18.4297, -69.6689, 'DO', ['Zona Colonial', 'Piantini']),
  SKB: a('SKB', 'St Kitts', 'Robert L Bradshaw International', 17.3112, -62.7187, 'KN', ['Basseterre']),
  STI: a('STI', 'Santiago DR', 'Cibao International', 19.4061, -70.6047, 'DO', ['Monumento']),
  SVD: a('SVD', 'St Vincent', 'Argyle International', 13.1568, -61.1499, 'VC', ['Kingstown']),
  SXM: a('SXM', 'St Maarten', 'Princess Juliana International', 18.0410, -63.1089, 'SX', ['Philipsburg', 'Maho Beach']),
  UVF: a('UVF', 'St Lucia', 'Hewanorra International', 13.7332, -60.9526, 'LC', ['Rodney Bay']),

  // ═══════════════════════════════════════════════════════════════
  // MEXICO
  // ═══════════════════════════════════════════════════════════════
  ACA: a('ACA', 'Acapulco', 'General Juan N Álvarez International', 16.7571, -99.7540, 'MX', ['Zona Dorada']),
  BJX: a('BJX', 'León-Guanajuato', 'Del Bajío International', 20.9935, -101.4808, 'MX', ['San Miguel de Allende']),
  CUN: a('CUN', 'Cancún', 'Cancún International', 21.0365, -86.8771, 'MX', ['Hotel Zone', 'Playa del Carmen']),
  GDL: a('GDL', 'Guadalajara', 'Guadalajara International', 20.5218, -103.3111, 'MX', ['Centro Historico']),
  HMO: a('HMO', 'Hermosillo', 'General Ignacio Pesqueira García International', 29.0959, -111.0480, 'MX'),
  MEX: a('MEX', 'Mexico City', 'Mexico City International', 19.4363, -99.0721, 'MX', ['Roma Norte', 'Condesa', 'Polanco']),
  MID: a('MID', 'Mérida', 'Manuel Crescencio Rejón International', 20.9370, -89.6577, 'MX', ['Centro']),
  MLM: a('MLM', 'Morelia', 'General Francisco J Mujica International', 19.8499, -101.0251, 'MX'),
  MTY: a('MTY', 'Monterrey', 'General Mariano Escobedo International', 25.7785, -100.1069, 'MX', ['Barrio Antiguo']),
  OAX: a('OAX', 'Oaxaca', 'Xoxocotlán International', 16.9999, -96.7266, 'MX', ['Centro']),
  PVR: a('PVR', 'Puerto Vallarta', 'Gustavo Díaz Ordaz International', 20.6801, -105.2542, 'MX', ['Zona Romántica', 'Marina']),
  QRO: a('QRO', 'Querétaro', 'Querétaro Intercontinental Airport', 20.6173, -100.1856, 'MX', ['Centro Historico']),
  SJD: a('SJD', 'Los Cabos', 'Los Cabos International', 23.1518, -109.7215, 'MX', ['Cabo San Lucas', 'San José del Cabo']),
  SLP: a('SLP', 'San Luis Potosí', 'Ponciano Arriaga International', 22.2543, -100.9308, 'MX', ['Centro Historico']),
  TIJ: a('TIJ', 'Tijuana', 'General Abelardo L Rodríguez International', 32.5411, -116.9700, 'MX'),
  ZIH: a('ZIH', 'Ixtapa-Zihuatanejo', 'Ixtapa-Zihuatanejo International', 17.6016, -101.4606, 'MX'),

  // ═══════════════════════════════════════════════════════════════
  // CENTRAL AMERICA
  // ═══════════════════════════════════════════════════════════════
  BZE: a('BZE', 'Belize City', 'Philip S W Goldson International', 17.5391, -88.3082, 'BZ'),
  GUA: a('GUA', 'Guatemala City', 'La Aurora International', 14.5833, -90.5275, 'GT', ['Zona Viva']),
  MGA: a('MGA', 'Managua', 'Augusto C Sandino International', 12.1415, -86.1682, 'NI'),
  PTY: a('PTY', 'Panama City', 'Tocumen International', 9.0714, -79.3835, 'PA', ['Casco Viejo', 'Panama Canal']),
  SAL: a('SAL', 'San Salvador', 'Monseñor Óscar Arnulfo Romero International', 13.4409, -89.0557, 'SV'),
  SAP: a('SAP', 'San Pedro Sula', 'Ramón Villeda Morales International', 15.4526, -87.9236, 'HN'),
  SJO: a('SJO', 'San José CR', 'Juan Santamaría International', 9.9939, -84.2088, 'CR', ['Escazú']),
  LIR: a('LIR', 'Liberia CR', 'Daniel Oduber Quirós International', 10.5933, -85.5444, 'CR', ['Guanacaste', 'Papagayo']),
  TGU: a('TGU', 'Tegucigalpa', 'Toncontín International', 14.0611, -87.2172, 'HN'),

  // ═══════════════════════════════════════════════════════════════
  // SOUTH AMERICA
  // ═══════════════════════════════════════════════════════════════
  BAQ: a('BAQ', 'Barranquilla', 'Ernesto Cortissoz International', 10.8896, -74.7808, 'CO', ['El Prado']),
  BOG: a('BOG', 'Bogotá', 'El Dorado International', 4.7016, -74.1469, 'CO', ['Zona Rosa', 'La Candelaria']),
  BSB: a('BSB', 'Brasília', 'Presidente Juscelino Kubitschek International', -15.8711, -47.9186, 'BR'),
  CLO: a('CLO', 'Cali', 'Alfonso Bonilla Aragón International', 3.5432, -76.3816, 'CO'),
  CTG: a('CTG', 'Cartagena', 'Rafael Núñez International', 10.4424, -75.5130, 'CO', ['Old City', 'Bocagrande']),
  CUZ: a('CUZ', 'Cusco', 'Alejandro Velasco Astete International', -13.5357, -71.9388, 'PE', ['Plaza de Armas']),
  EZE: a('EZE', 'Buenos Aires', 'Ministro Pistarini International', -34.8222, -58.5358, 'AR', ['Palermo', 'Recoleta', 'San Telmo']),
  GIG: a('GIG', 'Rio de Janeiro', 'Galeão International', -22.8100, -43.2505, 'BR', ['Copacabana', 'Ipanema', 'Leblon']),
  GEO: a('GEO', 'Georgetown', 'Cheddi Jagan International', 6.4985, -58.2541, 'GY', ['Stabroek']),
  GRU: a('GRU', 'São Paulo', 'São Paulo–Guarulhos International', -23.4356, -46.4731, 'BR', ['Jardins', 'Paulista', 'Vila Madalena']),
  GYE: a('GYE', 'Guayaquil', 'José Joaquín de Olmedo International', -2.1574, -79.8837, 'EC', ['Malecón']),
  LIM: a('LIM', 'Lima', 'Jorge Chávez International', -12.0219, -77.1143, 'PE', ['Miraflores', 'Barranco']),
  MDE: a('MDE', 'Medellín', 'José María Córdova International', 6.1645, -75.4231, 'CO', ['El Poblado', 'Laureles']),
  MVD: a('MVD', 'Montevideo', 'Carrasco International', -34.8384, -56.0308, 'UY', ['Ciudad Vieja', 'Pocitos']),
  SCL: a('SCL', 'Santiago', 'Arturo Merino Benítez International', -33.3930, -70.7858, 'CL', ['Bellavista', 'Lastarria']),
  UIO: a('UIO', 'Quito', 'Mariscal Sucre International', -0.1292, -78.3575, 'EC', ['Old Town', 'La Mariscal']),
  VVI: a('VVI', 'Santa Cruz', 'Viru Viru International', -17.6448, -63.1354, 'BO'),

  // ═══════════════════════════════════════════════════════════════
  // WESTERN EUROPE
  // ═══════════════════════════════════════════════════════════════
  AMS: a('AMS', 'Amsterdam', 'Amsterdam Schiphol', 52.3105, 4.7683, 'NL', ['Jordaan', 'De Pijp']),
  BCN: a('BCN', 'Barcelona', 'Barcelona-El Prat', 41.2971, 2.0785, 'ES', ['Gothic Quarter', 'Eixample']),
  BLQ: a('BLQ', 'Bologna', 'Bologna Guglielmo Marconi', 44.5354, 11.2887, 'IT', ['Piazza Maggiore', 'Quadrilatero']),
  BRU: a('BRU', 'Brussels', 'Brussels Airport', 50.9014, 4.4844, 'BE', ['Grand Place']),
  CDG: a('CDG', 'Paris CDG', 'Paris Charles de Gaulle', 49.0097, 2.5479, 'FR', ['Le Marais', 'Montmartre']),
  CPH: a('CPH', 'Copenhagen', 'Copenhagen Airport', 55.6181, 12.6560, 'DK', ['Nyhavn', 'Tivoli']),
  DUB: a('DUB', 'Dublin', 'Dublin Airport', 53.4264, -6.2499, 'IE', ['Temple Bar']),
  DUS: a('DUS', 'Düsseldorf', 'Düsseldorf Airport', 51.2895, 6.7668, 'DE', ['Altstadt']),
  EDI: a('EDI', 'Edinburgh', 'Edinburgh Airport', 55.9500, -3.3725, 'GB', ['Old Town', 'Royal Mile']),
  FAO: a('FAO', 'Faro', 'Faro Airport', 37.0144, -7.9659, 'PT', ['Algarve']),
  FCO: a('FCO', 'Rome', 'Rome Fiumicino', 41.8003, 12.2389, 'IT', ['Trastevere', 'Vatican']),
  FRA: a('FRA', 'Frankfurt', 'Frankfurt Airport', 50.0379, 8.5622, 'DE', ['Sachsenhausen']),
  GVA: a('GVA', 'Geneva', 'Geneva Airport', 46.2381, 6.1089, 'CH', ['Old Town', 'Jet d\'Eau']),
  HAM: a('HAM', 'Hamburg', 'Hamburg Airport', 53.6304, 9.9882, 'DE', ['St Pauli', 'Speicherstadt']),
  HEL: a('HEL', 'Helsinki', 'Helsinki-Vantaa', 60.3172, 24.9633, 'FI', ['Kallio', 'Design District']),
  LGW: a('LGW', 'London Gatwick', 'London Gatwick', 51.1537, -0.1821, 'GB', ['Central London']),
  LHR: a('LHR', 'London Heathrow', 'London Heathrow', 51.4700, -0.4543, 'GB', ['Westminster', 'Soho']),
  LIS: a('LIS', 'Lisbon', 'Lisbon Airport', 38.7813, -9.1359, 'PT', ['Alfama', 'Bairro Alto']),
  LTN: a('LTN', 'London Luton', 'London Luton Airport', 51.8747, -0.3683, 'GB'),
  MAD: a('MAD', 'Madrid', 'Madrid Barajas', 40.4983, -3.5676, 'ES', ['Centro', 'Salamanca']),
  MAN: a('MAN', 'Manchester UK', 'Manchester Airport', 53.3588, -2.2727, 'GB', ['Northern Quarter']),
  MLA: a('MLA', 'Malta', 'Malta International', 35.8575, 14.4775, 'MT', ['Valletta', 'St Julian\'s']),
  MRS: a('MRS', 'Marseille', 'Marseille Provence Airport', 43.4393, 5.2214, 'FR', ['Vieux Port']),
  MUC: a('MUC', 'Munich', 'Munich Airport', 48.3537, 11.7750, 'DE', ['Marienplatz']),
  MXP: a('MXP', 'Milan', 'Milan Malpensa', 45.6306, 8.7281, 'IT', ['Duomo', 'Navigli']),
  NCE: a('NCE', 'Nice', 'Nice Côte d\'Azur', 43.6584, 7.2159, 'FR', ['Promenade des Anglais']),
  NAP: a('NAP', 'Naples', 'Naples International', 40.8860, 14.2908, 'IT', ['Spaccanapoli', 'Vomero']),
  OPO: a('OPO', 'Porto', 'Francisco Sá Carneiro Airport', 41.2481, -8.6814, 'PT', ['Ribeira']),
  ORY: a('ORY', 'Paris Orly', 'Paris Orly', 48.7262, 2.3652, 'FR', ['Latin Quarter']),
  OSL: a('OSL', 'Oslo', 'Oslo Gardermoen', 60.1939, 11.1004, 'NO', ['Aker Brygge']),
  PMI: a('PMI', 'Palma de Mallorca', 'Palma de Mallorca Airport', 39.5517, 2.7388, 'ES', ['Old Town']),
  STN: a('STN', 'London Stansted', 'London Stansted Airport', 51.8850, 0.2350, 'GB'),
  SNN: a('SNN', 'Shannon', 'Shannon Airport', 52.7020, -8.9248, 'IE', ['Limerick', 'Ennis']),
  SVQ: a('SVQ', 'Seville', 'Seville Airport', 37.4180, -5.8931, 'ES', ['Santa Cruz']),
  TXL: a('TXL', 'Berlin', 'Berlin Brandenburg', 52.3667, 13.5033, 'DE', ['Mitte', 'Kreuzberg']),
  VCE: a('VCE', 'Venice', 'Venice Marco Polo', 45.5053, 12.3519, 'IT', ['San Marco', 'Dorsoduro']),
  VIE: a('VIE', 'Vienna', 'Vienna International', 48.1103, 16.5697, 'AT', ['Innere Stadt']),
  ZRH: a('ZRH', 'Zurich', 'Zurich Airport', 47.4647, 8.5492, 'CH', ['Old Town']),

  // ═══════════════════════════════════════════════════════════════
  // NORTHERN EUROPE & SCANDINAVIA
  // ═══════════════════════════════════════════════════════════════
  ARN: a('ARN', 'Stockholm', 'Stockholm Arlanda', 59.6519, 17.9186, 'SE', ['Gamla Stan']),
  GOT: a('GOT', 'Gothenburg', 'Göteborg Landvetter', 57.6628, 12.2798, 'SE'),
  KEF: a('KEF', 'Reykjavik', 'Keflavik International', 63.9850, -22.6056, 'IS', ['Laugavegur']),
  RIX: a('RIX', 'Riga', 'Riga International', 56.9236, 23.9711, 'LV', ['Old Riga']),
  TLL: a('TLL', 'Tallinn', 'Lennart Meri Tallinn', 59.4133, 24.8328, 'EE', ['Old Town']),
  VNO: a('VNO', 'Vilnius', 'Vilnius Airport', 54.6341, 25.2858, 'LT', ['Old Town']),

  // ═══════════════════════════════════════════════════════════════
  // EASTERN EUROPE
  // ═══════════════════════════════════════════════════════════════
  ATH: a('ATH', 'Athens', 'Athens International', 37.9364, 23.9445, 'GR', ['Plaka', 'Monastiraki']),
  BEG: a('BEG', 'Belgrade', 'Belgrade Nikola Tesla', 44.8184, 20.3091, 'RS', ['Knez Mihailova']),
  BUD: a('BUD', 'Budapest', 'Budapest Ferenc Liszt', 47.4298, 19.2611, 'HU', ['District V', 'Ruin Bars']),
  BUH: a('BUH', 'Bucharest', 'Henri Coandă International', 44.5711, 26.0850, 'RO', ['Old Town']),
  DBV: a('DBV', 'Dubrovnik', 'Dubrovnik Airport', 42.5614, 18.2682, 'HR', ['Old Town']),
  IST: a('IST', 'Istanbul', 'Istanbul Airport', 41.2753, 28.7519, 'TR', ['Sultanahmet', 'Beyoğlu']),
  KRK: a('KRK', 'Krakow', 'John Paul II International', 50.0777, 19.7848, 'PL', ['Old Town', 'Kazimierz']),
  LJU: a('LJU', 'Ljubljana', 'Ljubljana Jože Pučnik', 46.2237, 14.4576, 'SI', ['Old Town']),
  OTP: a('OTP', 'Bucharest', 'Henri Coandă International', 44.5711, 26.0850, 'RO', ['Old Town', 'Lipscani']),
  PRG: a('PRG', 'Prague', 'Václav Havel Airport', 50.1008, 14.2600, 'CZ', ['Old Town', 'Malá Strana']),
  SAW: a('SAW', 'Istanbul Sabiha', 'Istanbul Sabiha Gökçen', 40.8986, 29.3092, 'TR', ['Kadıköy']),
  SOF: a('SOF', 'Sofia', 'Sofia Airport', 42.6952, 23.4062, 'BG', ['Vitosha Blvd']),
  SPU: a('SPU', 'Split', 'Split Airport', 43.5389, 16.2980, 'HR', ['Diocletian\'s Palace']),
  WAW: a('WAW', 'Warsaw', 'Warsaw Chopin', 52.1657, 20.9671, 'PL', ['Old Town', 'Nowy Świat']),
  ZAG: a('ZAG', 'Zagreb', 'Franjo Tuđman Airport', 45.7429, 16.0688, 'HR', ['Upper Town']),

  // ═══════════════════════════════════════════════════════════════
  // MIDDLE EAST
  // ═══════════════════════════════════════════════════════════════
  AMM: a('AMM', 'Amman', 'Queen Alia International', 31.7226, 35.9932, 'JO', ['Rainbow Street']),
  AUH: a('AUH', 'Abu Dhabi', 'Abu Dhabi International', 24.4330, 54.6511, 'AE', ['Corniche', 'Yas Island']),
  BAH: a('BAH', 'Bahrain', 'Bahrain International', 26.2708, 50.6336, 'BH', ['Manama']),
  DOH: a('DOH', 'Doha', 'Hamad International', 25.2731, 51.6081, 'QA', ['Souq Waqif', 'The Pearl']),
  DXB: a('DXB', 'Dubai', 'Dubai International', 25.2532, 55.3657, 'AE', ['Dubai Marina', 'Jumeirah']),
  JED: a('JED', 'Jeddah', 'King Abdulaziz International', 21.6796, 39.1565, 'SA', ['Al-Balad']),
  KWI: a('KWI', 'Kuwait City', 'Kuwait International', 29.2266, 47.9689, 'KW'),
  MCT: a('MCT', 'Muscat', 'Muscat International', 23.5933, 58.2844, 'OM', ['Mutrah']),
  RUH: a('RUH', 'Riyadh', 'King Khalid International', 24.9578, 46.6989, 'SA', ['Diriyah']),
  TLV: a('TLV', 'Tel Aviv', 'Ben Gurion Airport', 32.0055, 34.8854, 'IL', ['Jaffa', 'Rothschild']),

  // ═══════════════════════════════════════════════════════════════
  // AFRICA
  // ═══════════════════════════════════════════════════════════════
  ABJ: a('ABJ', 'Abidjan', 'Félix-Houphouët-Boigny International', 5.2614, -3.9263, 'CI', ['Plateau']),
  ACC: a('ACC', 'Accra', 'Kotoka International', 5.6052, -0.1718, 'GH', ['Osu']),
  ADD: a('ADD', 'Addis Ababa', 'Bole International', 8.9779, 38.7993, 'ET', ['Piazza']),
  ALG: a('ALG', 'Algiers', 'Houari Boumediene Airport', 36.6910, 3.2154, 'DZ'),
  CAI: a('CAI', 'Cairo', 'Cairo International', 30.1219, 31.4056, 'EG', ['Zamalek', 'Giza']),
  CMN: a('CMN', 'Casablanca', 'Mohammed V International', 33.3675, -7.5898, 'MA', ['Habous Quarter']),
  CPT: a('CPT', 'Cape Town', 'Cape Town International', -33.9715, 18.6021, 'ZA', ['V&A Waterfront']),
  DAR: a('DAR', 'Dar es Salaam', 'Julius Nyerere International', -6.8781, 39.2026, 'TZ'),
  DKR: a('DKR', 'Dakar', 'Blaise Diagne International', 14.6708, -17.0733, 'SN'),
  DSS: a('DSS', 'Dakar', 'Blaise Diagne International', 14.6708, -17.0733, 'SN'),
  JNB: a('JNB', 'Johannesburg', 'OR Tambo International', -26.1367, 28.2411, 'ZA', ['Sandton']),
  LOS: a('LOS', 'Lagos', 'Murtala Muhammed International', 6.5774, 3.3212, 'NG', ['Victoria Island']),
  MBA: a('MBA', 'Mombasa', 'Moi International', -4.0348, 39.5942, 'KE', ['Old Town']),
  NBO: a('NBO', 'Nairobi', 'Jomo Kenyatta International', -1.3192, 36.9278, 'KE', ['Karen', 'Westlands']),
  RAK: a('RAK', 'Marrakech', 'Marrakech Menara Airport', 31.6069, -8.0363, 'MA', ['Medina', 'Jemaa el-Fnaa']),
  RUN: a('RUN', 'Réunion', 'Roland Garros Airport', -20.8871, 55.5103, 'RE'),
  TUN: a('TUN', 'Tunis', 'Tunis-Carthage International', 36.8510, 10.2272, 'TN', ['Medina']),
  WDH: a('WDH', 'Windhoek', 'Hosea Kutako International', -22.4799, 17.4709, 'NA'),
  ZNZ: a('ZNZ', 'Zanzibar', 'Abeid Amani Karume International', -6.2220, 39.2249, 'TZ', ['Stone Town']),

  // ═══════════════════════════════════════════════════════════════
  // EAST ASIA
  // ═══════════════════════════════════════════════════════════════
  CAN: a('CAN', 'Guangzhou', 'Baiyun International', 23.3924, 113.2988, 'CN'),
  CJU: a('CJU', 'Jeju', 'Jeju International', 33.5113, 126.4929, 'KR', ['Jeju City']),
  CTS: a('CTS', 'Sapporo', 'New Chitose Airport', 42.7752, 141.6925, 'JP', ['Susukino']),
  FUK: a('FUK', 'Fukuoka', 'Fukuoka Airport', 33.5859, 130.4513, 'JP', ['Tenjin', 'Hakata']),
  GMP: a('GMP', 'Seoul Gimpo', 'Gimpo International', 37.5583, 126.7906, 'KR', ['Hongdae']),
  HKG: a('HKG', 'Hong Kong', 'Hong Kong International', 22.3080, 113.9185, 'HK', ['Central', 'Tsim Sha Tsui']),
  HND: a('HND', 'Tokyo Haneda', 'Tokyo Haneda', 35.5494, 139.7798, 'JP', ['Shibuya', 'Shinjuku']),
  ICN: a('ICN', 'Seoul', 'Incheon International', 37.4602, 126.4407, 'KR', ['Myeongdong', 'Gangnam']),
  KIX: a('KIX', 'Osaka', 'Kansai International', 34.4347, 135.2441, 'JP', ['Namba', 'Dotonbori']),
  MFM: a('MFM', 'Macau', 'Macau International', 22.1496, 113.5919, 'MO', ['Cotai Strip']),
  NGO: a('NGO', 'Nagoya', 'Chubu Centrair International', 34.8584, 136.8125, 'JP'),
  NRT: a('NRT', 'Tokyo Narita', 'Narita International', 35.7720, 140.3929, 'JP', ['Shinjuku', 'Ginza']),
  PEK: a('PEK', 'Beijing', 'Beijing Capital International', 40.0799, 116.6031, 'CN', ['Forbidden City']),
  PKX: a('PKX', 'Beijing Daxing', 'Beijing Daxing International', 39.5098, 116.4105, 'CN'),
  PUS: a('PUS', 'Busan', 'Gimhae International', 35.1796, 128.9382, 'KR', ['Haeundae', 'Seomyeon']),
  PVG: a('PVG', 'Shanghai', 'Shanghai Pudong International', 31.1443, 121.8083, 'CN', ['The Bund']),
  SHA: a('SHA', 'Shanghai Hongqiao', 'Shanghai Hongqiao International', 31.1979, 121.3360, 'CN', ['French Concession']),
  SZX: a('SZX', 'Shenzhen', 'Shenzhen Bao\'an International', 22.6393, 113.8106, 'CN'),
  TAO: a('TAO', 'Qingdao', 'Qingdao Jiaodong International', 36.2461, 120.0955, 'CN'),
  TPE: a('TPE', 'Taipei', 'Taiwan Taoyuan International', 25.0797, 121.2342, 'TW', ['Ximending']),
  TSA: a('TSA', 'Taipei Songshan', 'Taipei Songshan Airport', 25.0694, 121.5525, 'TW'),
  XIY: a('XIY', 'Xi\'an', 'Xi\'an Xianyang International', 34.4471, 108.7516, 'CN', ['Muslim Quarter']),

  // ═══════════════════════════════════════════════════════════════
  // SOUTHEAST ASIA
  // ═══════════════════════════════════════════════════════════════
  BKK: a('BKK', 'Bangkok', 'Suvarnabhumi Airport', 13.6900, 100.7501, 'TH', ['Sukhumvit', 'Silom']),
  CEB: a('CEB', 'Cebu', 'Mactan-Cebu International', 10.3075, 123.9794, 'PH'),
  CGK: a('CGK', 'Jakarta', 'Soekarno-Hatta International', -6.1256, 106.6559, 'ID', ['Kota Tua']),
  CMB: a('CMB', 'Colombo', 'Bandaranaike International', 7.1808, 79.8841, 'LK', ['Galle Face']),
  CNX: a('CNX', 'Chiang Mai', 'Chiang Mai International', 18.7668, 98.9626, 'TH', ['Old City', 'Nimman']),
  DAD: a('DAD', 'Da Nang', 'Da Nang International', 16.0439, 108.1992, 'VN', ['Hoi An']),
  DPS: a('DPS', 'Bali', 'Ngurah Rai International', -8.7482, 115.1672, 'ID', ['Seminyak', 'Ubud', 'Canggu']),
  DMK: a('DMK', 'Bangkok Don Mueang', 'Don Mueang International', 13.9126, 100.6068, 'TH'),
  HAN: a('HAN', 'Hanoi', 'Noi Bai International', 21.2187, 105.8042, 'VN', ['Old Quarter']),
  HKT: a('HKT', 'Phuket', 'Phuket International', 8.1132, 98.3169, 'TH', ['Patong', 'Old Town']),
  KUL: a('KUL', 'Kuala Lumpur', 'Kuala Lumpur International', 2.7456, 101.7099, 'MY', ['Bukit Bintang', 'KLCC']),
  MNL: a('MNL', 'Manila', 'Ninoy Aquino International', 14.5086, 121.0197, 'PH', ['Makati', 'BGC']),
  PEN: a('PEN', 'Penang', 'Penang International', 5.2972, 100.2769, 'MY', ['George Town']),
  PNH: a('PNH', 'Phnom Penh', 'Phnom Penh International', 11.5466, 104.8441, 'KH', ['Riverside']),
  REP: a('REP', 'Siem Reap', 'Siem Reap International', 13.4107, 103.8128, 'KH', ['Pub Street', 'Angkor Wat']),
  RGN: a('RGN', 'Yangon', 'Yangon International', 16.9073, 96.1332, 'MM'),
  SGN: a('SGN', 'Ho Chi Minh City', 'Tan Son Nhat International', 10.8188, 106.6520, 'VN', ['District 1', 'Bui Vien']),
  SIN: a('SIN', 'Singapore', 'Singapore Changi', 1.3644, 103.9915, 'SG', ['Marina Bay', 'Orchard']),
  VTE: a('VTE', 'Vientiane', 'Wattay International', 17.9884, 102.5633, 'LA'),

  // ═══════════════════════════════════════════════════════════════
  // SOUTH ASIA
  // ═══════════════════════════════════════════════════════════════
  BLR: a('BLR', 'Bangalore', 'Kempegowda International', 13.1986, 77.7066, 'IN', ['MG Road', 'Indiranagar']),
  BOM: a('BOM', 'Mumbai', 'Chhatrapati Shivaji Maharaj International', 19.0896, 72.8656, 'IN', ['Colaba', 'Bandra']),
  CCU: a('CCU', 'Kolkata', 'Netaji Subhas Chandra Bose International', 22.6520, 88.4463, 'IN', ['Park Street']),
  DAC: a('DAC', 'Dhaka', 'Hazrat Shahjalal International', 23.8433, 90.3978, 'BD'),
  DEL: a('DEL', 'New Delhi', 'Indira Gandhi International', 28.5562, 77.1000, 'IN', ['Connaught Place']),
  GOI: a('GOI', 'Goa', 'Goa International Airport', 15.3809, 73.8314, 'IN', ['Panjim', 'Calangute']),
  HYD: a('HYD', 'Hyderabad', 'Rajiv Gandhi International', 17.2403, 78.4294, 'IN'),
  KTM: a('KTM', 'Kathmandu', 'Tribhuvan International', 27.6966, 85.3591, 'NP', ['Thamel']),
  MAA: a('MAA', 'Chennai', 'Chennai International', 12.9941, 80.1709, 'IN', ['T Nagar']),
  MLE: a('MLE', 'Malé', 'Velana International', 4.1918, 73.5290, 'MV'),

  // ═══════════════════════════════════════════════════════════════
  // OCEANIA & PACIFIC
  // ═══════════════════════════════════════════════════════════════
  AKL: a('AKL', 'Auckland', 'Auckland Airport', -37.0082, 174.7850, 'NZ', ['Viaduct Harbour', 'Ponsonby']),
  BNE: a('BNE', 'Brisbane', 'Brisbane Airport', -27.3842, 153.1175, 'AU', ['South Bank', 'Fortitude Valley']),
  CHC: a('CHC', 'Christchurch', 'Christchurch International', -43.4894, 172.5322, 'NZ'),
  DRW: a('DRW', 'Darwin', 'Darwin International', -12.4147, 130.8769, 'AU'),
  FJR: a('FJR', 'Fiji', 'Nadi International', -17.7554, 177.4431, 'FJ', ['Denarau']),
  MEL: a('MEL', 'Melbourne', 'Melbourne Airport', -37.6690, 144.8410, 'AU', ['Southbank', 'Fitzroy']),
  NAN: a('NAN', 'Nadi', 'Nadi International', -17.7554, 177.4431, 'FJ', ['Denarau Island']),
  NOU: a('NOU', 'Nouméa', 'La Tontouta International', -22.0146, 166.2129, 'NC'),
  PER: a('PER', 'Perth', 'Perth Airport', -31.9403, 115.9670, 'AU', ['Northbridge', 'Fremantle']),
  PPT: a('PPT', 'Tahiti', 'Faa\'a International', -17.5537, -149.6073, 'PF', ['Papeete']),
  SYD: a('SYD', 'Sydney', 'Sydney Kingsford Smith', -33.9399, 151.1753, 'AU', ['Darling Harbour', 'Bondi']),
  WLG: a('WLG', 'Wellington', 'Wellington Airport', -41.3272, 174.8053, 'NZ', ['Cuba Street']),
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
