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
}

/*
 * Name:        fetchMasteryInfo()
 * Arguments:   A string representing the player's unique identifier (PUUID).
 * Returns:     None.
 * Description: Calls the Riot API to retrieve the mastery data for the given
 *              PUUID.
 * Effects:     Calls getChampionsMap() to retrieve corresponding champion names
 *              from their IDs. Populates the "mastery-info" HTML table.
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
        
        // Clear previous table data
        const masteryTableBody = document.getElementById("mastery-info");
        masteryTableBody.innerHTML = "";

        // Populate table with mastery data
        masteryData.forEach(champion => {
            const row = formatMasteryRow(champion, championsMap);
            masteryTableBody.appendChild(row);
        });
    } catch (err) {
        console.error("Error fetching mastery data:", err);
        alert("Error fetching mastery data.");
    }
}

/*
 * Name:        formatMasteryRow()
 * Arguments:   A champion object and a map of champion IDs to names.
 * Returns:     A table row element containing the mastery info for the given champion.
 * Description: Extracts relevant champion mastery data and formats it into a
 *              table row (<tr> element).
 * Effects:     None.
 */
function formatMasteryRow(champion, championsMap) {
    const championId = champion.championId;
    const championName = championsMap[championId] || "Champion not found";
    const championIconUrl = getChampionIconUrl(championName);
    const championLevel = champion.championLevel;
    const championPoints = champion.championPoints;
    const markRequiredForNextLevel = champion.markRequiredForNextLevel;
    const marksEarned = champion.tokensEarned;
    const gradeReq = getRequiredGrade(champion);
    const overflowData = getMasteryOverflow([champion])[0];
    const gamesRequired = overflowData.gamesRequired;

    const gradeColor = gradeReq === 'S- or better' ? '#FF0000' : '#000000';
    const overflowColor = gamesRequired === 0 ? '#000000' : '#FF0000';

    // Create table row
    const row = document.createElement("tr");
    row.innerHTML = `
        <td><img src="${championIconUrl}" alt="${championName}" class="champion-icon"></td>
        <td>${championLevel}</td>
        <td>${championPoints}</td>
        <td>${markRequiredForNextLevel}</td>
        <td>${marksEarned}</td>
        <td style="color: ${gradeColor};">${gradeReq}</td>
        <td style="color: ${overflowColor};">${gamesRequired}</td>
    `;
    
    return row;
}

/*
 * Name:        getChampionIconUrl()
 * Arguments:   A string representing the champion's name.
 * Returns:     A string containing the full URL to the champion's icon.
 * Description: Constructs the URL to fetch the champion's image from the
 *              DDragon CDN.
 * Effects:     None.
 */
function getChampionIconUrl(championName) {
    const version = "15.5.1";

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

    if (specialCases[championName]) {
        return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${specialCases[championName]}.png`;
    }

    const formattedName = championName.replace(/[^a-zA-Z0-9]/g, "");

    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${formattedName}.png`;
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
 * Name:        getMasteryOverflow()
 * Arguments:   An array of objects containing champion ID, points, level,
 *              current marks, and mastery overflow data.
 * Returns:     An array of champions with the number of games needed to
 *              fix overflow.
 * Description: Determines how many marks are needed to level up for champions
 *              that have enough mastery points but not enough marks.
 * Effects:     None.
 */
function getMasteryOverflow(masteryData) {
    return masteryData.map(champion => {
        const { championId, championPoints, championLevel, tokensEarned } = champion;

        // Determine max reachable level based on current mastery points
        const newLevel = getMaxReachableLevel(championPoints, championLevel);

        // Calculate marks needed to reach new level
        const totalMarksNeeded = calculateMarksNeeded(championLevel, newLevel);

        // Subtract already-earned marks
        const marksNeeded = Math.max(0, totalMarksNeeded - tokensEarned);

        return {
            championId,
            marksNeeded,
            gamesRequired: marksNeeded
        };
    });
}

/*
 * Name:        getMaxReachableLevel()
 * Arguments:   An integer representing a champion's mastery points and level.
 * Returns:     The maximum level the champion can reach with current points.
 * Description: Determines the highest mastery level the champion can instantly
 *              reach based on points.
 * Effects:     None.
 */
function getMaxReachableLevel(championPoints, championLevel) {
    let newLevel = championLevel;
    while (championPoints >= getLevelInfo(newLevel + 1).points) {
        newLevel++;
    }
    return newLevel;
}

/*
 * Name:        calculateMarksNeeded()
 * Arguments:   An integer representing a champion's current mastery level and
 *              potential level.
 * Returns:     The total number of marks needed to advance from the current to
 *              the potential level.
 * Description: Sums up all required marks from the current level to the highest
 *              reachable level.
 * Effects:     None.
 */
function calculateMarksNeeded(currentLevel, newLevel) {
    let totalMarks = 0;
    for (let lvl = currentLevel + 1; lvl <= newLevel; lvl++) {
        totalMarks += getLevelInfo(lvl).marks;
    }
    return totalMarks;
}

/*
 * Name:        getLevelInfo()
 * Arguments:   An integer representing a champion's current mastery level.
 * Returns:     An object containing mastery level data (points and marks).
 * Description: Provides mastery level thresholds for each level. Handles level
 *              10+ dynamically.
 * Effects:     None.
 */
function getLevelInfo(level) {
    const masteryLevels = [
        { level: 1, points: 0, marks: 0 },
        { level: 2, points: 1800, marks: 0 },
        { level: 3, points: 6000, marks: 0 },
        { level: 4, points: 12600, marks: 0 },
        { level: 5, points: 21600, marks: 1 },
        { level: 6, points: 31600, marks: 1 },
        { level: 7, points: 42600, marks: 1 },
        { level: 8, points: 53600, marks: 1 },
        { level: 9, points: 64600, marks: 1 },
        { level: 10, points: 75600, marks: 2 }
    ];

    if (level <= 10) return masteryLevels[level - 1];
    return { level, points: 75600 + (11000 * (level - 10)), marks: 2 };
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