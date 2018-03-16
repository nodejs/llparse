export { Identifier, IUniqueName } from './identifier';

export function toCacheKey(value: number | boolean): string {
  if (typeof value === 'number') {
    if (value < 0) {
      return 'm' + (-value);
    } else {
      return value.toString();
    }
  } else if (typeof value === 'boolean') {
    if (value === true) {
      return 'true';
    } else {
      return 'false';
    }
  } else {
    throw new Error(`Unsupported value: "${value}"`);
  }
}
