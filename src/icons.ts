import AdmZip from "adm-zip";
import type { Config, KnownMod } from "./types.js";
import { createXXHash64 } from "hash-wasm";
import { createWriteStream, existsSync, writeFileSync } from "fs";
import { deleteFile } from "./files.js";
import { join } from "path";

export const searchIcons = async (config: Config, knownMods: { [id: number]: KnownMod }) => {
  const iconsList: string[] = [];
  for (const mod of Object.values(knownMods)) {
    for (const file of mod.files) {
      try {
        const zipFile = new AdmZip(join(config.ModDirectory, file + ".zip"))
        if (!mod.nsfw) {
          const fileList = zipFile.getEntries().map(e => e.entryName).filter(e => e.startsWith("Graphics/Atlases/Gui/"));
          const richPresenceIcons = fileList.filter(e => (e.startsWith("Graphics/Atlases/Gui/areas/") || fileList.includes(e.substring(0, e.length - 4) + "_back.png")) && e.endsWith(".png") && !e.endsWith("_back.png") && !e.endsWith("hover.png"))
          const icons = await copyRichPressenceIcons(config, richPresenceIcons, zipFile)
          iconsList.push(...icons)
        }
      } catch (error) {
        console.error(`${config.ModDirectory}/${file}.zip is empty or inexistant`)
        const knownFile: { [id: number]: string } = {}
        knownFile[file] = mod.id
        deleteFile(config, file, knownMods, knownFile, true)
      }
    }
  }

  writeFileSync(join(config.RichPresenceDirectory, "/list.json"), JSON.stringify(iconsList))
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

    putIcon(data, config.RichPresenceDirectory + "/" + hash + ".png")

    icons.push(hash)
  }
  return icons
}


const putIcon = (data: Buffer, path: string) => {
  if (existsSync(path)) {
    return;
  }
  const file = createWriteStream(path);
  file.write(data)
}
