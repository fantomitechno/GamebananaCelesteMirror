import { closeSync, existsSync, openSync, readFileSync, readSync } from "node:fs";
import { parse } from "smol-toml";
import { Config } from "./types";
import { createHash } from "node:crypto";

export const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function loadFile<T extends any>(path: string, default_: any = {}) {
  let knownMods: T = default_;
  if (existsSync(path)) {
    const knownFile = readFileSync(path)
    knownMods = JSON.parse(knownFile.toString());
  }

  return knownMods
}

const BUFFER_SIZE = 8192

export const getChecksum = (path: string): string | null => {
  if (!existsSync(path)) return null;

  const fd = openSync(path, 'r')
  const hash = createHash('md5')
  const buffer = Buffer.alloc(BUFFER_SIZE)

  try {
    let bytesRead

    do {
      bytesRead = readSync(fd, buffer, 0, BUFFER_SIZE, null)
      hash.update(buffer.subarray(0, bytesRead))
    } while (bytesRead === BUFFER_SIZE)
  } finally {
    closeSync(fd)
  }

  return hash.digest('hex')
}

const configFile = readFileSync("./config.toml");
let CONFIG: Config;

export const getConfig = () => {
  if (!CONFIG) {
    CONFIG = (parse(configFile.toString()) as object as Config)
  }
  return CONFIG
}
