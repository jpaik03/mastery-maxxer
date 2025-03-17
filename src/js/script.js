/*
 *  script.js
 *  Justin Paik
 *  Created: 16 March 2025
 *  Last Updated: XX March 2025 
 *  Riot API Mastery Fetcher
 *
 *  This script handles fetching champion mastery data for a given Riot ID. It
 *  manages user input, sends API requests, processes the data, and updates the
 *  UI accordingly. The script also includes helper functions for data retrieval
 *  and displaying formatting.
 */

/*
 * Handle Riot ID search form submission
 */
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("collect-riot-id").addEventListener("submit", handleRiotIdSubmit);
});

/*
 * Name:        handleRiotIdSubmit()
 * Arguments:   An event object from the form submission.
 * Returns:     None.
 * Description: Handles form submission, retrieves PUUID, and triggers mastery
 *              data fetching.
 * Effects:     Calls fetchRiotAccount() to get mastery data. Updates UI with
 *              retrieved Riot ID and calls fetchMasteryInfo().
 */
let puuid = "";
async function handleRiotIdSubmit(event) {
    event.preventDefault();
    // Get form elements
    const username = getInputValue("username-input");
    const tag = getInputValue("tag-input");

    // Ensure user inputs both username and tag
    if (!username || !tag) {
        alert("Please enter your Riot ID.");
        return;
    }

    try {
        // Call Riot API using fetchRiotAccount() to get PUUID
        const data = await fetchRiotAccount(username, tag);

        if (data.error) {
            alert("Error: " + data.error);
            return;
        }

        puuid = data.puuid;
        // Update Riot ID Ui using updateRiotIdUI()
        updateRiotIdUI(data);
        fetchMasteryInfo(puuid);
    } catch (err) {
        console.error("Error fetching Riot account:", err);
        alert("Error fetching Riot account.");
    }
}

/*
 * Name:        getInputValue()
 * Arguments:   A string representing the ID of an input field.
 * Returns:     A trimmed string containing the input value.
 * Description: Retrieves and trims the value of an input field.
 * Effects:     None.
 */
function getInputValue(elementId) {
    return document.getElementById(elementId)?.value.trim() || "";
}

/*
 * Name:        fetchRiotAccount()
 * Arguments:   Two strings representing the player's username and tag.
 * Returns:     A promise resolving to an object containing Riot ID information.
 * Description: Calls the Riot API to fetch account details using username and
 *              tag.
 * Effects:     None.
 */
async function fetchRiotAccount(username, tag) {
    const response = await fetch(`/api/account-by-riot-id?username=${encodeURIComponent(username)}&tag=${encodeURIComponent(tag)}`);
    return response.json();
}

/*
 * Name:        updateRiotIdUI()
 * Arguments:   An object containing Riot ID information.
 * Returns:     None.
 * Description: Updates the UI to display Riot ID information.
 * Effects:     Modifies HTML elements to show retrieved data.
 */
function updateRiotIdUI(data) {
    document.getElementById("display-username").textContent = data.gameName;
    document.getElementById("display-tag").textContent = `#${data.tagLine}`;
    document.getElementById("display-puuid").textContent = data.puuid;
}

/*
 * Name:        fetchMasteryInfo()
 * Arguments:   A string representing the player's unique identifier (PUUID).
 * Returns:     None.
 * Description: Calls the Riot API to retrieve the mastery data for the given
 *              PUUID.
 * Effects:     Calls getChampionsMap() to retrieve corresponding champion names
 *              from their IDs. Modifies the "mastery-info" HTML element to
 *              display the data.
 */
async function fetchMasteryInfo(puuid) {
    try {
        // Call Riot API to get mastery data
        const response = await fetch(`/api/champion-mastery?puuid=${puuid}`)
        const masteryData = await response.json();

        if (masteryData.error) {
            alert("Error: " + masteryData.error);
            return;
        }

        // Call getChampionsMap() to get map of champion names from their IDs
        const championsMap = await getChampionsMap();
        
        // Call formatChampionMastery() to get the HTML string to update the UI
        const masteryInfo = masteryData.map(champion => formatChampionMastery(champion, championsMap)).join("");
        document.getElementById("mastery-info").innerHTML = masteryInfo;
    } catch (err) {
        console.error("Error fetching mastery data:", err);
        alert("Error fetching mastery data.");
    }
}

/*
 * Name:        formatChampionMastery()
 * Arguments:   A champion object, and a map of champion IDs to names.
 * Returns:     A formatted HTML string containing the mastery info for the
 *              given champion.
 * Description: Extracts relevant champion mastery data and formats it into
 *              an HTML string.
 * Effects:     None.
 */
function formatChampionMastery(champion, championsMap) {
    const championId = champion.championId;
    const championName = championsMap[championId] || "Champion not found";
    const championLevel = champion.championLevel;
    const championPoints = champion.championPoints;
    const championPointsSinceLastLevel = champion.championPointsSinceLastLevel;
    const markRequiredForNextLevel = champion.markRequiredForNextLevel;
    const tokensEarned = champion.tokensEarned;
    const gradeReq = getRequiredGrade(champion);

    return `
        <div>
            <p>Champion: ${championName}</p>
            <p>Level: ${championLevel}</p>
            <p>Points: ${championPoints}</p>
            <p>Points since last level: ${championPointsSinceLastLevel}</p>
            <p>Marks required for next level: ${markRequiredForNextLevel}</p>
            <p>Current marks: ${tokensEarned}</p>
            <p>Required grade for next mark: ${gradeReq}</p>
        </div>
        <hr>
    `;
}

/*
 * Name:        getRequiredGrade()
 * Arguments:   A champion object.
 * Returns:     A string indicating the required grade for the next milestone.
 * Description: Extracts the required grade from the champion mastery object.
 * Effects:     None.
 */
function getRequiredGrade(champion) {
    const nextMarkGrade = champion.nextSeasonMilestone?.requireGradeCounts || {};
    return nextMarkGrade["S-"] ? `S- or better` : `A- or better`;
}

/*
 * Name:        getChampionsMap()
 * Arguments:   None.
 * Returns:     A string map where the keys are champion IDs and values are
 *              champion names.
 * Description: Retrieves a cached map of champion IDs to names.
 * Effects:     Calls getLatestDDragon() if champion data is not yet cached.
 */
async function getChampionsMap() {
    // Call helper function to call from API
    const champions = await getLatestDDragon();

    // Create the map
    const championsMap = {};
    for (const champ in champions) {
        championsMap[champions[champ].key] = champions[champ].name;
    }

    return championsMap;
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
 *              champion data in the global "championJson" variable.
 */
let championJson = {};
let cachedVersion = "";
async function getLatestDDragon() {
    try {
        // Get latest version
        const versionResponse = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        const versions = await versionResponse.json();
        const latestVersion = versions[0];

        // If cache exists and version is the same, return cache
        if (Object.keys(championJson).length > 0 && cachedVersion === latestVersion) {
            return championJson;
        }

        // Otherwise, update cache with new version
        const ddragonResponse = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`);
        const ddragonData = await ddragonResponse.json();
        cachedVersion = latestVersion;

        // Return the JSON containing the data
        championJson = ddragonData.data;
        return championJson;
    } catch (err) {
        console.error("Error fetching from DDragon API:", err);
        return {};
    }    
}

/*
 * Name:        getChampionByKey()
 * Arguments:   An integer representing the champion's ID.
 * Returns:     A promise resolving to a string containing the champion's name.
 * Description: Retrieves the champion's name corresponding to their ID by
 *              searching through the cached Data Dragon data.
 * Effects:     Calls getLatestDDragon() to ensure the champion list is loaded.
 *              Returns and error if the champion ID is not found.
 */
async function getChampionByKey(key) {
    const champions = await getLatestDDragon();

    return champions[key.toString()]?.name || "Error: Champion not found.";
}