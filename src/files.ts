import { existsSync, createWriteStream, unlinkSync } from "node:fs";
import { GBFile, GBMod, GBScreenshot } from "./types"
import { getChecksum, getConfig, sleep } from "./utils.js";
import sharp from "sharp";
import { headers } from "./index.js";
import { join } from "node:path";
import { deletedModDatabase, modDatabase } from "./databases.js";

const downloadFile = async (url: string, path: string, checksum: string) => {
  if (existsSync(path)) {
    const checksum2 = getChecksum(path)
    if (checksum2 === checksum)
      return false;
  }
  const file = createWriteStream(path);
  const req = await fetch(url, { headers });

  if (req.status !== 200) {
    console.error(`Got a ${req.status} for ${url}`);
    return false;
  }
  const blob = await req.blob()
  const bytes = await blob.bytes();
  if (bytes.length == 0) {
    console.error(`File at ${url} is empty, @fantomitechno please debug fucking dumbass`)
    return true;
  }
  file.write(await blob.bytes())
  return true;
}

const downloadImage = async (url: string, path: string) => {
  if (existsSync(path)) {
    return false;
  }
  const req = await fetch(url, { headers });
  if (req.status !== 200) {
    console.error(`Got a ${req.status} for ${url}`);
    return false;
  }
  const blob = await req.blob()

  const file = createWriteStream(path);
  try {
    let image = sharp(await blob.bytes());
    if (path.endsWith("nsfw.jpg")) {
      image = image.resize({ width: 220, height: 220, fit: "inside" });
    }
    file.write(await image.png().toBuffer());
  } catch (error) {
    console.error(`Screenshot at ${url} got an issue, @fantomitechno please debug fucking dumbass`)
    console.error(error)
  }
  return true;
}

export const createMod = async (mod: GBMod) => {
  for (const file of mod.files) {
    const downloaded = await downloadFile(file.url, join(getConfig().ModDirectory, file.id + ".zip"), file.checksum)
    if (downloaded) await sleep(500); // if file already exist on disk (???) to not wait as we did not download it
  }


  for (const scs of mod.screenshots) {
    const downloaded = await downloadImage(scs.url, join(getConfig().ImagesDirectory, scs.id + ".png"))
    if (downloaded) await sleep(500); // if file already exist on disk (???) to not wait as we did not download it
  }

  modDatabase.pushEntry({
    id: mod.id,
    name: mod.name,
    lastModification: mod.lastModification,
    nsfw: mod.nsfw,
    files: mod.files.map(f => f.id).filter(f => existsSync(join(getConfig().ModDirectory, f + ".zip"))),
    screenshots: mod.screenshots.map(f => f.id).filter(f => existsSync(join(getConfig().ImagesDirectory, f + ".png")))
  })
}

export const deleteMod = (modId: string) => {
  const mod = modDatabase.getEntry(modId);
  modDatabase.removeEntry(modId)

  const deletedMod = deletedModDatabase.getEntry(modId);

  if (!deletedMod) {
    deletedModDatabase.pushEntry({
      id: modId,
      name: mod.name,
      files: mod.files,
      date: Date.now()
    });
  } else {
    deletedModDatabase.setProperty(modId, "date", Date.now())
    deletedModDatabase.pushListProperty(modId, "files", ...mod.files);
  }
}

export const deleteFile = (file: number, knownFiles: { [id: number]: string }, force: boolean = false) => {
  if (existsSync(join(getConfig().ModDirectory, file + ".zip")) && force) {
    unlinkSync(join(getConfig().ModDirectory, file + ".zip"))
  }

  const modId = knownFiles[file];
  const mod = modDatabase.getEntry(modId);
  modDatabase.setProperty(modId, "files", mod.files.filter(f => f !== file));
  if (!force) {
    const deletedMod = deletedModDatabase.getEntry(modId);

    if (!deletedMod) {
      deletedModDatabase.pushEntry({
        id: modId,
        name: mod.name,
        files: [file],
        date: Date.now()
      });
    } else {
      deletedModDatabase.setProperty(modId, "date", Date.now())
      deletedModDatabase.pushListProperty(modId, "files", file);
    }
  }
}

export const createFile = async (fileId: number, discoveredFiles: { [id: number]: GBFile & { modId: string } }) => {
  const file = discoveredFiles[fileId];

  const downloaded = await downloadFile(file.url, join(getConfig().ModDirectory, fileId + ".zip"), file.checksum)
  if (downloaded) await sleep(500); // if file already exist on disk (???) to not wait as we did not download it

  if (existsSync(join(getConfig().ModDirectory, file + ".zip"))) {
    modDatabase.pushListProperty(file.modId, "files", fileId);
  }
}

export const deleteScs = (screenshot: string, knownScreenshots: { [id: string]: string }) => {
  const modId = knownScreenshots[screenshot];
  const mod = modDatabase.getEntry(modId);
  modDatabase.setProperty(modId, "screenshots", mod.screenshots.filter(f => f !== screenshot));
}

export const createScs = async (screenshot: string, discoveredScreenshots: { [id: string]: GBScreenshot & { modId: string } }) => {
  const file = discoveredScreenshots[screenshot];

  const downloaded = await downloadImage(file.url, join(getConfig().ModDirectory, screenshot + ".png"))
  if (downloaded) await sleep(500); // if file already exist on disk (???) to not wait as we did not download it

  if (existsSync(join(getConfig().ModDirectory, screenshot + ".png"))) {
    modDatabase.pushListProperty(file.modId, "screenshots", screenshot);
  }
}