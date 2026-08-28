import { existsSync, createWriteStream, unlinkSync, renameSync, writeFileSync } from "node:fs";
import { ProviderFile, ProviderMod, ProviderScreenshot } from "./types";
import { getChecksum, getConfig, loadFile, sleep } from "./utils.js";
import sharp from "sharp";
import { headers } from "./index.js";
import { join } from "node:path";
import { deletedModDatabase, fullyDeletedModDatabase, modDatabase } from "./databases.js";

const checkArchives = (modId: string, fileId: number, checksum: string, newPath: string) => {
  const path = join(getConfig().ModsArchiveDirectory, modId + "_" + fileId + ".zip");
  if (existsSync(path) && getChecksum(path) === checksum) {
    renameSync(path, newPath);
    const mod = fullyDeletedModDatabase.getEntry(modId);
    if (mod) {
      if (mod.files.length <= 1 && mod.files.includes(fileId)) {
        fullyDeletedModDatabase.removeEntry(modId);
      } else {
        fullyDeletedModDatabase.setProperty(
          modId,
          "files",
          mod.files.filter((f) => f !== fileId),
        );
      }
    }
    return true;
  }
  return false;
};

const checkDeletedDatabase = (fileId: number) => {
  const mod = deletedModDatabase.list().find((mod) => mod.files.includes(fileId));
  if (mod) {
    if (mod.files.length <= 1 && mod.files.includes(fileId)) {
      deletedModDatabase.removeEntry(mod.id);
    } else {
      deletedModDatabase.setProperty(
        mod.id,
        "files",
        mod.files.filter((f) => f !== fileId),
      );
    }
  }
};

const downloadFile = async (url: string, fileId: number, checksum: string) => {
  const config = getConfig();
  const doNotDownloadList = loadFile<string[]>(join(config.ModDirectory, "dndl.json"), []);
  if (doNotDownloadList.includes(url)) return false;
  const path = join(config.ModDirectory, fileId + ".zip");
  if (existsSync(path)) {
    const checksum2 = getChecksum(path);
    if (checksum2 === checksum) {
      checkDeletedDatabase(fileId);
      return false;
    }
    console.error(
      `File at ${url} is a duplicate from an already existing ${fileId}.zip but does not have the same content! (checksum diff)`,
    );
    console.error(`${checksum2} (computed)`);
    console.error(`${checksum} (GB API)`);
    return false;
  }

  const req = await fetch(url, { headers });

  if (req.status !== 200) {
    console.error(`Got a ${req.status} for ${url}`);
    if (req.status === 404) {
      console.error(`${url} was put in the Do Not Download list`);
      doNotDownloadList.push(url);
      writeFileSync(join(config.ModDirectory, "dndl.json"), JSON.stringify(doNotDownloadList));
    }
    return false;
  }
  const blob = await req.blob();
  const bytes = await blob.bytes();
  if (bytes.length == 0) {
    console.error(`File at ${url} is empty, @fantomitechno please debug fucking dumbass`);
    return true;
  }
  const file = createWriteStream(path);
  file.write(await blob.bytes());
  file.close();
  return true;
};

const downloadImage = async (url: string, path: string) => {
  const config = getConfig();
  const doNotDownloadList = loadFile<string[]>(join(config.ModDirectory, "dndl.json"), []);
  if (doNotDownloadList.includes(url)) return false;
  if (existsSync(path)) {
    return false;
  }
  const req = await fetch(url, { headers });
  if (req.status !== 200) {
    console.error(`Got a ${req.status} for ${url}`);
    if (req.status === 404) {
      console.error(`${url} was put in the Do Not Download list`);
      doNotDownloadList.push(url);
      writeFileSync(join(config.ModDirectory, "dndl.json"), JSON.stringify(doNotDownloadList));
    }
    return false;
  }
  const blob = await req.blob();

  try {
    let image = sharp(await blob.bytes());
    if (!path.includes("/220-90_")) {
      image = image.resize({ width: 220, height: 220, fit: "inside" });
    }
    const file = createWriteStream(path);
    file.write(await image.png().toBuffer());
    file.close();
  } catch (error) {
    console.error(`Screenshot at ${url} got an issue, @fantomitechno please debug fucking dumbass`);
    console.error(error);
  }
  return true;
};

export const createMod = async (mod: ProviderMod) => {
  const config = getConfig();
  for (const file of mod.files) {
    if (!checkArchives(mod.id, file.id, file.checksum, join(config.ModDirectory, file.id + ".zip"))) {
      const downloaded = await downloadFile(file.url, file.id, file.checksum);
      if (downloaded) await sleep(500); // if file already exist on disk (???) to not wait as we did not download it
    }
  }

  for (const scs of mod.screenshots) {
    const downloaded = await downloadImage(scs.url, join(config.ImagesDirectory, scs.id + ".png"));
    if (downloaded) await sleep(500); // if file already exist on disk (???) to not wait as we did not download it
  }

  modDatabase.pushEntry({
    id: mod.id,
    name: mod.name,
    lastModification: mod.lastModification,
    nsfw: mod.nsfw,
    files: mod.files.map((f) => f.id).filter((f) => existsSync(join(config.ModDirectory, f + ".zip"))),
    screenshots: mod.screenshots.map((f) => f.id).filter((f) => existsSync(join(config.ImagesDirectory, f + ".png"))),
  });
};

export const deleteMod = (modId: string) => {
  const mod = modDatabase.getEntry(modId);
  modDatabase.removeEntry(modId);

  const deletedMod = deletedModDatabase.getEntry(modId);

  if (!deletedMod && mod.files.length) {
    deletedModDatabase.pushEntry({
      id: modId,
      name: mod.name,
      files: mod.files,
      date: Date.now(),
    });
  } else {
    deletedModDatabase.setProperty(modId, "date", Date.now());
    deletedModDatabase.pushListProperty(modId, "files", ...mod.files);
  }
};

export const deleteFile = (file: number, knownFiles: { [id: number]: string }, force: boolean = false) => {
  if (existsSync(join(getConfig().ModDirectory, file + ".zip")) && force) {
    unlinkSync(join(getConfig().ModDirectory, file + ".zip"));
  }

  const modId = knownFiles[file];
  const mod = modDatabase.getEntry(modId);
  modDatabase.setProperty(
    modId,
    "files",
    mod.files.filter((f) => f !== file),
  );
  if (!force) {
    const deletedMod = deletedModDatabase.getEntry(modId);

    if (!deletedMod) {
      deletedModDatabase.pushEntry({
        id: modId,
        name: mod.name,
        files: [file],
        date: Date.now(),
      });
    } else {
      deletedModDatabase.setProperty(modId, "date", Date.now());
      deletedModDatabase.pushListProperty(modId, "files", file);
    }
  }
};

export const createFile = async (fileId: number, discoveredFiles: { [id: number]: ProviderFile & { modId: string } }) => {
  const file = discoveredFiles[fileId];

  if (!checkArchives(file.modId, file.id, file.checksum, join(getConfig().ModDirectory, fileId + ".zip"))) {
    const downloaded = await downloadFile(file.url, fileId, file.checksum);
    if (downloaded) await sleep(500); // if file already exist on disk (???) to not wait as we did not download it
  }

  if (existsSync(join(getConfig().ModDirectory, fileId + ".zip"))) {
    const computedChecksum = getChecksum(join(getConfig().ModDirectory, fileId + ".zip"));
    if (computedChecksum !== file.checksum && file.checksum !== "") {
      console.error(`${file.url} did not provide the correct file (checksum diff)`);
      console.error(`${computedChecksum} (computed)`);
      console.error(`${file.checksum} (GB API)`);
    } else {
      modDatabase.pushListProperty(file.modId, "files", fileId);
    }
  }
};

export const deleteScs = (screenshot: string, knownScreenshots: { [id: string]: string }) => {
  const modId = knownScreenshots[screenshot];
  const mod = modDatabase.getEntry(modId);
  modDatabase.setProperty(
    modId,
    "screenshots",
    mod.screenshots.filter((f) => f !== screenshot),
  );
};

export const createScs = async (
  screenshot: string,
  discoveredScreenshots: {
    [id: string]: ProviderScreenshot & { modId: string };
  },
) => {
  const file = discoveredScreenshots[screenshot];

  const downloaded = await downloadImage(file.url, join(getConfig().ImagesDirectory, screenshot + ".png"));
  if (downloaded) await sleep(500); // if file already exist on disk (???) to not wait as we did not download it

  if (existsSync(join(getConfig().ImagesDirectory, screenshot + ".png"))) {
    modDatabase.pushListProperty(file.modId, "screenshots", screenshot);
  }
};
