import type { WidgetDef } from './types';

/**
 * Every widget type Glance accepts, from the dispatch switch in
 * `internal/glance/widget.go`. Defaults mirror each widget's `initialize()`
 * so the emitter can omit values the user never changed.
 *
 * Note: Glance also accepts `stocks` as a legacy alias for `markets`. Only
 * `markets` is offered here.
 */
export const WIDGETS: WidgetDef[] = [
  // ---------------------------------------------------------------- Feeds
  {
    type: 'rss',
    label: 'RSS',
    category: 'Feeds',
    description: 'Latest items from any set of RSS or Atom feeds.',
    fields: [
      {
        kind: 'objectList',
        key: 'feeds',
        label: 'Feeds',
        required: true,
        summaryKey: 'url',
        fields: [
          { kind: 'url', key: 'url', label: 'Feed URL', required: true, placeholder: 'https://example.com/rss.xml' },
          { kind: 'string', key: 'title', label: 'Title', placeholder: 'from the feed' },
          { kind: 'number', key: 'limit', label: 'Item limit', min: 1 },
        ],
      },
      { kind: 'enum', key: 'style', label: 'Style', options: ['vertical-list', 'detailed-list', 'horizontal-cards', 'horizontal-cards-2'], default: 'vertical-list' },
      { kind: 'number', key: 'limit', label: 'Limit', min: 1, default: 25 },
      { kind: 'number', key: 'collapse-after', label: 'Collapse after', default: 5, help: '-1 never collapses.' },
    ],
  },
  {
    type: 'hacker-news',
    label: 'Hacker News',
    category: 'Feeds',
    description: 'Top posts from Hacker News.',
    fields: [
      { kind: 'enum', key: 'sort-by', label: 'Sort by', options: ['top', 'new', 'best'], default: 'top' },
      { kind: 'number', key: 'limit', label: 'Limit', min: 1, default: 15 },
      { kind: 'number', key: 'collapse-after', label: 'Collapse after', default: 5 },
    ],
  },
  {
    type: 'lobsters',
    label: 'Lobsters',
    category: 'Feeds',
    description: 'Posts from lobste.rs or a compatible instance.',
    fields: [
      { kind: 'enum', key: 'sort-by', label: 'Sort by', options: ['hot', 'new'], default: 'hot' },
      { kind: 'stringList', key: 'tags', label: 'Tags', itemPlaceholder: 'programming' },
      { kind: 'number', key: 'limit', label: 'Limit', min: 1, default: 15 },
      { kind: 'number', key: 'collapse-after', label: 'Collapse after', default: 5 },
    ],
  },
  {
    type: 'reddit',
    label: 'Reddit',
    category: 'Feeds',
    description: 'Posts from a single subreddit.',
    fields: [
      { kind: 'string', key: 'subreddit', label: 'Subreddit', required: true, placeholder: 'selfhosted', help: 'Name only, without /r/.' },
      { kind: 'enum', key: 'style', label: 'Style', options: ['vertical-list', 'horizontal-cards', 'vertical-cards'], default: 'vertical-list' },
      { kind: 'enum', key: 'sort-by', label: 'Sort by', options: ['hot', 'new', 'top', 'rising'], default: 'hot' },
      { kind: 'boolean', key: 'show-thumbnails', label: 'Show thumbnails', default: false },
      { kind: 'number', key: 'limit', label: 'Limit', min: 1, default: 15 },
      { kind: 'number', key: 'collapse-after', label: 'Collapse after', default: 5 },
    ],
  },
  {
    type: 'releases',
    label: 'Releases',
    category: 'Feeds',
    description: 'Newest releases from GitLab, GitHub, Docker Hub or Codeberg repositories.',
    fields: [
      {
        kind: 'stringList',
        key: 'repositories',
        label: 'Repositories',
        required: true,
        itemPlaceholder: 'glanceapp/glance',
        help: 'Prefix with gitlab:, dockerhub: or codeberg: for non-GitHub sources.',
      },
      { kind: 'secret', key: 'token', label: 'GitHub token', placeholder: '${GITHUB_TOKEN}', help: 'Raises the API rate limit past 60 requests/hour.' },
      { kind: 'number', key: 'limit', label: 'Limit', min: 1, default: 10 },
    ],
  },
  {
    type: 'change-detection',
    label: 'Change Detection',
    category: 'Feeds',
    description: 'Recently changed pages from a changedetection.io instance.',
    fields: [
      { kind: 'url', key: 'instance-url', label: 'Instance URL', placeholder: 'https://www.changedetection.io' },
      { kind: 'secret', key: 'token', label: 'API token', placeholder: '${CHANGEDETECTION_TOKEN}' },
      { kind: 'stringList', key: 'watches', label: 'Watch UUIDs', itemPlaceholder: 'f5c1e4d0-…', help: 'Leave empty to show all watches.' },
      { kind: 'number', key: 'limit', label: 'Limit', min: 1, default: 10 },
    ],
  },

  // ----------------------------------------------------------- Monitoring
  {
    type: 'monitor',
    label: 'Monitor',
    category: 'Monitoring',
    description: 'Up/down status and response time for a list of services.',
    fields: [
      {
        kind: 'objectList',
        key: 'sites',
        label: 'Sites',
        required: true,
        summaryKey: 'title',
        fields: [
          { kind: 'string', key: 'title', label: 'Title', required: true, placeholder: 'Jellyfin' },
          { kind: 'url', key: 'url', label: 'URL', required: true, placeholder: 'https://jellyfin.example.com' },
          { kind: 'string', key: 'icon', label: 'Icon', placeholder: 'si:jellyfin', help: 'Prefixes: si:, sh:, di:, mdi: or a full image URL.' },
          { kind: 'url', key: 'check-url', label: 'Check URL', placeholder: 'same as URL' },
          { kind: 'boolean', key: 'allow-insecure', label: 'Allow insecure TLS' },
        ],
      },
      { kind: 'enum', key: 'style', label: 'Style', options: ['compact', 'dynamic-columns'], default: 'compact' },
      { kind: 'boolean', key: 'show-failing-only', label: 'Show failing only', default: false },
    ],
  },
  {
    type: 'dns-stats',
    label: 'DNS Stats',
    category: 'Monitoring',
    description: 'Query and block statistics from AdGuard Home, Pi-hole or Technitium.',
    fields: [
      { kind: 'enum', key: 'service', label: 'Service', options: ['adguard', 'pihole', 'pihole-v6', 'technitium'], required: true },
      { kind: 'url', key: 'url', label: 'Instance URL', required: true, placeholder: 'https://adguard.example.com' },
      { kind: 'secret', key: 'token', label: 'Token / API key', placeholder: '${DNS_TOKEN}', help: 'Used by pihole-v6 and technitium.' },
      { kind: 'string', key: 'username', label: 'Username', help: 'AdGuard Home only.' },
      { kind: 'secret', key: 'password', label: 'Password', placeholder: '${DNS_PASSWORD}' },
      { kind: 'boolean', key: 'hide-graph', label: 'Hide graph' },
      { kind: 'boolean', key: 'hide-top-domains', label: 'Hide top domains' },
    ],
  },
  {
    type: 'docker-containers',
    label: 'Docker Containers',
    category: 'Monitoring',
    description: 'Status of local Docker containers, configured through container labels.',
    fields: [
      { kind: 'string', key: 'sock-path', label: 'Socket path', placeholder: '/var/run/docker.sock' },
      { kind: 'boolean', key: 'running-only', label: 'Running only', default: false },
      { kind: 'boolean', key: 'hide-by-default', label: 'Hide by default', default: false, help: 'Only show containers labelled glance.hide=false.' },
      { kind: 'string', key: 'category', label: 'Category filter' },
    ],
  },
  {
    type: 'server-stats',
    label: 'Server Stats',
    category: 'Monitoring',
    description: 'CPU, memory and disk usage. Marked work-in-progress upstream.',
    fields: [
      {
        kind: 'objectList',
        key: 'servers',
        label: 'Servers',
        summaryKey: 'name',
        fields: [
          { kind: 'enum', key: 'type', label: 'Type', options: ['local', 'remote'], default: 'local' },
          { kind: 'string', key: 'name', label: 'Name', placeholder: 'Home server' },
          { kind: 'url', key: 'url', label: 'URL', help: 'Remote only.' },
          { kind: 'secret', key: 'token', label: 'Token', placeholder: '${SERVER_STATS_TOKEN}' },
        ],
      },
    ],
  },
  {
    type: 'process-stats',
    label: 'Process Stats',
    category: 'Monitoring',
    description: 'CPU, memory and uptime of the Glance process itself rather than the whole machine.',
    fields: [],
  },
  {
    type: 'repository',
    label: 'Repository',
    category: 'Monitoring',
    description: 'Stars, open issues and pull requests for one repository.',
    fields: [
      { kind: 'string', key: 'repository', label: 'Repository', required: true, placeholder: 'glanceapp/glance' },
      { kind: 'secret', key: 'token', label: 'GitHub token', placeholder: '${GITHUB_TOKEN}' },
      { kind: 'number', key: 'pull-requests-limit', label: 'Pull requests', default: 3 },
      { kind: 'number', key: 'issues-limit', label: 'Issues', default: 3 },
      { kind: 'number', key: 'commits-limit', label: 'Commits', default: -1, help: '-1 hides commits.' },
    ],
  },

  // ---------------------------------------------------------------- Media
  {
    type: 'videos',
    label: 'Videos',
    category: 'Media',
    description: 'Latest videos from YouTube channels or playlists.',
    fields: [
      { kind: 'stringList', key: 'channels', label: 'Channel IDs', required: true, itemPlaceholder: 'UCXuqSBlHAE6Xw-yeJA0Tunw' },
      { kind: 'stringList', key: 'playlists', label: 'Playlist IDs', itemPlaceholder: 'PL…' },
      { kind: 'enum', key: 'style', label: 'Style', options: ['horizontal-cards', 'vertical-list', 'grid-cards'], default: 'horizontal-cards' },
      { kind: 'number', key: 'limit', label: 'Limit', min: 1, default: 25 },
      { kind: 'boolean', key: 'include-shorts', label: 'Include shorts', default: false },
    ],
  },
  {
    type: 'twitch-channels',
    label: 'Twitch Channels',
    category: 'Media',
    description: 'Live status for a list of Twitch channels.',
    fields: [
      { kind: 'stringList', key: 'channels', label: 'Channels', required: true, itemPlaceholder: 'theprimeagen' },
      { kind: 'enum', key: 'sort-by', label: 'Sort by', options: ['viewers', 'live'], default: 'viewers' },
      { kind: 'number', key: 'collapse-after', label: 'Collapse after', default: 5 },
    ],
  },
  {
    type: 'twitch-top-games',
    label: 'Twitch Top Games',
    category: 'Media',
    description: 'Most watched categories on Twitch.',
    fields: [
      { kind: 'stringList', key: 'exclude', label: 'Exclude', itemPlaceholder: 'just-chatting' },
      { kind: 'number', key: 'limit', label: 'Limit', min: 1, default: 10 },
      { kind: 'number', key: 'collapse-after', label: 'Collapse after', default: 5 },
    ],
  },
  {
    type: 'markets',
    label: 'Markets',
    category: 'Media',
    description: 'Price and daily change for stocks, crypto and indices.',
    fields: [
      {
        kind: 'objectList',
        key: 'markets',
        label: 'Markets',
        required: true,
        summaryKey: 'symbol',
        fields: [
          { kind: 'string', key: 'symbol', label: 'Symbol', required: true, placeholder: 'BTC-USD' },
          { kind: 'string', key: 'name', label: 'Name', placeholder: 'Bitcoin' },
        ],
      },
      { kind: 'enum', key: 'sort-by', label: 'Sort by', options: ['absolute-change', 'change'], default: 'change' },
    ],
  },

  // -------------------------------------------------------------- Utility
  {
    type: 'ical',
    label: 'iCal',
    category: 'Utility',
    description: "Today's events from one or more .ics calendar feeds.",
    fields: [
      {
        kind: 'objectList',
        key: 'calendars',
        label: 'Calendars',
        required: true,
        summaryKey: 'name',
        fields: [
          {
            kind: 'secret',
            key: 'url',
            label: 'Feed URL',
            required: true,
            placeholder: '${WORK_CALENDAR_URL}',
            help: 'webcal:// subscribe links work. An .ics URL is a secret — prefer an environment variable.',
          },
          { kind: 'string', key: 'name', label: 'Name', placeholder: 'Work' },
        ],
      },
      { kind: 'number', key: 'days', label: 'Days ahead', min: 1, default: 1, help: '1 shows today only.' },
      { kind: 'number', key: 'limit', label: 'Limit', min: 1, default: 10 },
      { kind: 'string', key: 'timezone', label: 'Timezone', placeholder: 'Europe/London' },
      { kind: 'enum', key: 'hour-format', label: 'Hour format', options: ['12h', '24h'], default: '24h' },
    ],
  },
  {
    type: 'calendar',
    label: 'Calendar',
    category: 'Utility',
    description: 'Month view of the current date.',
    fields: [
      {
        kind: 'enum',
        key: 'first-day-of-week',
        label: 'First day of week',
        options: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        default: 'monday',
      },
    ],
  },
  {
    type: 'calendar-legacy',
    label: 'Calendar (legacy)',
    category: 'Utility',
    description: 'The pre-rewrite calendar, kept for compatibility.',
    fields: [{ kind: 'boolean', key: 'start-sunday', label: 'Start on Sunday', default: false }],
  },
  {
    type: 'clock',
    label: 'Clock',
    category: 'Utility',
    description: 'Local time, optionally alongside other timezones.',
    fields: [
      { kind: 'enum', key: 'hour-format', label: 'Hour format', options: ['12h', '24h'], default: '24h' },
      {
        kind: 'objectList',
        key: 'timezones',
        label: 'Timezones',
        summaryKey: 'timezone',
        fields: [
          { kind: 'string', key: 'timezone', label: 'Timezone', required: true, placeholder: 'Europe/London', help: 'IANA name.' },
          { kind: 'string', key: 'label', label: 'Label', placeholder: 'London' },
        ],
      },
    ],
  },
  {
    type: 'weather',
    label: 'Weather',
    category: 'Utility',
    description: 'Current conditions and an hourly forecast bar.',
    fields: [
      { kind: 'string', key: 'location', label: 'Location', required: true, placeholder: 'London, United Kingdom' },
      { kind: 'enum', key: 'units', label: 'Units', options: ['metric', 'imperial'], default: 'metric' },
      { kind: 'enum', key: 'hour-format', label: 'Hour format', options: ['12h', '24h'], default: '12h' },
      { kind: 'boolean', key: 'hide-location', label: 'Hide location', default: false },
    ],
  },
  {
    type: 'bookmarks',
    label: 'Bookmarks',
    category: 'Utility',
    description: 'Grouped lists of links.',
    fields: [
      {
        kind: 'objectList',
        key: 'groups',
        label: 'Groups',
        required: true,
        summaryKey: 'title',
        fields: [
          { kind: 'string', key: 'title', label: 'Group title', placeholder: 'Services' },
          {
            kind: 'objectList',
            key: 'links',
            label: 'Links',
            required: true,
            summaryKey: 'title',
            fields: [
              { kind: 'string', key: 'title', label: 'Title', required: true, placeholder: 'Jellyfin' },
              { kind: 'url', key: 'url', label: 'URL', required: true, placeholder: 'https://…' },
              { kind: 'string', key: 'icon', label: 'Icon', placeholder: 'si:jellyfin' },
            ],
          },
        ],
      },
    ],
  },
  {
    type: 'search',
    label: 'Search',
    category: 'Utility',
    description: 'A search box with configurable engine and bangs.',
    fields: [
      {
        kind: 'string',
        key: 'search-engine',
        label: 'Search engine',
        placeholder: 'duckduckgo',
        help: 'A preset (duckduckgo, google, bing, perplexity, kagi, startpage) or a URL containing {QUERY}.',
      },
      { kind: 'string', key: 'placeholder', label: 'Placeholder text' },
      { kind: 'boolean', key: 'autofocus', label: 'Autofocus', default: false },
      { kind: 'boolean', key: 'new-tab', label: 'Open in new tab', default: false },
    ],
  },
  {
    type: 'to-do',
    label: 'To-do',
    category: 'Utility',
    description: 'A checklist. Items live in the browser, not in the config.',
    fields: [
      { kind: 'string', key: 'id', label: 'Storage id', help: 'Change this to keep separate lists apart on the same browser.' },
    ],
  },
  {
    type: 'iframe',
    label: 'iframe',
    category: 'Utility',
    description: 'Embeds an external page.',
    fields: [
      { kind: 'url', key: 'source', label: 'Source URL', required: true, placeholder: 'https://…' },
      { kind: 'number', key: 'height', label: 'Height (px)', min: 50, default: 300 },
    ],
  },

  // --------------------------------------------------------------- Layout
  {
    type: 'group',
    label: 'Group',
    category: 'Layout',
    description: 'Stacks widgets behind tabs to save vertical space.',
    container: true,
    fields: [],
  },
  {
    type: 'split-column',
    label: 'Split Column',
    category: 'Layout',
    description: 'Splits a column into side-by-side sub-columns.',
    container: true,
    fields: [{ kind: 'number', key: 'max-columns', label: 'Max columns', min: 2, default: 2 }],
  },

  // ------------------------------------------------------------- Advanced
  {
    type: 'html',
    label: 'HTML',
    category: 'Advanced',
    description: 'Raw HTML, rendered as-is.',
    fields: [{ kind: 'text', key: 'source', label: 'HTML', required: true }],
  },
  {
    type: 'extension',
    label: 'Extension',
    category: 'Advanced',
    description: 'Renders content served by an external extension endpoint.',
    fields: [
      { kind: 'url', key: 'url', label: 'Extension URL', required: true, placeholder: 'https://…' },
      { kind: 'boolean', key: 'allow-potentially-dangerous-html', label: 'Allow dangerous HTML', default: false },
    ],
  },
  {
    type: 'custom-api',
    label: 'Custom API',
    category: 'Advanced',
    description: 'Fetches JSON and renders it with a Go template. See docs/custom-api.md.',
    fields: [
      { kind: 'url', key: 'url', label: 'API URL', required: true, placeholder: 'https://api.example.com/data' },
      { kind: 'text', key: 'template', label: 'Template', required: true, help: 'Go template over the JSON response.' },
    ],
  },
];

export const WIDGETS_BY_TYPE: ReadonlyMap<string, WidgetDef> = new Map(
  WIDGETS.map((w) => [w.type, w]),
);

/** Container widgets may not nest further containers (Glance rejects it). */
export function allowedChildTypes(): WidgetDef[] {
  return WIDGETS.filter((w) => !w.container);
}
