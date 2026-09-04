import type { Config, WidgetInstance } from '../model/types';

/**
 * Hand-built editor state that should reproduce `docs/glance.yml` — the
 * starter config shipped with Glance. Used as the emitter's golden target.
 */

let n = 0;
const id = () => `fixture-${(n += 1)}`;

const w = (type: string, props: Record<string, unknown> = {}, children?: WidgetInstance[]): WidgetInstance =>
  children ? { id: id(), type, props, children } : { id: id(), type, props };

export const docsFixture: Config = {
  pages: [
    {
      id: id(),
      name: 'Home',
      columns: [
        {
          id: id(),
          size: 'small',
          widgets: [
            w('calendar', { 'first-day-of-week': 'monday' }),
            w('rss', {
              limit: 10,
              'collapse-after': 3,
              cache: '12h',
              feeds: [
                { url: 'https://selfh.st/rss/', title: 'selfh.st', limit: 4 },
                { url: 'https://ciechanow.ski/atom.xml' },
                { url: 'https://www.joshwcomeau.com/rss.xml', title: 'Josh Comeau' },
                { url: 'https://samwho.dev/rss.xml' },
                { url: 'https://ishadeed.com/feed.xml', title: 'Ahmad Shadeed' },
              ],
            }),
            w('twitch-channels', {
              channels: ['theprimeagen', 'j_blow', 'giantwaffle', 'cohhcarnage', 'christitustech', 'EJ_SA'],
            }),
          ],
        },
        {
          id: id(),
          size: 'full',
          widgets: [
            w('group', {}, [w('hacker-news'), w('lobsters')]),
            w('videos', {
              channels: [
                'UCXuqSBlHAE6Xw-yeJA0Tunw',
                'UCR-DXc1voovS8nhAvccRZhg',
                'UCsBjURrPoezykLs9EqgamOA',
                'UCBJycsmduvYEL83R_U4JriQ',
                'UCHnyfMqiRRG1u-2MsSQLbXA',
              ],
            }),
            w('group', {}, [
              w('reddit', { subreddit: 'technology', 'show-thumbnails': true }),
              w('reddit', { subreddit: 'selfhosted', 'show-thumbnails': true }),
            ]),
          ],
        },
        {
          id: id(),
          size: 'small',
          widgets: [
            w('weather', { location: 'London, United Kingdom', units: 'metric', 'hour-format': '12h' }),
            w('markets', {
              markets: [
                { symbol: 'SPY', name: 'S&P 500' },
                { symbol: 'BTC-USD', name: 'Bitcoin' },
                { symbol: 'NVDA', name: 'NVIDIA' },
                { symbol: 'AAPL', name: 'Apple' },
                { symbol: 'MSFT', name: 'Microsoft' },
              ],
            }),
            w('releases', {
              cache: '1d',
              repositories: ['glanceapp/glance', 'go-gitea/gitea', 'immich-app/immich', 'syncthing/syncthing'],
            }),
          ],
        },
      ],
    },
  ],
};
