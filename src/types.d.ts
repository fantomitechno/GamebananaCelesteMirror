export interface GBMod extends GenericMod {
  files: GBFile[]
  screenshots: GBScreenshot[]
}

export interface GBFile {
  url: string,
  id: number
}

export interface GBScreenshot {
  url: string,
  id: string
}

export interface GenericMod {
  name: string
  lastModification: number
  id: string
  nsfw: boolean
}

export interface KnownMod extends GenericMod {
  files: number[]
  screenshots: string[]
}

export interface Config {
  ModDirectory: string;
  ImagesDirectory: string;
  RichPresenceDirectory: string;
}