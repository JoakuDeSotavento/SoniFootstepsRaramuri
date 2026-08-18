import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadSoundbank(audioBufferLoader, soundbank) {
  const layersPathname = path.join(__dirname, 'soundbanks', soundbank, 'layers');
  const layersList = fs.readdirSync(layersPathname, { recursive: true })
    .filter(item => !(/(^|\/)\.[^\/\.]/g).test(item))
    .map(item => path.join(layersPathname, item))
    .filter(item => fs.statSync(item).isFile());

  const layers = await audioBufferLoader.load(layersList);

  const shortsPathname = path.join(__dirname, 'soundbanks', soundbank, 'shorts');
  const shortsList = fs.readdirSync(shortsPathname, { recursive: true })
    .filter(item => !(/(^|\/)\.[^\/\.]/g).test(item))
    .map(item => path.join(shortsPathname, item))
    .filter(item => fs.statSync(item).isFile());

  const shorts = await audioBufferLoader.load(shortsList);

  return { layers, shorts };
}