import AdmZip from "adm-zip";
import { createXXHash64 } from "hash-wasm";
import { createWriteStream, existsSync, readFileSync, writeFileSync } from "fs";
import { deleteFile } from "./files.js";
import { join } from "path";
import { modDatabase } from "./databases.js";
import { getConfig, loadFile, getChecksum } from "./utils.js";

export const searchForMapIcons = async () => {
  const iconsList: string[] = [];
  const alreadyProcessFiles = loadFile<string[]>(join(getConfig().RichPresenceDirectory, "processed.json"), []);
  for (const mod of modDatabase.list()) {
    for (const file of mod.files) {
      const checksum = getChecksum(join(getConfig().ModDirectory, file + ".zip"));
      if (checksum && alreadyProcessFiles.includes(checksum)) continue;
      try {
        const zipFile = new AdmZip(join(getConfig().ModDirectory, file + ".zip"));
        if (!mod.nsfw) {
          const fileList = zipFile
            .getEntries()
            .map((e) => e.entryName)
            .filter((e) => e.startsWith("Graphics/Atlases/Gui/"));
          const richPresenceIcons = fileList.filter(
            (e) =>
              (e.startsWith("Graphics/Atlases/Gui/areas/") ||
                fileList.includes(e.substring(0, e.length - 4) + "_back.png")) &&
              e.endsWith(".png") &&
              !e.endsWith("_back.png") &&
              !e.endsWith("hover.png"),
          );
          const icons = await copyRichPressenceIcons(richPresenceIcons, zipFile);
          iconsList.push(...icons);
          alreadyProcessFiles.push(checksum!);
        }
      } catch (error) {
        console.error(`${getConfig().ModDirectory}/${file}.zip is empty or is not on disk (dropping it)`);
        const knownFile: { [id: number]: string } = {};
        knownFile[file] = mod.id;
        deleteFile(file, knownFile, true);
      }
    }
  }

  writeFileSync(join(getConfig().RichPresenceDirectory, "list.json"), JSON.stringify(iconsList));
  writeFileSync(join(getConfig().RichPresenceDirectory, "processed.json"), JSON.stringify(alreadyProcessFiles));
  modDatabase.save();
};

export const copyRichPressenceIcons = async (richPresenceIcons: string[], zipFile: AdmZip) => {
  const icons: string[] = [];
  for (const icon of richPresenceIcons) {
    const entry = zipFile.getEntry(icon);
    if (!entry) continue;
    const data = entry.getData();
    const hasher = await createXXHash64(0);
    hasher.init();

    hasher.update(data);

    const hash = hasher.digest("hex");

    putIcon(data, getConfig().RichPresenceDirectory + "/" + hash + ".png");

    icons.push(hash);
  }
  return icons;
};

const putIcon = (data: Buffer, path: string) => {
  if (existsSync(path)) {
    return;
  }
  const file = createWriteStream(path);
  file.write(data);
};
