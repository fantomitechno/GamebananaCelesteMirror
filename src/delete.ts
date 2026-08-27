import { existsSync, renameSync } from "node:fs";
import { getConfig } from "./utils.js";
import { join } from "node:path";
import { deletedModDatabase, fullyDeletedModDatabase } from "./databases.js";

export const parseDeleteForArchiving = () => {
  fullyDeletedModDatabase.load();
  for (const mod of deletedModDatabase.list()) {
    const passedDays = (Date.now() - mod.date) / (24 * 60 * 60 * 1000);
    // console.log(passedDays)
    if (passedDays > 7) {
      deletedModDatabase.removeEntry(mod.id);
      fullyDeletedModDatabase.pushEntry(mod); // REWRITE

      for (const file of mod.files) {
        if (existsSync(join(getConfig().ModDirectory, file + ".zip"))) {
          renameSync(
            join(getConfig().ModDirectory, file + ".zip"),
            join(getConfig().ModsArchiveDirectory, mod.id + "_" + file + ".zip"),
          );
        }
      }
    }
  }
  fullyDeletedModDatabase.save();
};
