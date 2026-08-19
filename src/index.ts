import { crawlModsCategory } from "./crawlGB.js";
import { parse } from "smol-toml";
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import type { Config, GBFile, GBMod, GBScreenshot, KnownMod } from "./types.js";
import { createFile, createMod, createScs, deleteFile, deleteMod, deleteScs } from "./files.js";
import { searchIcons } from "./icons.js";

const args = process.argv
let timeout = 30;
let repeat = true;

export const headers = { "User-Agent": "Celeste Gamebanana Mirror/0.2 (+https://github.com/fantomitechno/GamebananaCelesteMirror)" };

if (args.length > 2) {
  const newTimeout = Number(args[2]);
  if (isNaN(newTimeout)) {
    repeat = false;
    console.error(`Could not parse arg "${args[2]}", blocking repetition`)
  } else {
    timeout = newTimeout;
  }
} else if (process.env.TIMEOUT) {
  const newTimeout = Number(process.env.TIMEOUT);
  if (isNaN(newTimeout)) {
    repeat = false;
    console.error(`Could not parse arg "${process.env.TIMEOUT}", blocking repetition`)
  } else {
    timeout = newTimeout;
  }
}

const ensureFolderExist = (config: Config) => {
  if (!existsSync(config.ImagesDirectory)) mkdirSync(config.ImagesDirectory);
  if (!existsSync(config.ModDirectory)) mkdirSync(config.ModDirectory);
  if (!existsSync(config.RichPresenceDirectory)) mkdirSync(config.RichPresenceDirectory);
}

const validCategories = ["Mod", "Tool", "Wips"]

const main = async () => {
  console.log("Starting update");

  const configFile = readFileSync("./config.toml");
  const config = (parse(configFile.toString()) as object as Config)
  ensureFolderExist(config);

  const mods: GBMod[] = []
  for (const category of validCategories) {
    mods.push(...await crawlModsCategory(category));
  }

  console.log(`Discovered ${mods.length} mods on Gamebanana`);

  let knownMods: { [id: string]: KnownMod } = {};
  if (existsSync(config.ModDirectory + "/mods.json")) {
    const knownFile = readFileSync(config.ModDirectory + "/mods.json")
    knownMods = JSON.parse(knownFile.toString());
  }
  console.log(`${Object.keys(knownMods).length} mods are in the system`);

  const discoveredFiles: { [id: number]: GBFile & { modId: string } } = {};
  mods.map(m => {
    m.files.forEach(f => {
      discoveredFiles[f.id] = {
        ...f,
        modId: m.id
      }
    })
  })

  const discoveredScreenshots: { [id: string]: GBScreenshot & { modId: string } } = {};
  mods.map(m => {
    m.screenshots.forEach(f => {
      discoveredScreenshots[f.id] = {
        ...f,
        modId: m.id
      }
    })
  })

  const modsToCreate: GBMod[] = [];
  let modsToCreateFiles = 0
  let modsToCreateScreenshots = 0
  const filesToCreate: number[] = [];
  const filesToDelete: number[] = [];
  const screenshotsToCreate: string[] = [];
  const screenshotsToDelete: string[] = [];
  const modsToDelete: string[] = Object.values(knownMods).filter(m => !mods.map(dm => dm.id).includes(m.id)).map(m => m.id);

  for (const mod of mods) {
    const knownMod = knownMods[mod.id]
    if (!knownMods[mod.id]) {
      modsToCreate.push(mod);
      modsToCreateFiles += mod.files.length;
      modsToCreateScreenshots += mod.screenshots.length;
      continue;
    }

    const files = mod.files.map(f => f.id);
    const screenshots = mod.screenshots.map(f => f.id);

    const missingFiles = knownMod.files.filter(f => !files.includes(f));
    const extraFiles = files.filter(f => !knownMod.files.includes(f));

    filesToCreate.push(...extraFiles)
    filesToDelete.push(...missingFiles)

    const missingScreenshots = knownMod.screenshots.filter(f => !screenshots.includes(f));
    const extraScreenshots = screenshots.filter(f => !knownMod.screenshots.includes(f));

    screenshotsToCreate.push(...extraScreenshots)
    screenshotsToDelete.push(...missingScreenshots)
  }

  if (modsToCreate.length) {
    console.log(`${modsToCreate.length} mods will be created (${modsToCreateFiles} files & ${modsToCreateScreenshots} screenshots)`)

    for (const mod of modsToCreate) {
      knownMods = await createMod(config, mod, knownMods);
    }
    writeFileSync(config.ModDirectory + "/mods.json", JSON.stringify(knownMods))
  }

  const knownFiles: { [id: number]: string } = {}
  Object.values(knownMods).map(m => {
    m.files.forEach(f => {
      knownFiles[f] = m.id;
    })
  });

  if (filesToDelete.length) {
    console.log(`${filesToDelete.length} files will be deleted`)
    for (const file of filesToDelete) {
      knownMods = deleteFile(config, file, knownMods, knownFiles);
    }
  }


  if (filesToCreate.length) {
    console.log(`${filesToCreate.length} files will be downloaded`)
    for (const file of filesToCreate) {
      knownMods = await createFile(config, file, knownMods, discoveredFiles);
    }
  }

  if (screenshotsToDelete.length) {
    console.log(`${screenshotsToDelete.length} screenshots will be deleted`)
    for (const screenshot of screenshotsToDelete) {
      knownMods = deleteScs(screenshot, knownMods, knownFiles);
    }
  }

  if (screenshotsToCreate.length) {
    console.log(`${screenshotsToCreate.length} screenshots will be created`)
    for (const screenshot of screenshotsToCreate) {
      knownMods = await createScs(config, screenshot, knownMods, discoveredScreenshots);
    }
  }

  if (modsToDelete.length) {
    console.log(`${modsToDelete.length} mods will be deleted`)
    for (const mod of modsToDelete) {
      knownMods = deleteMod(mod, knownMods);
    }
  }
  writeFileSync(config.ModDirectory + "/mods.json", JSON.stringify(knownMods))

  await searchIcons(config, knownMods);

  console.log("Finished processing")
  if (repeat) setTimeout(main, timeout * 60 * 1000)
}


main()