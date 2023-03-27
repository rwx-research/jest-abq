/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

function* generatorMethod() {
  yield 42;
}

async function* asyncGeneratorMethod() {
  yield 42;
}

module.exports.generatorMethod = generatorMethod;
module.exports.asyncGeneratorMethod = asyncGeneratorMethod;
