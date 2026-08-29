export interface ProviderMod extends GenericMod {
  files: ProviderFile[];
  screenshots: ProviderScreenshot[];
}

export interface ProviderFile {
  url: string;
  id: number;
  checksum: string;
  size: number;
}

export interface ProviderScreenshot {
  url: string;
  id: string;
}

export interface BaseMod {
  name: string;
  id: string;
}

export interface GenericMod extends BaseMod {
  lastModification: number;
  nsfw: boolean;
}

export interface LocalMod extends GenericMod {
  files: number[];
  screenshots: string[];
}

export interface DeletedMod extends BaseMod {
  date: number;
  files: number[];
}

export interface Config {
  ModDirectory: string;
  ImagesDirectory: string;
  RichPresenceDirectory: string;
  ModsArchiveDirectory: string;

  DownloadArchived: boolean;
}
