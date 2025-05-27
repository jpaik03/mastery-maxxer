/*
 *  Comparer.js
 *  Justin Paik
 *  Created: 16 March 2025
 *  Last Updated: 27 May 2025
 *  Riot API Mastery Comparer
 *
 *  This script manages profile inputs and champion selection, fetches mastery
 *  data for multiple profiles, and displays mastery info and recent win/loss
 *  history in a table.
 */

import { getChampionIconUrl, getChampionsMap } from "./championData.js";
import { fetchRiotAccount, fetchAChampionMastery, fetchMatchHistory, fetchMatchDetails } from "./riotApi.js";

/*
 * Initialize event listeners on DOM load
 */
document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("profile-count").addEventListener("change", updateProfileNum);
    document.getElementById("fetch-mastery").addEventListener("click", fetchAllProfilesMastery);
    updateProfileNum();
    await populateChampionDropdown();
});

/*
 * Name:        updateProfileNum()
 * Arguments:   None.
 * Returns:     None.
 * Description: Adjusts the number of profile input fields based on the dropdown
 *              selection.
 * Effects:     Dynamically modifies the HTML to match the selected number of
 *              profiles.
 */
function updateProfileNum() {
    const profileContainer = document.getElementById("profile-container");
    const selectedCount = parseInt(document.getElementById("profile-count").value, 10);

    // Save existing inputs
    const existingInputs = getExistingInputs();

    // Clear existing profile inputs and add the new ones
    profileContainer.innerHTML = "";
    for (let i = 1; i <= selectedCount; i++) {
        profileContainer.appendChild(createProfileInput(i, existingInputs[i - 1]));
    }
}

/*
 * Name:        getExistingInputs()
 * Arguments:   None.
 * Returns:     An array of objects containing usernames and tags from existing
 *              profile fields.
 * Description: Retrieves current values before modifying profile input fields.
 * Effects:     None.
 */
function getExistingInputs() {
    const existingInputs = [];
    const profileEntries = document.querySelectorAll(".profile-entry");

    // Collect and store current entries
    for (let i = 0; i < profileEntries.length; i++) {
        const entry = profileEntries[i];
        const usernameInput = entry.querySelector(".username-input");
        const tagInput = entry.querySelector(".tag-input");

        existingInputs.push({
            username: usernameInput ? usernameInput.value : "",
            tag: tagInput ? tagInput.value : ""
        });
    }
    return existingInputs;
}

/*
 * Name:        createProfileInput()
 * Arguments:   An integer representing the profile index and an object with
 *              existing values.
 * Returns:     A <div> element containing profile input fields.
 * Description: Generates profile input fields prefilled with existing values.
 * Effects:     None.
 */
function createProfileInput(profileNumber, existingData = {}) {
    // Create a div element for the profile
    const profileDiv = document.createElement("div");
    profileDiv.classList.add("profile-entry");
    
    // Write the data into the element
    profileDiv.innerHTML = `
        <label>Profile ${profileNumber}: </label>
        <input type="text" class="username-input" placeholder="Username" value="${existingData.username || ""}" required />
        <label>#</label>
        <input type="text" class="tag-input" placeholder="Tag" value="${existingData.tag || ""}" required />
    `;

    return profileDiv;
}

/*
 * Name:        getProfilesWithPUUIDs()
 * Arguments:   None.
 * Returns:     An array of objects containing gameName, tagLine, and PUUID.
 * Description: Retrieves PUUIDs for profiles that have both username and tag
 *              filled.
 * Effects:     Calls Riot API.
 */
async function getProfilesWithPUUIDs() {
    const profiles = [];

    for (const entry of document.querySelectorAll(".profile-entry")) {
        const username = entry.querySelector(".username-input").value.trim();
        const tag = entry.querySelector(".tag-input").value.trim();

        // Skip entries that are not fully filled in
        if (!username || !tag) {
            continue;
        }

        // Fetch account data
        const profileData = await fetchRiotAccount(username, tag);
        if (!profileData.error) {
            profiles.push({
                gameName: profileData.gameName,
                tagLine: profileData.tagLine,
                puuid: profileData.puuid
            });
        }
    }
    return profiles;
}

/*
 * Name:        populateChampionDropdown()
 * Arguments:   None.
 * Returns:     None.
 * Description: Retrieves and fills the champion dropdown with an alphabetised
 *              list.
 * Effects:     Modifies the "champion-input" select element.
 */
async function populateChampionDropdown() {
    try {
        const championDropdown = document.getElementById("champion-input");
        const champions = await getChampionsList();

        // Populate dropdown with sorted champion names
        championDropdown.innerHTML = `<option value="">Select a Champion</option>` + champions.map(champion => `<option value="${champion}">${champion}</option>`).join("");
    } catch (err) {
        console.error("Error fetching champions:", err);
    }
}

/*
 * Name:        getChampionsList()
 * Arguments:   None.
 * Returns:     An array of champion names sorted alphabetically.
 * Description: Retrieves the latest champion list from Data Dragon.
 * Effects:     Fetches champion data from Riot API.
 */
async function getChampionsList() {
    try {
        // Fetch champion data
        const championsMap = await getChampionsMap();

        // Return alphabetised champion names
        return Object.values(championsMap).sort();
    } catch (err) {
        console.error("Error fetching champions:", err);
        return [];
    }
}

/*
 * Name:        fetchAllProfilesMastery()
 * Arguments:   None.
 * Returns:     None.
 * Description: Fetches mastery data for a selected champion across all entered
 *              profiles.
 * Effects:     Updates the mastery table dynamically.
 */
async function fetchAllProfilesMastery() {
    const championId = await getSelectedChampionId();
    if (!championId) return;

    const profiles = await getProfilesWithPUUIDs();
    if (!profiles.length) return;

    // Update champion icon
    const championName = document.getElementById("champion-input").value;
    const championIconUrl = getChampionIconUrl(championName);
    const championIcon = document.getElementById("champion-icon");

    championIcon.src = championIconUrl;
    championIcon.alt = championName;
    championIcon.style.display = "block";

    // Fetch mastery data and update table
    const masteryData = await Promise.all(profiles.map(profile => fetchAChampionMastery(profile.puuid, championId)));
    updateMasteryTable(masteryData, profiles, championId);
}

/*
 * Name:        updateMasteryTable()
 * Arguments:   An array of mastery data, an array of profile data, and a champion ID.
 * Returns:     None.
 * Description: Updates the mastery table with sorted mastery points and win/loss history.
 * Effects:     Dynamically modifies the HTML table content.
 */
async function updateMasteryTable(masteryData, profiles, championId) {
    const masteryTableBody = document.getElementById("mastery-info");
    masteryTableBody.innerHTML = "";

    // Fetch win/loss history for each profile in parallel
    const winLossHistories = await Promise.all(profiles.map(profile => getWinLossHistory(profile.puuid, championId)));

    // Process, combine, and sort mastery data
    const combinedData = masteryData.map((mastery, index) => ({
        profile: profiles[index],
        level: mastery?.championLevel || 0,
        points: mastery?.championPoints || 0,
        winLoss: winLossHistories[index].join(" ")
    }));

    // Sort by mastery points in descending order
    combinedData.sort((a, b) => b.points - a.points);

    // Populate table
    combinedData.forEach(({ profile, level, points, winLoss }) => {
        masteryTableBody.innerHTML += `
            <tr>
                <td>${profile.gameName}#${profile.tagLine}</td>
                <td>${level}</td>
                <td>${points}</td>
                <td>${winLoss}</td>
            </tr>`;
    });
}

/*
 * Name:        getWinLossHistory()
 * Arguments:   A player's PUUID and the selected champion ID.
 * Returns:     An array of "W" or "L" for the last 10 matches played on that
 *              champion.
 * Description: Extracts the last 10 match results for the selected champion.
 * Effects:     Calls fetchMatchHistory() and fetchMatchDetails().
 */
async function getWinLossHistory(puuid, championId) {
    const matchIds = await fetchMatchHistory(puuid);
    if (!matchIds || matchIds.length === 0) {
        return ["No recent matches found."];
    }

    const results = [];
    for (let i = 0; i < matchIds.length; i++) {
        const matchId = matchIds[i];

        // Fetch match details
        const matchData = await fetchMatchDetails(matchId);
        if (!matchData?.info?.participants) continue;

        // Find the player in the match
        const player = matchData.info.participants.find(p => p.puuid === puuid);

        if (player?.championId === parseInt(championId, 10)) {
            results.push(player.win ? "W" : "L");
        }

        // Break early if we already have 10 results
        if (results.length >= 10) {
            break;
        }
    }
    return results.length ? results : ["No recent matches found."];
}

/*
 * Name:        getSelectedChampionId()
 * Arguments:   None.
 * Returns:     The champion ID if found, otherwise null.
 * Description: Retrieves the selected champion's ID based on its name.
 * Effects:     None.
 */
async function getSelectedChampionId() {
    const championName = document.getElementById("champion-input").value;
    if (!championName) {
        alert("Please select a champion.");
        return null;
    }

    // Find the correct champion based on its name
    const championsMap = await getChampionsMap();
    const championId = Object.keys(championsMap).find(key => championsMap[key] === championName);

    if (!championId) {
        alert("Error: Champion ID not found.");
    }

    return championId;
}