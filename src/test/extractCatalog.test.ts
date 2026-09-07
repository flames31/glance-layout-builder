import { describe, expect, it } from 'vitest';
import {
  buildCatalog,
  keysOf,
  kindOf,
  parseStructs,
  parseTypeSwitch,
} from '../../scripts/extract-catalog';

/** A miniature of the real file: the switch, plus the structs it names. */
const SOURCE = `
func newWidget(widgetType string) (widget, error) {
	if widgetType == "" {
		return nil, errors.New("empty")
	}

	var w widget

	switch widgetType {
	case "clock":
		w = &clockWidget{}
	case "markets", "stocks":
		w = &marketsWidget{}
	case "group":
		w = &groupWidget{}
	default:
		return nil, fmt.Errorf("unknown widget type: %s", widgetType)
	}

	w.setID(widgetIDCounter.Add(1))

	return w, nil
}

type widgetBase struct {
	ID                  uint64           \`yaml:"-"\`
	Type                string           \`yaml:"type"\`
	Title               string           \`yaml:"title"\`
	HideHeader          bool             \`yaml:"hide-header"\`
	CustomCacheDuration durationField    \`yaml:"cache"\`
	templateBuffer      bytes.Buffer     \`yaml:"-"\`
}

type clockWidget struct {
	widgetBase \`yaml:",inline"\`
	HourFormat string          \`yaml:"hour-format"\`
	Timezones  []clockTimezone \`yaml:"timezones"\`
}

type clockTimezone struct {
	Timezone string \`yaml:"timezone"\`
	Label    string \`yaml:"label"\`
}

type marketsWidget struct {
	widgetBase \`yaml:",inline"\`
	Symbols    []string          \`yaml:"symbols"\`
	Headers    map[string]string \`yaml:"headers"\`
	Body       any               \`yaml:"body"\`
	Ratio      float64           \`yaml:"ratio"\`
}

type groupWidget struct {
	widgetBase \`yaml:",inline"\`
	Widgets    widgets \`yaml:"widgets"\`
}
`;

const build = () => buildCatalog([SOURCE], '/tmp/glance', 'abc1234');

describe('parseTypeSwitch', () => {
  it('reads every case in the dispatch switch', () => {
    expect(parseTypeSwitch(SOURCE).map((c) => c.type)).toEqual(['clock', 'markets', 'group']);
  });

  it('treats extra labels on one case as aliases, not separate widgets', () => {
    const markets = parseTypeSwitch(SOURCE).find((c) => c.type === 'markets')!;
    expect(markets.aliases).toEqual(['stocks']);
    expect(markets.struct).toBe('marketsWidget');
  });

  it('returns nothing when the switch is absent', () => {
    expect(parseTypeSwitch('package glance\n')).toEqual([]);
  });
});

describe('keysOf', () => {
  const structs = parseStructs(SOURCE);

  it('pulls the embedded widgetBase keys in through yaml:",inline"', () => {
    const keys = keysOf('clockWidget', structs).map((k) => k.key);
    expect(keys).toContain('title');
    expect(keys).toContain('hide-header');
    expect(keys).toContain('cache');
  });

  it('skips fields marked yaml:"-"', () => {
    const keys = keysOf('clockWidget', structs).map((k) => k.key);
    expect(keys).not.toContain('ID');
    expect(keys).not.toContain('templateBuffer');
  });

  it('recurses into the row shape of an object list', () => {
    const timezones = keysOf('clockWidget', structs).find((k) => k.key === 'timezones')!;
    expect(timezones.kind).toBe('objectList');
    expect(timezones.fields?.map((f) => f.key)).toEqual(['timezone', 'label']);
  });

  it('returns nothing for a struct it cannot find', () => {
    expect(keysOf('noSuchWidget', structs)).toEqual([]);
  });
});

describe('kindOf', () => {
  const structs = parseStructs(SOURCE);

  it.each([
    ['string', 'string'],
    ['bool', 'boolean'],
    ['int', 'number'],
    ['float64', 'number'],
    ['[]string', 'stringList'],
    ['map[string]string', 'keyValue'],
    ['[]clockTimezone', 'objectList'],
    ['durationField', 'string'],
    ['any', 'raw'],
    ['widgets', 'raw'],
  ])('maps %s to %s', (goType, expected) => {
    expect(kindOf(goType, structs)).toBe(expected);
  });
});

describe('buildCatalog', () => {
  it('sorts widgets and stamps the source', () => {
    const catalog = build();
    expect(catalog.widgets.map((w) => w.type)).toEqual(['clock', 'group', 'markets']);
    expect(catalog.source).toEqual({ path: '/tmp/glance', commit: 'abc1234' });
  });

  it('marks a widget holding a widget list as a container', () => {
    const catalog = build();
    expect(catalog.widgets.find((w) => w.type === 'group')!.container).toBe(true);
    expect(catalog.widgets.find((w) => w.type === 'clock')!.container).toBe(false);
  });

  it('drops `type` and `widgets`, which the editor models structurally', () => {
    const group = build().widgets.find((w) => w.type === 'group')!;
    expect(group.keys.map((k) => k.key)).not.toContain('type');
    expect(group.keys.map((k) => k.key)).not.toContain('widgets');
  });

  it('refuses a directory that is not a Glance checkout', () => {
    expect(() => buildCatalog(['package main\n'], '/tmp/x', null)).toThrow(/newWidget switch/);
  });
});
