/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {CompareKeys, Config, Printer, Refs} from './types';

const getKeysOfEnumerableProperties = (
  object: Record<string, unknown>,
  compareKeys: CompareKeys,
) => {
  const rawKeys = Object.keys(object);
  const keys: Array<string | symbol> =
    compareKeys !== null ? rawKeys.sort(compareKeys) : rawKeys;

  if (Object.getOwnPropertySymbols) {
    Object.getOwnPropertySymbols(object).forEach(symbol => {
      if (Object.getOwnPropertyDescriptor(object, symbol)!.enumerable) {
        keys.push(symbol);
      }
    });
  }

  return keys as Array<string>;
};

/**
 * Return entries (for example, of a map)
 * with spacing, indentation, and comma
 * without surrounding punctuation (for example, braces)
 */
export function printIteratorEntries(
  iterator: Iterator<[unknown, unknown]>,
  config: Config,
  indentation: string,
  depth: number,
  refs: Refs,
  printer: Printer,
  // Too bad, so sad that separator for ECMAScript Map has been ' => '
  // What a distracting diff if you change a data structure to/from
  // ECMAScript Object or Immutable.Map/OrderedMap which use the default.
  separator = ': ',
): string {
  let result = '';
  let width = 0;
  let current = iterator.next();

  if (!current.done) {
    result += config.spacingOuter;

    const indentationNext = indentation + config.indent;

    while (!current.done) {
      result += indentationNext;

      if (width++ === config.maxWidth) {
        result += '…';
        break;
      }

      const name = printer(
        current.value[0],
        config,
        indentationNext,
        depth,
        refs,
      );
      const value = printer(
        current.value[1],
        config,
        indentationNext,
        depth,
        refs,
      );

      result += name + separator + value;

      current = iterator.next();

      if (!current.done) {
        result += `,${config.spacingInner}`;
      } else if (!config.min) {
        result += ',';
      }
    }

    result += config.spacingOuter + indentation;
  }

  return result;
}

/**
 * Return values (for example, of a set)
 * with spacing, indentation, and comma
 * without surrounding punctuation (braces or brackets)
 */
export function printIteratorValues(
  iterator: Iterator<unknown>,
  config: Config,
  indentation: string,
  depth: number,
  refs: Refs,
  printer: Printer,
): string {
  let result = '';
  let width = 0;
  let current = iterator.next();

  if (!current.done) {
    result += config.spacingOuter;

    const indentationNext = indentation + config.indent;

    while (!current.done) {
      result += indentationNext;

      if (width++ === config.maxWidth) {
        result += '…';
        break;
      }

      result += printer(current.value, config, indentationNext, depth, refs);

      current = iterator.next();

      if (!current.done) {
        result += `,${config.spacingInner}`;
      } else if (!config.min) {
        result += ',';
      }
    }

    result += config.spacingOuter + indentation;
  }

  return result;
}

/**
 * Return items (for example, of an array)
 * with spacing, indentation, and comma
 * without surrounding punctuation (for example, brackets)
 **/
export function printListItems(
  list: ArrayLike<unknown>,
  config: Config,
  indentation: string,
  depth: number,
  refs: Refs,
  printer: Printer,
): string {
  let result = '';

  if (list.length) {
    result += config.spacingOuter;

    const indentationNext = indentation + config.indent;

    for (let i = 0; i < list.length; i++) {
      result += indentationNext;

      if (i === config.maxWidth) {
        result += '…';
        break;
      }

      if (i in list) {
        result += printer(list[i], config, indentationNext, depth, refs);
      }

      if (i < list.length - 1) {
        result += `,${config.spacingInner}`;
      } else if (!config.min) {
        result += ',';
      }
    }

    result += config.spacingOuter + indentation;
  }

  return result;
}

/**
 * Return properties of an object
 * with spacing, indentation, and comma
 * without surrounding punctuation (for example, braces)
 */
export function printObjectProperties(
  val: Record<string, unknown>,
  config: Config,
  indentation: string,
  depth: number,
  refs: Refs,
  printer: Printer,
): string {
  let result = '';
  const keys = getKeysOfEnumerableProperties(val, config.compareKeys);

  if (keys.length) {
    result += config.spacingOuter;

    const indentationNext = indentation + config.indent;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const name = printer(key, config, indentationNext, depth, refs);
      const value = printer(val[key], config, indentationNext, depth, refs);

      result += `${indentationNext + name}: ${value}`;

      if (i < keys.length - 1) {
        result += `,${config.spacingInner}`;
      } else if (!config.min) {
        result += ',';
      }
    }

    result += config.spacingOuter + indentation;
  }

  return result;
}
