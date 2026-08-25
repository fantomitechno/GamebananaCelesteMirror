import { writeFileSync } from "node:fs";
import type { BaseMod, DeletedMod, KnownMod } from "./types"
import { getConfig, loadFile } from "./utils.js";
import { join } from "node:path";

class Database<T extends (BaseMod)> {
  _database: { [id: string]: T } = {};
  _path: string;
  constructor(file: string) {
    this._path = file;
  }

  pushEntry(entry: T) {
    if (!this._database[entry.id]) {
      this._database[entry.id] = entry;
      return true;
    }
    return false;
  }

  replaceEntry(entry: T) {
    this._database[entry.id] = entry;
  }

  getEntry(id: string) {
    return this._database[id];
  }

  pushListProperty(id: string, property: string, ...value: unknown[]) {
    const entry = this._database[id] as object as { [prop: string]: unknown };
    if (entry) {
      const prop = entry[property]
      if (prop instanceof Array) {
        prop.push(...value)
      }
    }
  }

  setProperty(id: string, property: string, value: unknown) {
    const entry = this._database[id] as object as { [prop: string]: unknown };
    if (entry) {
      entry[property] = value;
    }
  }

  removeEntry(id: string) {
    delete this._database[id];
  }

  save() {
    writeFileSync(this._path, JSON.stringify(this._database))
  }

  load() {
    this._database = loadFile(this._path, {});
  }

  lenght() {
    return Object.keys(this._database).length
  }

  list() {
    return Object.values(this._database)
  }
}

export const modDatabase = new Database<KnownMod>(join(getConfig().ModDirectory, "mods.json"))
export const deletedModDatabase = new Database<DeletedMod>(join(getConfig().ModDirectory, "deleted-mods.json"))
export const fullyDeletedModDatabase = new Database<DeletedMod>(join(getConfig().ModsArchiveDirectory, "mods.json"))