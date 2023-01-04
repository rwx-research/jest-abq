import {loadJson} from 'json.macro';

const abq = <any>loadJson('../../../abq.json');
const lerna = <any>loadJson('../../../lerna.json');

export const abqSpawnedMessage = {
  adapterName: 'jest-abq',
  adapterVersion: abq.version,
  testFramework: 'jest',
  testFrameworkVersion: lerna.version,
};
