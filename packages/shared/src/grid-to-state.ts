// Maidenhead grid square to US state mapping
// Grid squares are approximate - a grid may span multiple states
// This maps to the primary state for each grid square

// Map of 4-character grid squares to US state abbreviations
// Only includes grids that are primarily in the US
const GRID_TO_STATE: Record<string, string> = {
  // Alaska
  'AO': 'AK', 'AP': 'AK', 'BO': 'AK', 'BP': 'AK', 'BQ': 'AK', 'CO': 'AK', 'CP': 'AK',

  // Pacific Northwest
  'CN73': 'WA', 'CN74': 'WA', 'CN75': 'WA', 'CN76': 'WA', 'CN77': 'WA', 'CN78': 'WA',
  'CN83': 'WA', 'CN84': 'WA', 'CN85': 'WA', 'CN86': 'WA', 'CN87': 'WA', 'CN88': 'WA', 'CN89': 'WA',
  'CN93': 'WA', 'CN94': 'WA', 'CN95': 'WA', 'CN96': 'WA', 'CN97': 'WA', 'CN98': 'WA',

  // Oregon
  'CN80': 'OR', 'CN81': 'OR', 'CN82': 'OR', 'CN83': 'OR', 'CN84': 'OR', 'CN85': 'OR',
  'CN90': 'OR', 'CN91': 'OR', 'CN92': 'OR', 'CN93': 'OR', 'CN94': 'OR', 'CN95': 'OR',

  // California
  'CM87': 'CA', 'CM88': 'CA', 'CM89': 'CA', 'CM93': 'CA', 'CM94': 'CA', 'CM95': 'CA', 'CM96': 'CA', 'CM97': 'CA', 'CM98': 'CA', 'CM99': 'CA',
  'DM03': 'CA', 'DM04': 'CA', 'DM05': 'CA', 'DM06': 'CA', 'DM07': 'CA', 'DM08': 'CA', 'DM09': 'CA',
  'DM12': 'CA', 'DM13': 'CA', 'DM14': 'CA', 'DM15': 'CA', 'DM16': 'CA', 'DM17': 'CA',
  'DM22': 'CA', 'DM23': 'CA', 'DM24': 'CA', 'DM25': 'CA', 'DM26': 'CA',
  'DM32': 'CA', 'DM33': 'CA', 'DM34': 'CA', 'DM35': 'CA',
  'DM42': 'CA', 'DM43': 'CA', 'DM44': 'CA',

  // Nevada
  'DM06': 'NV', 'DM07': 'NV', 'DM08': 'NV', 'DM09': 'NV',
  'DM16': 'NV', 'DM17': 'NV', 'DM18': 'NV', 'DM19': 'NV',
  'DM26': 'NV', 'DM27': 'NV', 'DM28': 'NV', 'DM29': 'NV',
  'DM36': 'NV', 'DM37': 'NV', 'DM38': 'NV', 'DM39': 'NV',
  'DM46': 'NV', 'DM47': 'NV', 'DM48': 'NV', 'DM49': 'NV',

  // Arizona
  'DM31': 'AZ', 'DM32': 'AZ', 'DM33': 'AZ', 'DM34': 'AZ', 'DM35': 'AZ', 'DM36': 'AZ',
  'DM41': 'AZ', 'DM42': 'AZ', 'DM43': 'AZ', 'DM44': 'AZ', 'DM45': 'AZ', 'DM46': 'AZ',
  'DM51': 'AZ', 'DM52': 'AZ', 'DM53': 'AZ', 'DM54': 'AZ', 'DM55': 'AZ', 'DM56': 'AZ',
  'DM61': 'AZ', 'DM62': 'AZ', 'DM63': 'AZ', 'DM64': 'AZ', 'DM65': 'AZ',

  // Utah
  'DN07': 'UT', 'DN17': 'UT', 'DN27': 'UT', 'DN37': 'UT', 'DN47': 'UT',
  'DM39': 'UT', 'DM49': 'UT', 'DM59': 'UT', 'DM69': 'UT',
  'DN30': 'UT', 'DN31': 'UT', 'DN40': 'UT', 'DN41': 'UT',

  // Colorado
  'DM58': 'CO', 'DM59': 'CO', 'DM68': 'CO', 'DM69': 'CO', 'DM78': 'CO', 'DM79': 'CO',
  'DN50': 'CO', 'DN51': 'CO', 'DN60': 'CO', 'DN61': 'CO', 'DN70': 'CO', 'DN71': 'CO',

  // New Mexico
  'DM52': 'NM', 'DM53': 'NM', 'DM54': 'NM', 'DM55': 'NM',
  'DM62': 'NM', 'DM63': 'NM', 'DM64': 'NM', 'DM65': 'NM',
  'DM72': 'NM', 'DM73': 'NM', 'DM74': 'NM', 'DM75': 'NM',
  'DM82': 'NM', 'DM83': 'NM', 'DM84': 'NM', 'DM85': 'NM',

  // Texas
  'DM70': 'TX', 'DM71': 'TX', 'DM72': 'TX', 'DM73': 'TX',
  'DM80': 'TX', 'DM81': 'TX', 'DM82': 'TX', 'DM83': 'TX', 'DM84': 'TX',
  'DM90': 'TX', 'DM91': 'TX', 'DM92': 'TX', 'DM93': 'TX', 'DM94': 'TX', 'DM95': 'TX',
  'EL06': 'TX', 'EL07': 'TX', 'EL08': 'TX', 'EL09': 'TX',
  'EL16': 'TX', 'EL17': 'TX', 'EL18': 'TX', 'EL19': 'TX',
  'EL29': 'TX', 'EM00': 'TX', 'EM01': 'TX', 'EM02': 'TX', 'EM03': 'TX',
  'EM10': 'TX', 'EM11': 'TX', 'EM12': 'TX', 'EM13': 'TX', 'EM14': 'TX',
  'EM20': 'TX', 'EM21': 'TX', 'EM22': 'TX',

  // Oklahoma
  'DM94': 'OK', 'DM95': 'OK', 'DM96': 'OK',
  'EM04': 'OK', 'EM05': 'OK', 'EM06': 'OK',
  'EM14': 'OK', 'EM15': 'OK', 'EM16': 'OK',
  'EM24': 'OK', 'EM25': 'OK', 'EM26': 'OK',

  // Kansas
  'DM97': 'KS', 'DM98': 'KS', 'DM99': 'KS',
  'EM07': 'KS', 'EM08': 'KS', 'EM09': 'KS',
  'EM17': 'KS', 'EM18': 'KS', 'EM19': 'KS',
  'EM27': 'KS', 'EM28': 'KS', 'EM29': 'KS',

  // Nebraska
  'DN70': 'NE', 'DN71': 'NE', 'DN80': 'NE', 'DN81': 'NE', 'DN90': 'NE', 'DN91': 'NE',
  'EN00': 'NE', 'EN01': 'NE', 'EN10': 'NE', 'EN11': 'NE', 'EN20': 'NE', 'EN21': 'NE',

  // South Dakota
  'DN82': 'SD', 'DN83': 'SD', 'DN92': 'SD', 'DN93': 'SD',
  'EN02': 'SD', 'EN03': 'SD', 'EN12': 'SD', 'EN13': 'SD', 'EN22': 'SD', 'EN23': 'SD',

  // North Dakota
  'DN94': 'ND', 'DN95': 'ND', 'DN96': 'ND',
  'EN04': 'ND', 'EN05': 'ND', 'EN06': 'ND',
  'EN14': 'ND', 'EN15': 'ND', 'EN16': 'ND',
  'EN24': 'ND', 'EN25': 'ND', 'EN26': 'ND',

  // Montana
  'DN26': 'MT', 'DN27': 'MT', 'DN36': 'MT', 'DN37': 'MT', 'DN46': 'MT', 'DN47': 'MT',
  'DN56': 'MT', 'DN57': 'MT', 'DN66': 'MT', 'DN67': 'MT', 'DN76': 'MT', 'DN77': 'MT',

  // Wyoming
  'DN52': 'WY', 'DN53': 'WY', 'DN62': 'WY', 'DN63': 'WY', 'DN72': 'WY', 'DN73': 'WY',

  // Idaho
  'DN07': 'ID', 'DN08': 'ID', 'DN17': 'ID', 'DN18': 'ID', 'DN27': 'ID', 'DN28': 'ID',
  'DN13': 'ID', 'DN14': 'ID', 'DN23': 'ID', 'DN24': 'ID', 'DN33': 'ID', 'DN34': 'ID',

  // Minnesota
  'EN15': 'MN', 'EN16': 'MN', 'EN17': 'MN', 'EN18': 'MN',
  'EN25': 'MN', 'EN26': 'MN', 'EN27': 'MN', 'EN28': 'MN',
  'EN35': 'MN', 'EN36': 'MN', 'EN37': 'MN', 'EN38': 'MN',

  // Iowa
  'EN21': 'IA', 'EN22': 'IA', 'EN31': 'IA', 'EN32': 'IA', 'EN41': 'IA', 'EN42': 'IA',

  // Missouri
  'EM28': 'MO', 'EM29': 'MO', 'EM38': 'MO', 'EM39': 'MO', 'EM48': 'MO', 'EM49': 'MO',

  // Arkansas
  'EM25': 'AR', 'EM26': 'AR', 'EM35': 'AR', 'EM36': 'AR', 'EM45': 'AR', 'EM46': 'AR',

  // Louisiana
  'EM30': 'LA', 'EM31': 'LA', 'EM32': 'LA', 'EM40': 'LA', 'EM41': 'LA', 'EM42': 'LA',

  // Mississippi
  'EM41': 'MS', 'EM42': 'MS', 'EM43': 'MS', 'EM51': 'MS', 'EM52': 'MS', 'EM53': 'MS',

  // Alabama
  'EM52': 'AL', 'EM53': 'AL', 'EM54': 'AL', 'EM62': 'AL', 'EM63': 'AL', 'EM64': 'AL',

  // Tennessee
  'EM55': 'TN', 'EM56': 'TN', 'EM65': 'TN', 'EM66': 'TN', 'EM75': 'TN', 'EM76': 'TN',

  // Kentucky
  'EM67': 'KY', 'EM68': 'KY', 'EM77': 'KY', 'EM78': 'KY', 'EM87': 'KY', 'EM88': 'KY',

  // Illinois
  'EN40': 'IL', 'EN41': 'IL', 'EN50': 'IL', 'EN51': 'IL', 'EN60': 'IL', 'EN61': 'IL',
  'EM49': 'IL', 'EM59': 'IL',

  // Indiana
  'EM69': 'IN', 'EM79': 'IN', 'EN60': 'IN', 'EN70': 'IN',

  // Ohio
  'EM79': 'OH', 'EM89': 'OH', 'EN80': 'OH', 'EN81': 'OH', 'EN90': 'OH', 'EN91': 'OH',

  // Michigan
  'EN62': 'MI', 'EN63': 'MI', 'EN64': 'MI', 'EN65': 'MI', 'EN66': 'MI',
  'EN72': 'MI', 'EN73': 'MI', 'EN74': 'MI', 'EN75': 'MI', 'EN76': 'MI',
  'EN82': 'MI', 'EN83': 'MI', 'EN84': 'MI', 'EN85': 'MI', 'EN86': 'MI',

  // Wisconsin
  'EN43': 'WI', 'EN44': 'WI', 'EN53': 'WI', 'EN54': 'WI', 'EN55': 'WI',
  'EN63': 'WI', 'EN64': 'WI',

  // Georgia
  'EM70': 'GA', 'EM71': 'GA', 'EM72': 'GA', 'EM73': 'GA', 'EM74': 'GA',
  'EM80': 'GA', 'EM81': 'GA', 'EM82': 'GA', 'EM83': 'GA', 'EM84': 'GA',

  // Florida
  'EL79': 'FL', 'EL89': 'FL', 'EL98': 'FL', 'EL99': 'FL',
  'EM60': 'FL', 'EM70': 'FL', 'EM80': 'FL', 'EM90': 'FL',

  // South Carolina
  'EM82': 'SC', 'EM83': 'SC', 'EM84': 'SC', 'EM92': 'SC', 'EM93': 'SC', 'EM94': 'SC',

  // North Carolina
  'EM85': 'NC', 'EM86': 'NC', 'EM95': 'NC', 'EM96': 'NC', 'FM05': 'NC', 'FM06': 'NC',

  // Virginia
  'EM97': 'VA', 'FM06': 'VA', 'FM07': 'VA', 'FM08': 'VA', 'FM16': 'VA', 'FM17': 'VA', 'FM18': 'VA',

  // West Virginia
  'EM98': 'WV', 'EM99': 'WV', 'FM08': 'WV', 'FM09': 'WV',

  // Maryland
  'FM18': 'MD', 'FM19': 'MD',

  // Delaware
  'FM29': 'DE',

  // Pennsylvania
  'EN90': 'PA', 'EN91': 'PA', 'FN00': 'PA', 'FN01': 'PA', 'FN10': 'PA', 'FN11': 'PA', 'FN20': 'PA', 'FN21': 'PA',

  // New Jersey
  'FM29': 'NJ', 'FN20': 'NJ', 'FN21': 'NJ',

  // New York
  'FN01': 'NY', 'FN02': 'NY', 'FN03': 'NY', 'FN11': 'NY', 'FN12': 'NY', 'FN13': 'NY',
  'FN21': 'NY', 'FN22': 'NY', 'FN23': 'NY', 'FN30': 'NY', 'FN31': 'NY', 'FN32': 'NY', 'FN33': 'NY',

  // Connecticut
  'FN31': 'CT', 'FN41': 'CT',

  // Rhode Island
  'FN41': 'RI',

  // Massachusetts
  'FN31': 'MA', 'FN32': 'MA', 'FN41': 'MA', 'FN42': 'MA',

  // Vermont
  'FN33': 'VT', 'FN34': 'VT', 'FN43': 'VT', 'FN44': 'VT',

  // New Hampshire
  'FN33': 'NH', 'FN34': 'NH', 'FN43': 'NH', 'FN44': 'NH',

  // Maine
  'FN44': 'ME', 'FN45': 'ME', 'FN54': 'ME', 'FN55': 'ME', 'FN64': 'ME', 'FN65': 'ME',

  // Hawaii
  'BK29': 'HI', 'BL01': 'HI', 'BL10': 'HI', 'BL11': 'HI',
};

// State names for display
export const STATE_NAMES: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia',
};

/**
 * Convert a maidenhead grid square to US state abbreviation
 * Returns null if the grid is not in the US or unknown
 */
export function gridToState(grid: string): string | null {
  if (!grid || grid.length < 4) return null;

  // Normalize to uppercase and take first 4 characters
  const grid4 = grid.slice(0, 4).toUpperCase();

  // Check direct mapping
  if (GRID_TO_STATE[grid4]) {
    return GRID_TO_STATE[grid4];
  }

  // Check field-only mapping (2 characters) for less precise matches
  const field = grid4.slice(0, 2);
  if (GRID_TO_STATE[field]) {
    return GRID_TO_STATE[field];
  }

  return null;
}

/**
 * Get the full state name from abbreviation
 */
export function getStateName(abbrev: string): string {
  return STATE_NAMES[abbrev] ?? abbrev;
}
