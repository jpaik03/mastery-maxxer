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

import { getChampIconUrl, getChampMap } from "./champData.js";
import { fetchRiotAccount, fetchAChampMastery, fetchMatchHistory, fetchMatchDetails } from "./riotApi.js";

/*
 * Initialize event listeners on DOM load
 */
document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("profile-count").addEventListener("change", updateProfileNum);
    document.getElementById("fetch-mastery").addEventListener("click", fetchAllProfilesMastery);
    updateProfileNum();
    await populateChampDropdown();
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
 * Returns:     An array of objects containing game names and taglines from existing
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
        const gameNameInput = entry.querySelector(".gameName-input");
        const tagLineInput = entry.querySelector(".tagLine-input");

        existingInputs.push({
            gameName: gameNameInput ? gameNameInput.value : "",
            tagLine: tagLineInput ? tagLineInput.value : ""
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
        <input type="text" class="gameName-input" placeholder="Game Name" value="${existingData.gameName || ""}" required />
        <label>#</label>
        <input type="text" class="tagLine-input" placeholder="Tagline" value="${existingData.tagLine || ""}" required />
    `;

    return profileDiv;
}

/*
 * Name:        getProfilesWithPUUIDs()
 * Arguments:   None.
 * Returns:     An array of objects containing gameName, tagLine, and PUUID.
 * Description: Retrieves PUUIDs for profiles that have both game name and tagline
 *              filled.
 * Effects:     Calls Riot API.
 */
async function getProfilesWithPUUIDs() {
    const profiles = [];

    for (const entry of document.querySelectorAll(".profile-entry")) {
        const gameName = entry.querySelector(".gameName-input").value.trim();
        const tagLine = entry.querySelector(".tagLine-input").value.trim();

        // Skip entries that are not fully filled in
        if (!gameName || !tagLine) {
            continue;
        }

        // Fetch account data
        const profileData = await fetchRiotAccount(gameName, tagLine);
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
 * Name:        populateChampDropdown()
 * Arguments:   None.
 * Returns:     None.
 * Description: Retrieves and fills the champion dropdown with an alphabetised
 *              list.
 * Effects:     Modifies the "champ-input" select element.
 */
async function populateChampDropdown() {
    try {
        const champDropdown = document.getElementById("champ-input");
        const champs = await getChampList();

        // Populate dropdown with sorted champion names
        champDropdown.innerHTML = `<option value="">Select a Champion</option>` + champs.map(champ => `<option value="${champ}">${champ}</option>`).join("");
    } catch (err) {
        console.error("Error fetching champions:", err);
    }
}

/*
 * Name:        getChampList()
 * Arguments:   None.
 * Returns:     An array of champion names sorted alphabetically.
 * Description: Retrieves the latest champion list from Data Dragon.
 * Effects:     Fetches champion data from Riot API.
 */
async function getChampList() {
    try {
        // Fetch champion data
        const champMap = await getChampMap();

        // Return alphabetised champion names
        return Object.values(champMap).sort();
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
    const champId = await getSelectedChampId();
    if (!champId) return;

    const profiles = await getProfilesWithPUUIDs();
    if (!profiles.length) return;

    // Update champion icon
    const champName = document.getElementById("champ-input").value;
    const champIconUrl = getChampIconUrl(champName);
    const champIcon = document.getElementById("champ-icon");

    champIcon.src = champIconUrl;
    champIcon.alt = champName;
    champIcon.style.display = "block";

    // Fetch mastery data and update table
    const masteryData = await Promise.all(profiles.map(profile => fetchAChampMastery(profile.puuid, champId)));
    updateMasteryTable(masteryData, profiles, champId);
}

/*
 * Name:        updateMasteryTable()
 * Arguments:   An array of mastery data, an array of profile data, and a champion ID.
 * Returns:     None.
 * Description: Updates the mastery table with sorted mastery points and win/loss history.
 * Effects:     Dynamically modifies the HTML table content.
 */
async function updateMasteryTable(masteryData, profiles, champId) {
    const masteryTableBody = document.getElementById("mastery-info");
    masteryTableBody.innerHTML = "";

    // Fetch win/loss history for each profile in parallel
    const winLossHistories = await Promise.all(profiles.map(profile => getWinLossHistory(profile.puuid, champId)));

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
async function getWinLossHistory(puuid, champId) {
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

        if (player?.championId === parseInt(champId, 10)) {
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
 * Name:        getSelectedChampId()
 * Arguments:   None.
 * Returns:     The champion ID if found, otherwise null.
 * Description: Retrieves the selected champion's ID based on its name.
 * Effects:     None.
 */
async function getSelectedChampId() {
    const champName = document.getElementById("champ-input").value;
    if (!champName) {
        alert("Please select a champion.");
        return null;
    }

    // Find the correct champion based on its name
    const champMap = await getChampMap();
    const champId = Object.keys(champMap).find(key => champMap[key] === champName);

    if (!champId) {
        alert("Error: Champion ID not found.");
    }

    return champId;
}