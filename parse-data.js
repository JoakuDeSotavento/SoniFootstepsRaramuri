import fs from 'node:fs';
import path from 'node:path';

const filename = path.join('projects', 'default', 'logs', '20260409-111948-0003_biquad_filter_up.js.txt');
const string = fs.readFileSync(filename).toString();
const data = string
  .split('\n')
  .map(line => line.trim())
  .filter(line => line !== '')
  .map(line => JSON.parse(line));

console.log(data);
