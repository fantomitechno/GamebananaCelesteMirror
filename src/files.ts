import { existsSync, createWriteStream, unlinkSync } from "node:fs";
import { Config, GBFile, GBMod, GBScreenshot, KnownMod } from "./types"
import { sleep } from "./utils.js";
import sharp from "sharp";

const downloadFile = async (url: string, path: string) => {
  if (existsSync(path)) {
    return false;
  }
  console.log("Downloading " + url)
  const file = createWriteStream(path);
  const req = await fetch(url);
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
  const file = createWriteStream(path);
  const req = await fetch(url);
  const blob = await req.blob()

  file.write(await sharp(await blob.bytes()).resize({ width: 220, height: 220, fit: "inside" }).png().toBuffer())
  return true;
}

export const createMod = async (config: Config, mod: GBMod, knownMods: { [id: string]: KnownMod }) => {
  for (const file of mod.files) {
    const downloaded = await downloadFile(file.url, config.ModDirectory + "/" + file.id + ".zip")
    if (downloaded) await sleep(500); // if file already exist on disk (???) to not wait as we did not download it
  }


  for (const scs of mod.screenshots) {
    const downloaded = await downloadImage(scs.url, config.ImagesDirectory + "/" + scs.id + ".png")
    if (downloaded) await sleep(500); // if file already exist on disk (???) to not wait as we did not download it
  }

  knownMods[mod.id] = {
    id: mod.id,
    name: mod.name,
    submitter: mod.submitter,
    lastModification: mod.lastModification,
    files: mod.files.map(f => f.id).filter(f => existsSync(config.ModDirectory + "/" + f + ".zip")),
    screenshots: mod.screenshots.map(f => f.id).filter(f => existsSync(config.ImagesDirectory + "/" + f + ".png"))
  }

  return knownMods;
}

export const deleteMod = (config: Config, modId: string, knownMods: { [id: string]: KnownMod }) => {
  const mod = knownMods[modId];
  const filesDeleteList = [];
  const screenshotsDeleteList = [];

  for (const file of mod.files) {
    if (existsSync(config.ModDirectory + "/" + file + ".zip")) filesDeleteList.push(file + ".zip");
  }

  for (const screenshot of mod.screenshots) {
    if (existsSync(config.ImagesDirectory + "/" + screenshot + ".png")) screenshotsDeleteList.push(screenshot + ".png");
  }

  delete knownMods[modId];
  return { knownMods, filesDeleteList, screenshotsDeleteList }
}

export const deleteFile = (config: Config, file: number, knownMods: { [id: string]: KnownMod }, knownFiles: { [id: number]: string }, force: boolean = false) => {
  const deleteList = []
  if (existsSync(config.ModDirectory + "/" + file + ".zip")) {
    if (force) {
      unlinkSync(config.ModDirectory + "/" + file + ".zip")
    } else {
      deleteList.push(file + ".zip");
    }
  }

  const modId = knownFiles[file];
  const mod = knownMods[modId];

  mod.files = mod.files.filter(f => f != file);

  knownMods[modId] = mod;

  return { knownMods, deleteList };
}

export const createFile = async (config: Config, fileId: number, knownMods: { [id: string]: KnownMod }, discoveredFiles: { [id: number]: GBFile & { modId: string } }, deletedFiles: string[]) => {
  const file = discoveredFiles[fileId];

  const downloaded = await downloadFile(file.url, config.ModDirectory + "/" + fileId + ".zip")
  if (downloaded) await sleep(500); // if file already exist on disk (???) to not wait as we did not download it

  if (existsSync(config.ModDirectory + "/" + file + ".zip")) {
    if (deletedFiles.includes(file + ".zip")) deletedFiles = deletedFiles.filter(d => d !== file + ".zip")
    knownMods[file.modId].files.push(fileId);
  }

  return { knownMods, deletedFiles };
}

export const deleteScs = (config: Config, screenshot: string, knownMods: { [id: string]: KnownMod }, knownScreenshots: { [id: string]: string }) => {
  const deleteList = []
  if (existsSync(config.ImagesDirectory + "/" + screenshot + ".png")) deleteList.push(screenshot + ".png");
  const modId = knownScreenshots[screenshot];
  const mod = knownMods[modId];

  mod.screenshots = mod.screenshots.filter(f => f != screenshot);

  knownMods[modId] = mod;

  return { knownMods, deleteList };
}

export const createScs = async (config: Config, screenshot: string, knownMods: { [id: string]: KnownMod }, discoveredScreenshots: { [id: string]: GBScreenshot & { modId: string } }, deletedFiles: string[]) => {
  const file = discoveredScreenshots[screenshot];

  const downloaded = await downloadImage(file.url, config.ModDirectory + "/" + screenshot + ".png")
  if (downloaded) await sleep(500); // if file already exist on disk (???) to not wait as we did not download it

  if (existsSync(config.ModDirectory + "/" + screenshot + ".png")) {
    if (deletedFiles.includes(screenshot + ".png")) deletedFiles = deletedFiles.filter(d => d !== screenshot + ".png")
    knownMods[file.modId].screenshots.push(screenshot);
  }

  return { knownMods, deletedFiles };
}