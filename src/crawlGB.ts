import { headers } from ".";
import type { GBMod } from "./types";
import { sleep } from "./utils.js";

let pageSize = 40;

const game = 6460; // Celeste

const url = (category: string, page: number) => `https://gamebanana.com/apiv8/${category}/ByGame?_aGameRowIds[]=${game}&_csvProperties=_idRow,_sName,_aFiles,_aSubmitter,_sDescription,_sText,_nLikeCount,_nViewCount,_nDownloadCount,_aCategory,_tsDateAdded,_tsDateModified,_tsDateUpdated,_aPreviewMedia,_sProfileUrl,_bIsNsfw&_sOrderBy=_idRow,ASC&_nPage=${page}&_nPerpage=${pageSize})`;

const requestPage = async (category: string, page: number) => {
  console.log(`Loading page ${page} for ${category}`);
  let request = await fetch(url(category, page), { headers });
  let tries = 0;
  while (tries < 3) {
    const text = await request.text()
    if (request.status !== 200) {
      console.error(`Got a ${request.status} for ${request.url}: ${text}`)
    }
    pageSize++
    if (pageSize > 50) pageSize = 40;
    if (text.length == 0) {
      await sleep(5000 * tries);
      tries++
      request = await fetch(url(category, page), { headers });
      continue;
    }

    try {
      const obj = JSON.parse(text);
      const mods: { [id: string]: GBMod } = {};
      for (const modObj of obj) {
        let nsfw = false;
        let screenshots = modObj["_aPreviewMedia"]["_aImages"].slice(0, 2).map((o: any) => {
          const url = o["_sBaseUrl"] + "/" + o["_sFile"]
          const id = new URL(url).pathname.split(".").slice(0, -1).join(".").slice(1).replaceAll("/", "_")
          return { url, id }
        })

        if (modObj["_bIsNsfw"]) {
          // mod has content warnings! we need to check which ones.
          let request = await fetch("https://gamebanana.com/apiv11/" + category + "/" + modObj["_idRow"] + "/ProfilePage", { headers })
          let obj = await request.json()

          if ("show" !== obj["_sInitialVisibility"]) {
            screenshots = ["https://images.gamebanana.com/static/img/DefaultEmbeddables/nsfw.jpg"]
            nsfw = true;
          }
        }

        const mod: GBMod = {
          id: category.toLowerCase() + "_" + modObj["_idRow"],
          lastModification: modObj["_tsDateModified"],
          name: modObj["_sName"],
          submitter: modObj["_aSubmitter"]["_sName"],
          files: modObj["_aFiles"].filter((o: any) => o["_sFile"].endsWith(".zip")).map((o: any) => { return { url: o["_sDownloadUrl"], id: o["_idRow"] } }),
          screenshots,
          nsfw
        }
        mods[mod.id] = mod;
      }

      return mods
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        await sleep(5000 * tries);
        tries++
        request = await fetch(url(category, page), { headers });
        continue;
      }
      throw error;
    }
  }
  return {};
}

const crawlModsCategory = async (category: string) => {
  let fullmodList: { [id: string]: GBMod } = {};
  let page = 1;
  let pageContent = await requestPage(category, page);
  while (Object.keys(pageContent).length > 0) {
    fullmodList = {
      ...fullmodList,
      ...pageContent
    };
    page++;
    pageContent = await requestPage(category, page);
  }

  return Object.values(fullmodList);
}

export { requestPage, crawlModsCategory };