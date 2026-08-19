import { parse } from "smol-toml";
import { mkdirSync, readFileSync, existsSync, unlinkSync, readdirSync } from "node:fs";
import type { Config, KnownMod } from "./types.js";

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


  let knownMods: KnownMod[] = [];
  if (existsSync(config.ModDirectory + "/mods.json")) {
    const knownFile = readFileSync(config.ModDirectory + "/mods.json");
    knownMods = Object.values(JSON.parse(knownFile.toString()));
  }


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


  let knownIcons: string[] = [];
  if (existsSync(config.RichPresenceDirectory + "/list.json")) {
    const knownFile = readFileSync(config.RichPresenceDirectory + "/list.json");
    knownIcons = JSON.parse(knownFile.toString()).map((i: string) => i + ".png");
  }

  const toDeleteScreenshots = readdirSync(config.ImagesDirectory).filter(s => !knownScreenshots.includes(s) && s.endsWith(".png")).map(f => config.ImagesDirectory + "/" + f);
  const toDeleteFiles = readdirSync(config.ModDirectory).filter(s => !knownFiles.includes(s) && s.endsWith(".zip")).map(f => config.ModDirectory + "/" + f);
  const toDeleteIcons = readdirSync(config.RichPresenceDirectory).filter(s => !knownIcons.includes(s) && s.endsWith(".png")).map(f => config.RichPresenceDirectory + "/" + f);

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