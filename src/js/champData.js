/*
 *  champData.js
 *  Justin Paik
 *  Created: 27 May 2025
 *  Last Updated: 28 May 2025
 *  Champion Data Utilities
 *
 *  This module provides functions for retrieving and processing champion
 *  metadata from Riot's DDragon API. It includes methods to fetch the latest
 *  champion list, construct icon URLs, and build maps for ID-to-name lookup.
 *  Caching is used to reduce redundant network calls.
 */

/*
 * Name:        getChampIconUrl()
 * Arguments:   A string representing the champion's name.
 * Returns:     A string containing the full URL to the champion's icon.
 * Description: Constructs the URL to fetch the champion's image from the
 *              DDragon CDN.
 * Effects:     None.
 */
export function getChampIconUrl(champName) {
    const version = cachedVersion;

    const specialCases = {
        "Bel'Veth": "Belveth",
        "Cho'Gath": "Chogath",
        "Kai'Sa": "Kaisa",
        "Kha'Zix": "Khazix",
        "LeBlanc": "Leblanc",
        "Nunu & Willump": "Nunu",
        "Renata Glasc": "Renata",
        "Vel'Koz": "Velkoz",
        "Wukong": "MonkeyKing",
    };

    if (specialCases[champName]) {
        return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${specialCases[champName]}.png`;
    }

    const formattedName = champName.replace(/[^a-zA-Z0-9]/g, "");

    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${formattedName}.png`;
}

/*
 * Name:        getChampMap()
 * Arguments:   None.
 * Returns:     A string map where the keys are champion IDs and values are
 *              champion names.
 * Description: Retrieves a cached map of champion IDs to names.
 * Effects:     Calls getLatestDDragon() if champion data is not yet cached.
 */
export async function getChampMap() {
    // Call helper function to call from API
    const champs = await getLatestDDragon();

    // Create the map
    const champMap = {};
    for (const champ in champs) {
        champMap[champs[champ].key] = champs[champ].name;
    }

    return champMap;
}

/*
 * Name:        getLatestDDragon()
 * Arguments:   None.
 * Returns:     A promise resolving to an object containing champion names and
 *              IDs.
 * Description: Fetches the latest champion data from the Data Dragon API.
 *              Caches the retrieved data, refreshing when a new patch is
 *              available.
 * Effects:     Calls Riot API if cache is empty or outdated. Stores fetched
 *              champion data in the global "champJson" variable.
 */
let champJson = {};
let cachedVersion = "";
async function getLatestDDragon() {
    try {
        // Get latest version
        const versionResponse = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        const versions = await versionResponse.json();
        const latestVersion = versions[0];

        // If cache exists and version is the same, return cache
        if (Object.keys(champJson).length > 0 && cachedVersion === latestVersion) {
            return champJson;
        }

        // Otherwise, update cache with new version
        const ddragonResponse = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`);
        const ddragonData = await ddragonResponse.json();
        cachedVersion = latestVersion;

        // Return the JSON containing the data
        champJson = ddragonData.data;
        return champJson;
    } catch (err) {
        console.error("Error fetching from DDragon API:", err);
        return {};
    }    
}