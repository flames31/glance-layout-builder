/** Writes one config per theme preset, for checking against the real parser. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { THEME_PRESETS } from '../model/theme';
import { initialState, newWidget } from '../model/reducer';
import { toYaml } from '../export/toYaml';

const outDir = process.argv[2]!;
mkdirSync(outDir, { recursive: true });

for (const preset of THEME_PRESETS) {
  const config = initialState().config;
  config.pages[0]!.columns[1]!.widgets.push(newWidget('calendar'));
  writeFileSync(`${outDir}/${preset.key}.yml`, toYaml({ ...config, theme: preset.theme }));
}
console.log(`${THEME_PRESETS.length} preset configs written`);
