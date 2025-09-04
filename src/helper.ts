import { deepStrictEqual } from "assert";

export function equals(x: any, y: any) {
  try {
    deepStrictEqual(x, y);
    return true;
  } catch (e) {
    return false;
  }
}

export function copy(x: any) {
  return JSON.parse(JSON.stringify(x));
}

export function deepClone(obj: any, seen = new WeakMap()) {
  // Handle primitives and null
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Handle circular references
  if (seen.has(obj)) {
    return seen.get(obj);
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  // Handle Arrays
  if (Array.isArray(obj)) {
    const arrCopy: any[] = [];
    seen.set(obj, arrCopy);
    obj.forEach((item, index) => {
      arrCopy[index] = deepClone(item, seen);
    });
    return arrCopy;
  }

  // Handle RegExp
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags);
  }

  // Handle Objects
  const objCopy: { [key: string]: any } = {};
  seen.set(obj, objCopy);

  Object.keys(obj).forEach((key) => {
    objCopy[key] = deepClone(obj[key], seen);
  });

  return objCopy;
}

export async function fetchHandler<T>({
  url,
  options,
}: {
  url: string;
  options?: RequestInit;
}): Promise<T> {
  const opts = options !== undefined ? options : {};
  return await fetch(url, opts).then(parseRequest);
}

async function parseRequest(res: any) {
  if (res.status < 400) {
    return res.json();
  } else {
    throw new Error(
      `Bad status code '${res.status}': ${JSON.stringify(await res.json())}`
    );
  }
}
