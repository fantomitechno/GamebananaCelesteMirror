# Celeste Gamebanana Mirror

A mirroring "script" for all files used by Everest and Olympus.

## Running

You can run it as a Docker container with the Dockerfile or you can run it natively with NodeJS via `npm run build && npm run start`.

### Configuration

There is 3 ways to input on the script:

- Using the config file: `config.toml` (`ModDirectory` will be where all the `.zip` files will be stored, this is the folder that will be the biggest)
- Using environment variable: you can pass `TIMEOUT`, if this is a number it will be interpreted as the number of minutes between runs (by default if nothing is passed: 30 minutes, keep in mind that the Gamebanana API as a limit of calls per days) else it will block the loop from running and it will only run once.
- Using CLI arguments, you can replace the environment variable by a simple argument behind `npm run start` which will have the same effect.

## Logic

Every loop runs the main() function:

- Read `config.toml`

Every 8 runs (including the first one):

- Call the gamebanana API to collect every projects in `Mod`, `Wip` and `Tool` for the game Celeste
- Load the local database `{ModDirectory}/mods.json` and compare both.
- Create all new mods (creation = download of all zip files to ModDirectory and the first 2 screenshots to ImageDirectory)
- Delete from database (not disk) all unknown zip files
- Download all new zip files
- Delete from database (not disk) all unknown screenshots
- Download all new screenshots
- Delete from database (not disk) all unknown mods
- Process map icons (this step will also delete from database and disk all possibly corrupted zip files to allow for a clean download at next run)

Every other run:

- Call the gamebanana API to collect all newly updated projects in `Mod`, `Wip` and `Tool` for the game Celeste
- Load the local database `{ModDirectory}/mods.json` and compare both.
- Create all new mods (creation = download of all zip files to ModDirectory and the first 2 screenshots to ImageDirectory)
- Delete from database (not disk) all unknown zip files
- Download all new zip files
- Delete from database (not disk) all unknown screenshots
- Download all new screenshots
- Process map icons (this step will also delete from database and disk all possibly corrupted zip files to allow for a clean download at next run)

### I want to delete from disk

In the possibility of a gamebanana outage, the gamebanana API would send back an empty array and to not _nuke_ your own mirror by mistake, the deletion are just made in the database and not on disk.

Deletion can be run with `npm run delete` (this will still block if you are deleting more than 50 files at once, this can be bypassed with the environment variable `FORCE` set to **1**)

## Acknowledgment

For the calls to the Gamebanana API, I looked at how [Maddie480](https://github.com/maddie480/EverestUpdateCheckerServer) runs her own mirror.

I also used this repository as truth for how to name files.

## AI Disclosure

AI was not used to code, the only usage was as a research tool: a Claude chat to search the equivalent of `StreamingXXHash64` in NodeJS, I then researched the library on my own, not copy pasting it.
