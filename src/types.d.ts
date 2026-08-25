export interface GBMod extends GenericMod {
  files: GBFile[]
  screenshots: GBScreenshot[]
}

export interface GBFile {
  url: string,
  id: number,
  checksum: string
}

export interface GBScreenshot {
  url: string,
  id: string
}

export interface BaseMod {
  name: string,
  id: string,
}

export interface GenericMod extends BaseMod {
  lastModification: number
  nsfw: boolean
}

export interface KnownMod extends GenericMod {
  files: number[]
  screenshots: string[]
}

export interface DeletedMod extends BaseMod {
  date: number,
  files: number[]
}

export interface Config {
  ModDirectory: string;
  ImagesDirectory: string;
  RichPresenceDirectory: string;
  ModsArchiveDirectory: string;

  DownloadArchived: boolean
}