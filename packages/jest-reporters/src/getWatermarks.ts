/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import istanbulReport = require('istanbul-lib-report');
import type {Config} from '@jest/types';

export default function getWatermarks(
  config: Config.GlobalConfig,
): istanbulReport.Watermarks {
  const defaultWatermarks = istanbulReport.getDefaultWatermarks();

  const {coverageThreshold} = config;

  if (!coverageThreshold || !coverageThreshold.global) {
    return defaultWatermarks;
  }

  const keys: Array<keyof Config.CoverageThresholdValue> = [
    'branches',
    'functions',
    'lines',
    'statements',
  ];
  return keys.reduce((watermarks, key) => {
    const value = coverageThreshold.global[key];
    if (value !== undefined) {
      watermarks[key][1] = value;
    }

    return watermarks;
  }, defaultWatermarks);
}
