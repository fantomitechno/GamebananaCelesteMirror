import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { headers } from "../index.js";
import type { ProviderFile, ProviderMod, ProviderScreenshot } from "../types";
import { getConfig, sleep } from "../utils.js";

let pageSize = 40;

const game = 6460; // Celeste

// prettier-ignore
const pageUrl = (category: string, page: number) => `https://gamebanana.com/apiv8/${category}/ByGame?_aGameRowIds[]=${game}&_csvProperties=_idRow,_sName,_aFiles,_aSubmitter,_tsDateAdded,_tsDateModified,_tsDateUpdated,_aPreviewMedia,_sProfileUrl,_bIsNsfw&_sOrderBy=_idRow,ASC&_nPage=${page}&_nPerpage=${pageSize})`;
// prettier-ignore
const infoPageUrl = (category: string, page: number) => `https://gamebanana.com/apiv10/${category}/Index?_nPage=${page}&_nPerpage=${pageSize}&_aFilters[Generic_Game]=${game}&_sSort=Generic_LatestModified`;
// prettier-ignore
const modPageUrl = (category: string, modId: number) => `https://gamebanana.com/apiv8/${category}/${modId}?_csvProperties=_idRow,_sName,_aFiles,_aSubmitter,_sDescription,_sText,_nLikeCount,_nViewCount,_nDownloadCount,_aCategory,_tsDateAdded,_tsDateModified,_tsDateUpdated,_aPreviewMedia,_sProfileUrl,_bIsNsfw&ts=${new Date().getMilliseconds()}`;

const parseMod = async (category: string, obj: any): Promise<ProviderMod> => {
  let nsfw = false;
  let screenshots: ProviderScreenshot[] = obj["_aPreviewMedia"]["_aImages"].slice(0, 2).map((o: any) => {
    const file = o["_sFile220"] || o["_sFile"];
    const url = o["_sBaseUrl"] + "/" + file;
    const id = new URL(o["_sBaseUrl"] + "/" + o["_sFile"]).pathname
      .split(".")
      .slice(0, -1)
      .join(".")
      .slice(1)
      .replaceAll("/", "_");
    return { url, id };
  });

  if (obj["_bIsNsfw"]) {
    // mod has content warnings! we need to check which ones.
    // prettier-ignore
    let request = await fetch(`https://gamebanana.com/apiv11/${category}/${obj['_idRow']}/ProfilePage`, { headers });
    let res = await request.json();

    if ("show" !== res["_sInitialVisibility"]) {
      screenshots = screenshots.map((s) => {
        return {
          url: "https://images.gamebanana.com/static/img/DefaultEmbeddables/nsfw.jpg",
          id: s.id,
        };
      });
      nsfw = true;
    }
  }

  return {
    id: category.toLowerCase() + "_" + obj["_idRow"],
    lastModification: obj["_tsDateModified"],
    name: obj["_sName"],
    files:
      obj["_aFiles"]
        ?.filter((o: any) => o["_sFile"].endsWith(".zip") && (!o["_bIsArchived"] || !getConfig().DownloadArchived))
        .map((o: any) => {
          return {
            url: o["_sDownloadUrl"],
            id: o["_idRow"],
            checksum: o["_sMd5Checksum"],
            size: o["_nFilesize"],
          } as ProviderFile;
        }) ?? [],
    screenshots,
    nsfw,
  };
};

const requestFullPage = async (category: string, page: number) => {
  console.log(`Loading page ${page} for ${category}`);
  let request = await fetch(pageUrl(category, page), { headers });
  let tries = 0;
  while (tries < 3) {
    const text = await request.text();
    if (request.status !== 200) {
      console.error(`Got a ${request.status} for ${request.url}: ${text}`);
    }
    if (text.length == 0) {
      await sleep(5000 * tries);
      tries++;
      request = await fetch(pageUrl(category, page), { headers });
      continue;
    }

    try {
      const obj = JSON.parse(text);
      const mods: { [id: string]: ProviderMod } = {};
      for (const modObj of obj) {
        const mod = await parseMod(category, modObj);
        mods[mod.id] = mod;
      }

      return mods;
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        await sleep(5000 * tries);
        tries++;
        request = await fetch(pageUrl(category, page), { headers });
        continue;
      }
      throw error;
    }
  }
  return {};
};

const requestPage = async (
  category: string,
  page: number,
): Promise<{ _tsDateModified: number; _idRow: number }[] | null> => {
  console.log(`Loading page ${page} for ${category}`);
  let request = await fetch(infoPageUrl(category, page), { headers });
  let tries = 0;
  while (tries < 3) {
    const text = await request.text();
    if (request.status !== 200) {
      console.error(`Got a ${request.status} for ${request.url}: ${text}`);
    }
    if (text.length == 0) {
      await sleep(5000 * tries);
      tries++;
      request = await fetch(infoPageUrl(category, page), { headers });
      continue;
    }

    try {
      return JSON.parse(text)["_aRecords"];
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        await sleep(5000 * tries);
        tries++;
        request = await fetch(infoPageUrl(category, page), { headers });
        continue;
      }
      throw error;
    }
  }
  return null;
};

const requestMod = async (category: string, modId: number) => {
  console.log(`Loading mod ${modId} for ${category}`);
  let request = await fetch(modPageUrl(category, modId), { headers });
  let tries = 0;
  while (tries < 3) {
    const text = await request.text();
    if (request.status !== 200) {
      console.error(`Got a ${request.status} for ${request.url}: ${text}`);
    }
    if (text.length == 0) {
      await sleep(5000 * tries);
      tries++;
      request = await fetch(modPageUrl(category, modId), { headers });
      continue;
    }

    try {
      const obj = JSON.parse(text);
      return await parseMod(category, obj);
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        await sleep(5000 * tries);
        tries++;
        request = await fetch(modPageUrl(category, modId), { headers });
        continue;
      }
      throw error;
    }
  }
  return null;
};

const crawlModsCategoryFull = async (category: string) => {
  let fullmodList: { [id: string]: ProviderMod } = {};
  let page = 1;
  let pageContent = await requestFullPage(category, page);
  while (Object.keys(pageContent).length > 0) {
    fullmodList = {
      ...fullmodList,
      ...pageContent,
    };
    page++;
    pageContent = await requestFullPage(category, page);
  }

  let lastModification = Math.max(...Object.values(fullmodList).map((m) => m.lastModification));

  let lastUpdateObject: { [category: string]: number } = {};
  if (existsSync("state.json")) {
    let stateFile = readFileSync("state.json");
    lastUpdateObject = JSON.parse(stateFile.toString());
  }

  lastUpdateObject[category] = Math.max(lastModification, lastUpdateObject[category]);
  writeFileSync("state.json", JSON.stringify(lastUpdateObject));
  pageSize++;
  if (pageSize > 50) pageSize = 40;

  return Object.values(fullmodList);
};

const crawlModsCategory = async (category: string) => {
  let lastUpdateObject: { [category: string]: number } = { category: 0 };
  if (existsSync("state.json")) {
    let stateFile = readFileSync("state.json");
    lastUpdateObject = JSON.parse(stateFile.toString());
  }
  let fullmodList: { [id: string]: ProviderMod } = {};

  let lastUpdate = lastUpdateObject[category];

  let page = 1;
  while (true) {
    const pageContent = await requestPage(category, page);
    if (!pageContent) break;

    if (!pageContent.length) {
      console.log("state.json content: ", lastUpdateObject);
      break;
    }

    for (const mod of pageContent) {
      if (mod._tsDateModified > lastUpdateObject[category]) {
        const modInfo = await requestMod(category, mod._idRow);
        if (modInfo) {
          lastUpdate = Math.max(mod._tsDateModified, lastUpdate);
          fullmodList[modInfo.id] = modInfo;
        }
      } else {
        lastUpdateObject[category] = lastUpdate;
        writeFileSync("state.json", JSON.stringify(lastUpdateObject));
        return Object.values(fullmodList);
      }
    }
    page++;
  }

  lastUpdateObject[category] = lastUpdate;
  writeFileSync("state.json", JSON.stringify(lastUpdateObject));
  pageSize++;
  if (pageSize > 50) pageSize = 40;
  return Object.values(fullmodList);
};

const validCategories = ["Mod", "Tool", "Wip"];
// const validCategories = ["Tool"];

export const loadMods = async (fullRun: boolean) => {
  const mods: ProviderMod[] = [];
  if (fullRun) {
    for (const category of validCategories) {
      mods.push(...(await crawlModsCategoryFull(category)));
    }
  } else {
    for (const category of validCategories) {
      mods.push(...(await crawlModsCategory(category)));
    }
  }

  return mods;
};
