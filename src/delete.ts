import { parse } from "smol-toml";
import { mkdirSync, readFileSync, existsSync, unlinkSync, readdirSync } from "node:fs";
import type { Config, KnownMod } from "./types.js";
import { loadFile } from "./utils.js";
import { join } from "node:path";

const ensureFolderExist = (config: Config) => {
  if (!existsSync(config.ImagesDirectory)) mkdirSync(config.ImagesDirectory);
  if (!existsSync(config.ModDirectory)) mkdirSync(config.ModDirectory);
  if (!existsSync(config.RichPresenceDirectory)) mkdirSync(config.RichPresenceDirectory);
}

const main = async () => {
  console.log("Starting deletion");

  const configFile = readFileSync("./config.toml");
  const config = (parse(configFile.toString()) as object as Config);
  ensureFolderExist(config);


  let knownMods: KnownMod[] = Object.values(loadFile(join(config.ModDirectory, "mods.json"), {}));


  const knownFiles: string[] = [];
  const knownScreenshots: string[] = [];
  knownMods.map(m => {
    m.files.forEach(f => {
      knownFiles.push(`${f}.zip`);
    });

    m.screenshots.forEach(s => {
      knownScreenshots.push(`${s}.png`);
    });
  })


  let knownIcons: string[] = loadFile(join(config.RichPresenceDirectory, "list.json"), []);

  const toDeleteScreenshots = readdirSync(config.ImagesDirectory).filter(s => !knownScreenshots.includes(s) && s.endsWith(".png")).map(f => join(config.ImagesDirectory, f));
  const toDeleteFiles = readdirSync(config.ModDirectory).filter(s => !knownFiles.includes(s) && s.endsWith(".zip")).map(f => join(config.ModDirectory, f));
  const toDeleteIcons = readdirSync(config.RichPresenceDirectory).filter(s => !knownIcons.includes(s) && s.endsWith(".png")).map(f => join(config.RichPresenceDirectory, f));

  console.log(`Gotta delete ${toDeleteFiles.length} zip files, ${toDeleteScreenshots.length} screenshots and ${toDeleteIcons.length} icons`);

  if (toDeleteFiles.length > 50 && !process.env.FORCE) {
    console.error("You are going to delete like way too much zip files (50+) please use the FORCE env var if you are sure")
    return
  }

  for (const file of [...toDeleteScreenshots, ...toDeleteFiles, ...toDeleteIcons]) {
    unlinkSync(file)
  }
}

main();