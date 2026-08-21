import { existsSync, readFileSync } from "node:fs";

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