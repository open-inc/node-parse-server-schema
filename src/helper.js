const nodeFetch = require("node-fetch");
const fs = require("fs");

const { deepStrictEqual } = require("assert");

module.exports = {
  copy,
  equals,
  fetch,
};

function equals(x, y) {
  try {
    deepStrictEqual(x, y);
    return true;
  } catch (e) {
    return false;
  }
}

function copy(x) {
  return JSON.parse(JSON.stringify(x));
}

async function fetch({ url, ...otpions }) {
  return await nodeFetch(url, otpions).then(parseRequest);
}

async function parseRequest(res) {
  if (res.status < 400) {
    return res.json();
  } else {
    throw new Error(
      `Bad status code '${res.status}': ${JSON.stringify(await res.json())}`
    );
  }
}
