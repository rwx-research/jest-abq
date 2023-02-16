/**
 * Copyright (c) ReadWriteExecute, Inc. and its affiliates. All Rights Reserved.
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

describe('looper', () => {
  for (let i = 0; i < 5; i++) {
    it('i == i', () => {
      expect(i).toBe(i);
    });
  }
});
