import { ProviderMod } from "../types";
import { loadMods as gbLoad } from "./gamebanana.js";

export const loadMods = async (fullrun: boolean) => {
  const mods: ProviderMod[] = [];

  mods.push(...(await gbLoad(fullrun)));

  return mods;
};
