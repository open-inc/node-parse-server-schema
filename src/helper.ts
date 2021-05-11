import nodeFetch, { Response } from "node-fetch";

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

export async function fetch({
  url,
  ...otpions
}: {
  url: string;
  [x: string]: any;
}) {
  return await nodeFetch(url, otpions).then(parseRequest);
}

async function parseRequest(res: Response) {
  if (res.status < 400) {
    return res.json();
  } else {
    throw new Error(
      `Bad status code '${res.status}': ${JSON.stringify(await res.json())}`
    );
  }
}
