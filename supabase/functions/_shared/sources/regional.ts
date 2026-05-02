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

export function getRegionalSources(countryCode: string): FeedConfig[] {
  return REGIONAL_SOURCES[countryCode?.toUpperCase()] || DEFAULT_SOURCES
}
