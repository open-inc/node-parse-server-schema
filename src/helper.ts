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

export const LOG_PREFIX = "[@openinc/parse-server-schema]";

/**
 * Runs a single step and rethrows a failure with a description of that step.
 * A bare "Bad status code '400'" does not say which class broke the run.
 */
export async function step<T>(description: string, run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(`${LOG_PREFIX} Failed to ${description}: ${reason}`, {
      cause: error,
    });
  }
}

export async function fetchHandler<T>({
  url,
  options,
}: {
  url: string;
  options?: RequestInit;
}): Promise<T> {
  const opts = options !== undefined ? options : {};
  const request = `${opts.method ?? "GET"} ${url}`;

  let res: Response;

  try {
    res = await fetch(url, opts);
  } catch (error) {
    // Node's fetch only says "fetch failed"; the reason (ECONNREFUSED, ENOTFOUND, …) is in `cause`.
    const message = error instanceof Error ? error.message : String(error);
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? ` (${error.cause.message})`
        : "";

    throw new Error(`Request failed: ${request}: ${message}${cause}`, {
      cause: error,
    });
  }

  return parseRequest<T>(res, request);
}

async function parseRequest<T>(res: Response, request: string): Promise<T> {
  if (res.status < 400) {
    return res.json() as Promise<T>;
  }

  // Read as text: a proxy in front of Parse Server may answer with HTML, and
  // res.json() would then throw a SyntaxError that hides the status code.
  const body = await res.text().catch(() => "");

  throw new Error(`Bad status code '${res.status}' for ${request}: ${body}`);
}
