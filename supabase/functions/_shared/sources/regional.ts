/**
 * Regional source auto-activation.
 * Returns pre-configured feed_config objects based on country_code.
 * These are inserted as feed_configs with auto_activated=true when an org completes onboarding.
 */

export interface FeedConfig {
  source_type: string
  source_url: string
  source_label: string
  keywords: string[]
  requires_api_key: boolean
  auto_activated: boolean
  cron_expression: string
}

const REGIONAL_SOURCES: Record<string, FeedConfig[]> = {
  IN: [
    { source_type: 'rss', source_url: 'https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms', source_label: 'Economic Times Tech', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://yourstory.com/feed', source_label: 'YourStory', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://inc42.com/feed/', source_label: 'Inc42', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://www.moneycontrol.com/rss/latestnews.xml', source_label: 'Moneycontrol', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://nasscom.in/feed', source_label: 'NASSCOM', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */12 * * *' },
    { source_type: 'rss', source_url: 'https://entrackr.com/feed/', source_label: 'Entrackr', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://www.tracxn.com/feed', source_label: 'Tracxn', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */12 * * *' },
  ],
  GB: [
    { source_type: 'rss', source_url: 'https://www.eu-startups.com/feed/', source_label: 'EU Startups', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://sifted.eu/feed', source_label: 'Sifted', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://tech.eu/feed/', source_label: 'Tech.eu', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://www.euronews.com/rss?format=mrss&level=theme&name=business', source_label: 'Euronews Business', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
  ],
  EU: [
    { source_type: 'rss', source_url: 'https://www.eu-startups.com/feed/', source_label: 'EU Startups', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://sifted.eu/feed', source_label: 'Sifted', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://tech.eu/feed/', source_label: 'Tech.eu', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
  ],
  AU: [
    { source_type: 'rss', source_url: 'https://www.smartcompany.com.au/feed/', source_label: 'SmartCompany', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://www.crn.com.au/rss/', source_label: 'CRN Australia', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
  ],
  NG: [
    { source_type: 'rss', source_url: 'https://techcabal.com/feed/', source_label: 'TechCabal', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://disrupt-africa.com/feed/', source_label: 'Disrupt Africa', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */12 * * *' },
    { source_type: 'rss', source_url: 'https://ventureburn.com/feed/', source_label: 'Ventureburn', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */12 * * *' },
  ],
  ZA: [
    { source_type: 'rss', source_url: 'https://techcabal.com/feed/', source_label: 'TechCabal', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://ventureburn.com/feed/', source_label: 'Ventureburn', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */12 * * *' },
  ],
  KE: [
    { source_type: 'rss', source_url: 'https://techcabal.com/feed/', source_label: 'TechCabal', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://disrupt-africa.com/feed/', source_label: 'Disrupt Africa', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */12 * * *' },
  ],
  GH: [
    { source_type: 'rss', source_url: 'https://techcabal.com/feed/', source_label: 'TechCabal', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
  ],
  EG: [
    { source_type: 'rss', source_url: 'https://disrupt-africa.com/feed/', source_label: 'Disrupt Africa', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */12 * * *' },
  ],
  AE: [
    { source_type: 'rss', source_url: 'https://wamda.com/feed', source_label: 'Wamda', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */12 * * *' },
    { source_type: 'rss', source_url: 'https://stepconference.com/feed/', source_label: 'Step Feed', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */12 * * *' },
  ],
  SA: [
    { source_type: 'rss', source_url: 'https://wamda.com/feed', source_label: 'Wamda', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */12 * * *' },
  ],
  IL: [
    { source_type: 'rss', source_url: 'https://menabytes.com/feed/', source_label: 'MENA Bytes', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */12 * * *' },
  ],
  SG: [
    { source_type: 'rss', source_url: 'https://e27.co/feed/', source_label: 'e27', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://kr-asia.com/feed', source_label: 'KrASIA', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://www.techinasia.com/feed', source_label: 'Tech In Asia', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
  ],
  MY: [
    { source_type: 'rss', source_url: 'https://e27.co/feed/', source_label: 'e27', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://www.techinasia.com/feed', source_label: 'Tech In Asia', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
  ],
  ID: [
    { source_type: 'rss', source_url: 'https://e27.co/feed/', source_label: 'e27', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
    { source_type: 'rss', source_url: 'https://kr-asia.com/feed', source_label: 'KrASIA', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
  ],
  PH: [
    { source_type: 'rss', source_url: 'https://e27.co/feed/', source_label: 'e27', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
  ],
  VN: [
    { source_type: 'rss', source_url: 'https://e27.co/feed/', source_label: 'e27', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
  ],
  TH: [
    { source_type: 'rss', source_url: 'https://e27.co/feed/', source_label: 'e27', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
  ],
  US: [
    { source_type: 'rss', source_url: 'https://techcrunch.com/feed/', source_label: 'TechCrunch', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */3 * * *' },
    { source_type: 'rss', source_url: 'https://venturebeat.com/feed/', source_label: 'VentureBeat', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */3 * * *' },
    { source_type: 'hackernews', source_url: '', source_label: 'Hacker News', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */3 * * *' },
  ],
  CA: [
    { source_type: 'rss', source_url: 'https://techcrunch.com/feed/', source_label: 'TechCrunch', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */3 * * *' },
  ],
}

// Default global sources for countries not in the map
const DEFAULT_SOURCES: FeedConfig[] = [
  { source_type: 'rss', source_url: 'https://techcrunch.com/feed/', source_label: 'TechCrunch', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
  { source_type: 'hackernews', source_url: '', source_label: 'Hacker News', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
]

/**
 * Universal sources — seeded for EVERY org regardless of country or industry.
 * Only truly cross-vertical sources belong here:
 *   - Tavily: AI search driven by org's own themes → adapts to any industry
 *   - Hacker News: AI/tech disruption is relevant to every industry now
 */
const UNIVERSAL_SOURCES: FeedConfig[] = [
  { source_type: 'tavily',     source_url: '',  source_label: 'Tavily Search', keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */12 * * *' },
  { source_type: 'hackernews', source_url: '',  source_label: 'Hacker News',   keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' },
]

// Helper to build a FeedConfig quickly
function rss(url: string, label: string): FeedConfig {
  return { source_type: 'rss', source_url: url, source_label: label, keywords: [], requires_api_key: false, auto_activated: true, cron_expression: '0 */6 * * *' }
}

/**
 * Industry-specific free RSS sources, keyed by the exact values in the
 * INDUSTRIES constant in apps/web/lib/constants.ts.
 * Multiple industry strings can share the same feed set.
 */
const INDUSTRY_SOURCES: Record<string, FeedConfig[]> = {
  // ── Tech & Software ───────────────────────────────────────────────────────
  'Software / SaaS':                    [rss('https://techcrunch.com/feed/', 'TechCrunch'), rss('https://www.saastr.com/feed/', 'SaaStr'), rss('https://www.producthunt.com/feed', 'Product Hunt'), rss('https://martech.org/feed/', 'MarTech Today')],
  'Information Technology & Services':  [rss('https://techcrunch.com/feed/', 'TechCrunch'), rss('https://venturebeat.com/feed/', 'VentureBeat'), rss('https://www.producthunt.com/feed', 'Product Hunt')],
  'Computer Software':                  [rss('https://techcrunch.com/feed/', 'TechCrunch'), rss('https://www.saastr.com/feed/', 'SaaStr'), rss('https://www.producthunt.com/feed', 'Product Hunt')],
  'Internet':                           [rss('https://techcrunch.com/feed/', 'TechCrunch'), rss('https://www.producthunt.com/feed', 'Product Hunt'), rss('https://venturebeat.com/feed/', 'VentureBeat')],
  'Artificial Intelligence':            [rss('https://techcrunch.com/feed/', 'TechCrunch'), rss('https://venturebeat.com/feed/', 'VentureBeat'), rss('https://www.producthunt.com/feed', 'Product Hunt'), rss('https://www.technologyreview.com/feed/', 'MIT Tech Review')],
  'Cybersecurity':                      [rss('https://krebsonsecurity.com/feed/', 'Krebs on Security'), rss('https://www.darkreading.com/rss.xml', 'Dark Reading'), rss('https://www.bleepingcomputer.com/feed/', 'Bleeping Computer'), rss('https://techcrunch.com/feed/', 'TechCrunch')],
  'Cloud Infrastructure':               [rss('https://techcrunch.com/feed/', 'TechCrunch'), rss('https://venturebeat.com/feed/', 'VentureBeat'), rss('https://www.theregister.com/rss/all.atom', 'The Register')],
  'Data & Analytics':                   [rss('https://techcrunch.com/feed/', 'TechCrunch'), rss('https://venturebeat.com/feed/', 'VentureBeat'), rss('https://www.dataversity.net/feed/', 'DATAVERSITY')],
  'DevTools / Developer Platforms':     [rss('https://techcrunch.com/feed/', 'TechCrunch'), rss('https://www.producthunt.com/feed', 'Product Hunt'), rss('https://dev.to/feed', 'DEV Community')],

  // ── Financial & Professional Services ─────────────────────────────────────
  'FinTech':                            [rss('https://www.finextra.com/rss/headlines.xml', 'Finextra'), rss('https://www.pymnts.com/feed/', 'PYMNTS'), rss('https://www.fintechfutures.com/feed/', 'FinTech Futures'), rss('https://techcrunch.com/feed/', 'TechCrunch')],
  'Financial Services':                 [rss('https://www.finextra.com/rss/headlines.xml', 'Finextra'), rss('https://www.pymnts.com/feed/', 'PYMNTS'), rss('https://www.bankingtech.com/feed/', 'Banking Technology')],
  'Banking':                            [rss('https://www.finextra.com/rss/headlines.xml', 'Finextra'), rss('https://www.bankingtech.com/feed/', 'Banking Technology'), rss('https://www.pymnts.com/feed/', 'PYMNTS')],
  'Insurance':                          [rss('https://www.insurancejournal.com/rss/news/', 'Insurance Journal'), rss('https://www.finextra.com/rss/headlines.xml', 'Finextra')],
  'Investment Management':              [rss('https://www.finextra.com/rss/headlines.xml', 'Finextra'), rss('https://techcrunch.com/feed/', 'TechCrunch')],
  'Accounting':                         [rss('https://www.accountingtoday.com/rss/news', 'Accounting Today'), rss('https://www.finextra.com/rss/headlines.xml', 'Finextra')],
  'Management Consulting':              [rss('https://techcrunch.com/feed/', 'TechCrunch'), rss('https://www.consultancy.uk/rss', 'Consultancy.uk'), rss('https://www.saastr.com/feed/', 'SaaStr')],
  'Legal Services':                     [rss('https://abovethelaw.com/feed/', 'Above The Law'), rss('https://techcrunch.com/feed/', 'TechCrunch')],
  'Professional Services':              [rss('https://techcrunch.com/feed/', 'TechCrunch'), rss('https://www.saastr.com/feed/', 'SaaStr')],
  'Staffing & Recruiting':              [rss('https://hrexecutive.com/feed/', 'HR Executive'), rss('https://www.hrdive.com/feeds/news/', 'HR Dive'), rss('https://recruitingdaily.com/feed/', 'Recruiting Daily')],

  // ── Marketing & Media ─────────────────────────────────────────────────────
  'Marketing & Advertising':            [rss('https://martech.org/feed/', 'MarTech Today'), rss('https://www.adweek.com/feed/', 'Adweek'), rss('https://contentmarketinginstitute.com/feed/', 'CMI'), rss('https://www.searchenginejournal.com/feed/', 'Search Engine Journal')],
  'Public Relations & Communications':  [rss('https://www.prnewser.com/feed', 'PRNewser'), rss('https://martech.org/feed/', 'MarTech Today')],
  'Media Production':                   [rss('https://variety.com/feed/', 'Variety'), rss('https://deadline.com/feed/', 'Deadline')],
  'Online Media':                       [rss('https://techcrunch.com/feed/', 'TechCrunch'), rss('https://www.niemanlab.org/feed/', 'Nieman Lab')],
  'Publishing':                         [rss('https://www.niemanlab.org/feed/', 'Nieman Lab'), rss('https://publishingperspectives.com/feed/', 'Publishing Perspectives')],
  'Entertainment':                      [rss('https://variety.com/feed/', 'Variety'), rss('https://deadline.com/feed/', 'Deadline'), rss('https://techcrunch.com/feed/', 'TechCrunch')],

  // ── Healthcare & Life Sciences ─────────────────────────────────────────────
  'Healthcare':                         [rss('https://www.statnews.com/feed/', 'STAT News'), rss('https://medcitynews.com/feed/', 'MedCity News'), rss('https://www.healthcareitnews.com/rss.xml', 'Healthcare IT News')],
  'Hospital & Health Care':             [rss('https://www.statnews.com/feed/', 'STAT News'), rss('https://www.fiercehealthcare.com/rss/xml', 'Fierce Healthcare'), rss('https://www.healthcareitnews.com/rss.xml', 'Healthcare IT News')],
  'Pharmaceuticals':                    [rss('https://www.statnews.com/feed/', 'STAT News'), rss('https://www.fiercepharma.com/rss/xml', 'Fierce Pharma'), rss('https://www.pharmexec.com/rss/all', 'Pharmaceutical Executive')],
  'Biotechnology':                      [rss('https://www.statnews.com/feed/', 'STAT News'), rss('https://www.fiercebiotech.com/rss/xml', 'Fierce Biotech')],
  'Medical Devices':                    [rss('https://www.meddeviceonline.com/rss/', 'Med Device Online'), rss('https://www.statnews.com/feed/', 'STAT News')],
  'Health Tech':                        [rss('https://medcitynews.com/feed/', 'MedCity News'), rss('https://www.statnews.com/feed/', 'STAT News'), rss('https://www.healthcareitnews.com/rss.xml', 'Healthcare IT News')],

  // ── Industrial & Physical ──────────────────────────────────────────────────
  'Manufacturing':                      [rss('https://www.industryweek.com/rss/articles', 'IndustryWeek'), rss('https://www.themanufacturer.com/feed/', 'The Manufacturer'), rss('https://www.automationworld.com/rss.xml', 'Automation World')],
  'Industrial Automation':              [rss('https://www.automationworld.com/rss.xml', 'Automation World'), rss('https://www.industryweek.com/rss/articles', 'IndustryWeek'), rss('https://www.controleng.com/rss/', 'Control Engineering')],
  'Automotive':                         [rss('https://techcrunch.com/feed/', 'TechCrunch'), rss('https://electrek.co/feed/', 'Electrek'), rss('https://www.automotiveworld.com/feed/', 'Automotive World')],
  'Aerospace & Defense':                [rss('https://www.aviationweek.com/rss/all', 'Aviation Week'), rss('https://techcrunch.com/feed/', 'TechCrunch')],
  'Construction':                       [rss('https://www.constructiondive.com/feeds/news/', 'Construction Dive'), rss('https://www.enr.com/rss/all', 'Engineering News-Record')],
  'Real Estate':                        [rss('https://therealdeal.com/feed/', 'The Real Deal'), rss('https://www.housingwire.com/feed/', 'HousingWire'), rss('https://www.propmodo.com/feed/', 'Propmodo')],
  'PropTech':                           [rss('https://www.propmodo.com/feed/', 'Propmodo'), rss('https://therealdeal.com/feed/', 'The Real Deal'), rss('https://techcrunch.com/feed/', 'TechCrunch')],
  'Logistics & Supply Chain':           [rss('https://www.supplychaindive.com/feeds/news/', 'Supply Chain Dive'), rss('https://www.freightwaves.com/news/feed', 'FreightWaves')],
  'Transportation':                     [rss('https://techcrunch.com/feed/', 'TechCrunch'), rss('https://www.supplychaindive.com/feeds/news/', 'Supply Chain Dive')],

  // ── Consumer & Commerce ───────────────────────────────────────────────────
  'Retail':                             [rss('https://www.retaildive.com/feeds/news/', 'Retail Dive'), rss('https://www.modernretail.co/feed/', 'Modern Retail'), rss('https://www.retailtechnology.co.uk/feed/', 'Retail Technology')],
  'E-commerce':                         [rss('https://www.modernretail.co/feed/', 'Modern Retail'), rss('https://www.practicalecommerce.com/feed', 'Practical Ecommerce'), rss('https://www.retaildive.com/feeds/news/', 'Retail Dive')],
  'Consumer Goods':                     [rss('https://www.consumergoods.com/rss.xml', 'Consumer Goods Technology'), rss('https://www.retaildive.com/feeds/news/', 'Retail Dive')],
  'Food & Beverage':                    [rss('https://www.fooddive.com/feeds/news/', 'Food Dive'), rss('https://www.foodnavigator.com/rss/', 'Food Navigator'), rss('https://www.nrn.com/rss.xml', "Nation's Restaurant News")],
  'Hospitality':                        [rss('https://skift.com/feed/', 'Skift'), rss('https://www.hospitalitynet.org/rss/', 'Hospitality Net'), rss('https://www.hotelmanagement.net/rss.xml', 'Hotel Management')],
  'Travel & Leisure':                   [rss('https://skift.com/feed/', 'Skift'), rss('https://www.phocuswire.com/rss', 'Phocuswire'), rss('https://travelpulse.com/feed/', 'TravelPulse')],

  // ── Energy & Resources ────────────────────────────────────────────────────
  'Energy':                             [rss('https://www.utilitydive.com/feeds/news/', 'Utility Dive'), rss('https://www.energymonitor.ai/feed/', 'Energy Monitor')],
  'Renewables / CleanTech':             [rss('https://www.canarymedia.com/rss', 'Canary Media'), rss('https://electrek.co/feed/', 'Electrek'), rss('https://www.greenbiz.com/rss.xml', 'GreenBiz')],
  'Oil & Gas':                          [rss('https://www.oilprice.com/rss/main', 'OilPrice.com'), rss('https://www.rigzone.com/news/rss/rigzone_latest.aspx', 'Rigzone')],
  'Utilities':                          [rss('https://www.utilitydive.com/feeds/news/', 'Utility Dive'), rss('https://www.energymonitor.ai/feed/', 'Energy Monitor')],
  'Mining & Metals':                    [rss('https://www.mining.com/feed/', 'MINING.com')],

  // ── Public & Social ───────────────────────────────────────────────────────
  'Government / Public Sector':         [rss('https://www.govtech.com/rss/', 'Government Technology'), rss('https://techcrunch.com/feed/', 'TechCrunch')],
  'Education':                          [rss('https://www.edweek.org/feed/', 'Education Week'), rss('https://edsurge.com/news.rss', 'EdSurge')],
  'EdTech':                             [rss('https://edsurge.com/news.rss', 'EdSurge'), rss('https://techcrunch.com/feed/', 'TechCrunch'), rss('https://www.producthunt.com/feed', 'Product Hunt')],
  'Higher Education':                   [rss('https://www.insidehighered.com/rss.xml', 'Inside Higher Ed'), rss('https://www.edweek.org/feed/', 'Education Week')],
  'Non-profit':                         [rss('https://nonprofitquarterly.org/feed/', 'Nonprofit Quarterly'), rss('https://techcrunch.com/feed/', 'TechCrunch')],
  'Research':                           [rss('https://www.technologyreview.com/feed/', 'MIT Tech Review'), rss('https://techcrunch.com/feed/', 'TechCrunch')],

  // ── Telecom ───────────────────────────────────────────────────────────────
  'Telecommunications':                 [rss('https://www.lightreading.com/rss', 'Light Reading'), rss('https://www.fiercetelecom.com/rss/xml', 'Fierce Telecom'), rss('https://techcrunch.com/feed/', 'TechCrunch')],
}

/**
 * Returns industry-specific RSS feeds for a given industry_sector value.
 * Falls back to TechCrunch + Product Hunt for unknown industries.
 */
export function getIndustrySources(industrySector: string): FeedConfig[] {
  return INDUSTRY_SOURCES[industrySector ?? ''] ?? [
    rss('https://techcrunch.com/feed/', 'TechCrunch'),
    rss('https://www.producthunt.com/feed', 'Product Hunt'),
  ]
}

export function getRegionalSources(countryCode: string): FeedConfig[] {
  const regional = REGIONAL_SOURCES[countryCode?.toUpperCase()] ?? []
  // Merge universal + regional, deduplicating by source_url+source_type
  const seen = new Set<string>()
  const merged: FeedConfig[] = []
  for (const s of [...UNIVERSAL_SOURCES, ...regional]) {
    const key = `${s.source_type}::${s.source_url}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(s)
    }
  }
  return merged
}
