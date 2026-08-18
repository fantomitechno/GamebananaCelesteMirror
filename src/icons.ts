import AdmZip from "adm-zip";
import type { Config, KnownMod } from "./types.js";
import { createXXHash64 } from "hash-wasm";
import { createWriteStream, existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";

export const searchIcons = async (config: Config, knownMods: { [id: number]: KnownMod }) => {
  const iconsList: string[] = [];
  for (const mod of Object.values(knownMods)) {
    for (const file of mod.files) {
      const zipFile = new AdmZip(config.ModDirectory + "/" + file + ".zip")
      const fileList = zipFile.getEntries().map(e => e.entryName).filter(e => e.startsWith("Graphics/Atlases/Gui/"));
      const richPresenceIcons = fileList.filter(e => (e.startsWith("Graphics/Atlases/Gui/areas/") || fileList.includes(e.substring(0, e.length - 4) + "_back.png")) && e.endsWith(".png") && !e.endsWith("_back.png") && !e.endsWith("hover.png"))
      const icons = await copyRichPressenceIcons(config, richPresenceIcons, zipFile)
      iconsList.push(...icons)
    }
  }


  let knownIconList: string[] = [];
  if (existsSync(config.RichPresenceDirectory + "/list.json")) {
    const knownFile = readFileSync(config.RichPresenceDirectory + "/list.json")
    knownIconList = JSON.parse(knownFile.toString());
  }

  const filesToDelete = knownIconList.filter(i => !iconsList.includes(i));

  for (const file of filesToDelete) {
    deleteFile(config.RichPresenceDirectory + "/" + file + ".png")
  }
  writeFileSync(config.RichPresenceDirectory + "/list.json", JSON.stringify(iconsList))
}


export const copyRichPressenceIcons = async (config: Config, richPresenceIcons: string[], zipFile: AdmZip) => {
  const icons: string[] = [];
  for (const icon of richPresenceIcons) {
    const entry = zipFile.getEntry(icon);
    if (!entry) continue
    const data = entry.getData();
    const hasher = await createXXHash64(0);
    hasher.init()

    hasher.update(data);

    const hash = hasher.digest('hex')

    putFile(data, config.RichPresenceDirectory + "/" + hash + ".png")

    icons.push(hash)
  }
  return icons
}


const putFile = (data: Buffer, path: string) => {
  if (existsSync(path)) {
    return;
  }
  const file = createWriteStream(path);
  file.write(data)
}

const deleteFile = (path: string) => {
  if (existsSync(path)) {
    unlinkSync(path);
  }
}