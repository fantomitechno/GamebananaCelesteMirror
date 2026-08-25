import { crawlModsCategory, crawlModsCategoryFull } from "./crawlGB.js";
import { mkdirSync, existsSync } from "node:fs";
import type { Config, ProviderFile, ProviderMod, ProviderScreenshot } from "./types.js";
import { createFile, createMod, createScs, deleteFile, deleteMod, deleteScs } from "./files.js";
import { searchForMapIcons } from "./icons.js";
import { getConfig } from "./utils.js";
import { deletedModDatabase, modDatabase } from "./databases.js";
import { parseDeleteForArchiving } from "./delete.js";

const args = process.argv;
let timeout = 30;
let repeat = true;
let runNumber = 0;
let isFullRun = () => runNumber == 0;

let bumpRunNumber = () => {
  runNumber++;
  if (runNumber >= 8) {
    runNumber == 0;
  }
};

export const headers = {
  "User-Agent": "Celeste Gamebanana Mirror/0.2 (+https://github.com/fantomitechno/GamebananaCelesteMirror)",
};

if (args.length > 2) {
  const newTimeout = Number(args[2]);
  if (isNaN(newTimeout)) {
    repeat = false;
    console.error(`Could not parse arg "${args[2]}", blocking repetition`);
  } else {
    timeout = newTimeout;
  }
} else if (process.env.TIMEOUT) {
  const newTimeout = Number(process.env.TIMEOUT);
  if (isNaN(newTimeout)) {
    repeat = false;
    console.error(`Could not parse arg "${process.env.TIMEOUT}", blocking repetition`);
  } else {
    timeout = newTimeout;
  }
}

const ensureFolderExist = (config: Config) => {
  if (!existsSync(config.ImagesDirectory)) mkdirSync(config.ImagesDirectory);
  if (!existsSync(config.ModDirectory)) mkdirSync(config.ModDirectory);
  if (!existsSync(config.RichPresenceDirectory)) mkdirSync(config.RichPresenceDirectory);
  if (!existsSync(config.ModsArchiveDirectory)) mkdirSync(config.ModsArchiveDirectory);
};

const validCategories = ["Mod", "Tool", "Wip"];
// const validCategories = ["Tool"];

ensureFolderExist(getConfig());

const main = async () => {
  console.log("Starting update");

  const mods: ProviderMod[] = [];
  if (isFullRun()) {
    for (const category of validCategories) {
      mods.push(...(await crawlModsCategoryFull(category)));
    }
  } else {
    for (const category of validCategories) {
      mods.push(...(await crawlModsCategory(category)));
    }
  }

  console.log(`Discovered ${mods.length} mods on Gamebanana`);

  modDatabase.load();
  console.log(`${modDatabase.lenght()} mods are in the system`);
  deletedModDatabase.load();

  const discoveredFiles: { [id: number]: ProviderFile & { modId: string } } = {};
  mods.map((m) => {
    m.files.forEach((f) => {
      discoveredFiles[f.id] = {
        ...f,
        modId: m.id,
      };
    });
  });

  const discoveredScreenshots: {
    [id: string]: ProviderScreenshot & { modId: string };
  } = {};
  mods.map((m) => {
    m.screenshots.forEach((f) => {
      discoveredScreenshots[f.id] = {
        ...f,
        modId: m.id,
      };
    });
  });

  const modsToCreate: ProviderMod[] = [];
  let modsToCreateFiles = 0;
  let modsToCreateScreenshots = 0;
  const filesToCreate: number[] = [];
  const filesToDelete: number[] = [];
  const screenshotsToCreate: string[] = [];
  const screenshotsToDelete: string[] = [];

  for (const mod of mods) {
    const knownMod = modDatabase.getEntry(mod.id);
    if (!knownMod) {
      modsToCreate.push(mod);
      modsToCreateFiles += mod.files.length;
      modsToCreateScreenshots += mod.screenshots.length;
      continue;
    }

    const files = mod.files.map((f) => f.id);
    const screenshots = mod.screenshots.map((f) => f.id);

    const extraFiles = files.filter((f) => !knownMod.files.includes(f));
    filesToCreate.push(...extraFiles);
    const extraScreenshots = screenshots.filter((f) => !knownMod.screenshots.includes(f));
    screenshotsToCreate.push(...extraScreenshots);

    const missingFiles = knownMod.files.filter((f) => !files.includes(f));
    filesToDelete.push(...missingFiles);
    const missingScreenshots = knownMod.screenshots.filter((f) => !screenshots.includes(f));
    screenshotsToDelete.push(...missingScreenshots);
  }

  if (modsToCreate.length) {
    console.log(
      `${modsToCreate.length} mods will be created (${modsToCreateFiles} files & ${modsToCreateScreenshots} screenshots)`,
    );

    for (const mod of modsToCreate) {
      await createMod(mod);
    }
    modDatabase.save();
  }

  const knownFiles: { [id: number]: string } = {};
  const knownScreenshots: { [id: string]: string } = {};
  modDatabase.list().map((m) => {
    m.files.forEach((f) => {
      knownFiles[f] = m.id;
    });
    m.screenshots.forEach((s) => {
      knownScreenshots[s] = m.id;
    });
  });

  if (filesToDelete.length) {
    console.log(`${filesToDelete.length} files will be deleted`);
    for (const file of filesToDelete) {
      deleteFile(file, knownFiles);
    }
  }

  if (filesToCreate.length) {
    console.log(`${filesToCreate.length} files will be downloaded`);
    for (const file of filesToCreate) {
      await createFile(file, discoveredFiles);
    }
  }

  if (screenshotsToDelete.length) {
    console.log(`${screenshotsToDelete.length} screenshots will be deleted`);
    for (const screenshot of screenshotsToDelete) {
      deleteScs(screenshot, knownScreenshots);
    }
  }

  if (screenshotsToCreate.length) {
    console.log(`${screenshotsToCreate.length} screenshots will be created`);
    for (const screenshot of screenshotsToCreate) {
      await createScs(screenshot, discoveredScreenshots);
    }
  }

  if (isFullRun()) {
    const modsToDelete: string[] = modDatabase
      .list()
      .filter((m) => !mods.map((dm) => dm.id).includes(m.id))
      .map((m) => m.id);
    if (modsToDelete.length) {
      console.log(`${modsToDelete.length} mods will be deleted`);
      for (const mod of modsToDelete) {
        deleteMod(mod);
      }
    }

    parseDeleteForArchiving();
  }
  modDatabase.save();
  deletedModDatabase.save();

  await searchForMapIcons();

  console.log("Finished processing");
  bumpRunNumber();
  if (repeat) setTimeout(main, timeout * 60 * 1000);
};

main();
