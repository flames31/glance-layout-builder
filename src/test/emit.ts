import { writeFileSync } from 'node:fs';
import { toYaml } from '../export/toYaml';
import { docsFixture } from './fixture';
writeFileSync(process.argv[2]!, toYaml(docsFixture));
