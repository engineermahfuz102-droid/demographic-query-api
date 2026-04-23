/**
 * Natural Language Query Parser
 * Rule-based only — no AI/LLM used.
 *
 * Supported keywords and their mappings:
 *
 * GENDER:
 *   "male", "males", "man", "men", "boy", "boys"       → gender=male
 *   "female", "females", "woman", "women", "girl", "girls" → gender=female
 *
 * AGE GROUPS:
 *   "child", "children", "kid", "kids"                 → age_group=child
 *   "teenager", "teenagers", "teen", "teens"           → age_group=teenager
 *   "adult", "adults"                                  → age_group=adult
 *   "senior", "seniors", "elderly", "old"              → age_group=senior
 *
 * AGE RANGES (parsing only, not stored):
 *   "young", "youth"                                   → min_age=16, max_age=24
 *   "above <n>", "over <n>", "older than <n>"          → min_age=n
 *   "below <n>", "under <n>", "younger than <n>"       → max_age=n
 *   "between <n> and <m>"                              → min_age=n, max_age=m
 *   "aged <n>"                                         → min_age=n, max_age=n
 *
 * COUNTRIES:
 *   Country names and common aliases map to ISO codes.
 *   "from <country>", "in <country>", "<country> people"
 */

const COUNTRY_MAP = {
  'nigeria': 'NG', 'nigerian': 'NG', 'nigerians': 'NG',
  'ghana': 'GH', 'ghanaian': 'GH', 'ghanaians': 'GH',
  'kenya': 'KE', 'kenyan': 'KE', 'kenyans': 'KE',
  'south africa': 'ZA', 'south african': 'ZA', 'south africans': 'ZA',
  'ethiopia': 'ET', 'ethiopian': 'ET', 'ethiopians': 'ET',
  'tanzania': 'TZ', 'tanzanian': 'TZ', 'tanzanians': 'TZ',
  'uganda': 'UG', 'ugandan': 'UG', 'ugandans': 'UG',
  'cameroon': 'CM', 'cameroonian': 'CM', 'cameroonians': 'CM',
  'angola': 'AO', 'angolan': 'AO', 'angolans': 'AO',
  'senegal': 'SN', 'senegalese': 'SN',
  'ivory coast': 'CI', 'cote d\'ivoire': 'CI', 'ivorian': 'CI',
  'mali': 'ML', 'malian': 'ML',
  'burkina faso': 'BF', 'burkinabe': 'BF',
  'niger': 'NE', 'nigerien': 'NE',
  'benin': 'BJ', 'beninese': 'BJ',
  'togo': 'TG', 'togolese': 'TG',
  'mozambique': 'MZ', 'mozambican': 'MZ',
  'zimbabwe': 'ZW', 'zimbabwean': 'ZW', 'zimbabweans': 'ZW',
  'zambia': 'ZM', 'zambian': 'ZM', 'zambians': 'ZM',
  'malawi': 'MW', 'malawian': 'MW',
  'rwanda': 'RW', 'rwandan': 'RW', 'rwandans': 'RW',
  'somalia': 'SO', 'somali': 'SO', 'somalians': 'SO',
  'sudan': 'SD', 'sudanese': 'SD',
  'south sudan': 'SS', 'south sudanese': 'SS',
  'egypt': 'EG', 'egyptian': 'EG', 'egyptians': 'EG',
  'morocco': 'MA', 'moroccan': 'MA', 'moroccans': 'MA',
  'algeria': 'DZ', 'algerian': 'DZ', 'algerians': 'DZ',
  'tunisia': 'TN', 'tunisian': 'TN',
  'libya': 'LY', 'libyan': 'LY',
  'congo': 'CG', 'congolese': 'CG',
  'democratic republic of congo': 'CD', 'dr congo': 'CD', 'drc': 'CD',
  'madagascar': 'MG', 'malagasy': 'MG',
  'guinea': 'GN', 'guinean': 'GN',
  'sierra leone': 'SL',
  'liberia': 'LR', 'liberian': 'LR',
  'gambia': 'GM', 'gambian': 'GM',
  'guinea-bissau': 'GW',
  'cape verde': 'CV', 'cabo verde': 'CV',
  'sao tome': 'ST', 'sao tome and principe': 'ST',
  'equatorial guinea': 'GQ',
  'gabon': 'GA', 'gabonese': 'GA',
  'central african republic': 'CF', 'car': 'CF',
  'chad': 'TD', 'chadian': 'TD',
  'mauritania': 'MR', 'mauritanian': 'MR',
  'eritrea': 'ER', 'eritrean': 'ER',
  'djibouti': 'DJ', 'djiboutian': 'DJ',
  'comoros': 'KM', 'comorian': 'KM',
  'mauritius': 'MU', 'mauritian': 'MU',
  'seychelles': 'SC', 'seychellois': 'SC',
  'botswana': 'BW', 'botswanan': 'BW',
  'namibia': 'NA', 'namibian': 'NA',
  'lesotho': 'LS', 'basotho': 'LS',
  'swaziland': 'SZ', 'eswatini': 'SZ', 'swazi': 'SZ',
  'burundi': 'BI', 'burundian': 'BI',
  // Common non-African countries
  'united states': 'US', 'usa': 'US', 'america': 'US', 'american': 'US',
  'united kingdom': 'GB', 'uk': 'GB', 'britain': 'GB', 'british': 'GB',
  'france': 'FR', 'french': 'FR',
  'germany': 'DE', 'german': 'DE',
  'china': 'CN', 'chinese': 'CN',
  'india': 'IN', 'indian': 'IN',
  'brazil': 'BR', 'brazilian': 'BR',
  'canada': 'CA', 'canadian': 'CA',
  'australia': 'AU', 'australian': 'AU',
  'japan': 'JP', 'japanese': 'JP',
  'italy': 'IT', 'italian': 'IT',
  'spain': 'ES', 'spanish': 'ES',
  'portugal': 'PT', 'portuguese': 'PT',
};

function parseQuery(q) {
  if (!q || typeof q !== 'string') return null;

  const raw = q.toLowerCase().trim();
  const filters = {};

  // --- GENDER ---
  if (/\b(male|males|man|men|boy|boys)\b/.test(raw) && !/\b(female|females|woman|women|girl|girls)\b/.test(raw)) {
    filters.gender = 'male';
  } else if (/\b(female|females|woman|women|girl|girls)\b/.test(raw) && !/\b(male|males|man|men|boy|boys)\b/.test(raw)) {
    filters.gender = 'female';
  }
  // If both genders mentioned → no gender filter (e.g. "male and female teenagers")

  // --- AGE GROUP ---
  if (/\b(child|children|kid|kids)\b/.test(raw)) {
    filters.age_group = 'child';
  } else if (/\b(teenager|teenagers|teen|teens)\b/.test(raw)) {
    filters.age_group = 'teenager';
  } else if (/\b(adult|adults)\b/.test(raw)) {
    filters.age_group = 'adult';
  } else if (/\b(senior|seniors|elderly|old people|old men|old women)\b/.test(raw)) {
    filters.age_group = 'senior';
  }

  // --- YOUNG (special parsing keyword, not a stored group) ---
  if (/\b(young|youth)\b/.test(raw)) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  // --- BETWEEN n AND m ---
  const betweenMatch = raw.match(/between\s+(\d+)\s+and\s+(\d+)/);
  if (betweenMatch) {
    filters.min_age = parseInt(betweenMatch[1]);
    filters.max_age = parseInt(betweenMatch[2]);
  }

  // --- ABOVE / OVER / OLDER THAN n ---
  const aboveMatch = raw.match(/(?:above|over|older than)\s+(\d+)/);
  if (aboveMatch) {
    filters.min_age = parseInt(aboveMatch[1]);
  }

  // --- BELOW / UNDER / YOUNGER THAN n ---
  const belowMatch = raw.match(/(?:below|under|younger than)\s+(\d+)/);
  if (belowMatch) {
    filters.max_age = parseInt(belowMatch[1]);
  }

  // --- AGED n ---
  const agedMatch = raw.match(/aged?\s+(\d+)/);
  if (agedMatch) {
    filters.min_age = parseInt(agedMatch[1]);
    filters.max_age = parseInt(agedMatch[1]);
  }

  // --- COUNTRY ---
  // Try multi-word country names first (longest match), then single words
  // Strip common prepositions: from, in, living in, based in
  const countryPhrase = raw.replace(/\b(from|in|living in|based in|of)\b/g, ' ');

  // Sort country keys by length descending so longest match wins
  const sortedKeys = Object.keys(COUNTRY_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const regex = new RegExp(`\\b${key.replace(/[-']/g, '.?')}\\b`);
    if (regex.test(countryPhrase)) {
      filters.country_id = COUNTRY_MAP[key];
      break;
    }
  }

  // --- VALIDATE: must have at least one filter ---
  if (Object.keys(filters).length === 0) {
    return null;
  }

  return filters;
}

module.exports = { parseQuery };
