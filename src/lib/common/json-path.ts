type JsonContainer = Record<string, unknown> | unknown[];

function parsePath(path: string): Array<string | number> {
  return path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

function ensureContainer(parent: JsonContainer, segment: string | number, next: string | number): JsonContainer {
  const shouldBeArray = typeof next === 'number';

  if (typeof segment === 'number') {
    const arrayParent = parent as unknown[];
    const existing = arrayParent[segment];
    if (Array.isArray(existing) || (existing && typeof existing === 'object')) {
      return existing as JsonContainer;
    }

    const created: JsonContainer = shouldBeArray ? [] : {};
    arrayParent[segment] = created;
    return created;
  }

  const objectParent = parent as Record<string, unknown>;
  const existing = objectParent[segment];
  if (Array.isArray(existing) || (existing && typeof existing === 'object')) {
    return existing as JsonContainer;
  }

  const created: JsonContainer = shouldBeArray ? [] : {};
  objectParent[segment] = created;
  return created;
}

export function setJsonValueByPath(
  input: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const segments = parsePath(path);
  if (!segments.length) {
    return input;
  }

  let current: JsonContainer = input;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLast = index === segments.length - 1;

    if (isLast) {
      if (typeof segment === 'number') {
        (current as unknown[])[segment] = value;
      } else {
        (current as Record<string, unknown>)[segment] = value;
      }
      return input;
    }

    current = ensureContainer(current, segment, segments[index + 1]);
  }

  return input;
}
