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
 * Name:        fetchRiotAccount()
 * Arguments:   Strings representing a player's username and tag.
 * Returns:     A promise resolving to an object containing Riot ID data.
 * Description: Calls the Riot API to fetch the PUUID using username and tag.
 * Effects:     None.
 */
async function fetchRiotAccount(username, tag) {
    // Call the Riot API to fetch this profile's PUUID
    try {
        const response = await fetch(`/api/account-by-riot-id?username=${encodeURIComponent(username)}&tag=${encodeURIComponent(tag)}`);
        return await response.json();
    } catch (err) {
        console.error(`Error fetching Riot ID for ${username}#${tag}:`, err);
        return { error: "Failed to fetch Riot account data" };
    }
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
 * Name:        getChampionsMap()
 * Arguments:   None.
 * Returns:     A mapping of champion IDs to their correct champion names.
 * Description: Retrieves cached champion data, refreshing if outdated.
 * Effects:     Calls Data Dragon API if necessary.
 */
async function getChampionsMap() {
    // Call helper function to call from API
    const champions = await getLatestDDragon();

    // Create and return the map
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
 * Description: Fetches champion data from Data Dragon and caches results.
 * Effects:     Calls Riot API if cached data is missing or outdated.
 */
let championJson = {}, cachedVersion = "";
async function getLatestDDragon() {
    try {
        // Get latest version
        const latestVersion = (await (await fetch("https://ddragon.leagueoflegends.com/api/versions.json")).json())[0];

        // If cache exists and version is the same, return cache
        if (championJson && (cachedVersion === latestVersion)) {
            return championJson;
        }

        // Update cache and return new version
        cachedVersion = latestVersion;
        championJson = (await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`)).json()).data;
        return championJson;
    } catch (err) {
        console.error("Error fetching from DDragon API:", err);
        return {};
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
    if (!championId) {
        return;
    }
    const profiles = await getProfilesWithPUUIDs();
    if (!profiles.length) {
        return;
    }

    // Fetch mastery data for each profile
    const masteryData = await Promise.all(profiles.map(profile => fetchAChampionMastery(profile.puuid, championId)));
    
    // Update the table with data
    updateMasteryTable(masteryData, profiles);
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

/*
 * Name:        fetchAChampionMastery()
 * Arguments:   A string representing the player's PUUID and an integer for the
 *              champion ID.
 * Returns:     Mastery data for the given champion.
 * Description: Calls the Riot API to retrieve the mastery data for the
 *              specified champion.
 * Effects:     None.
 */
async function fetchAChampionMastery(puuid, champId) {
    try {
        // Call the API the mastery info for the inputted profile and champion
        const response = await fetch(`/api/a-champion-mastery?puuid=${puuid}&championId=${champId}`);
        return await response.json();
    } catch (err) {
        console.error("Error fetching champion mastery:", err);
        return { error: "Failed to fetch mastery data" };
    }
}

/*
 * Name:        updateMasteryTable()
 * Arguments:   An array of mastery data and an array of profile data.
 * Returns:     None.
 * Description: Updates the mastery table with data sorted by mastery points in
 *              descending order.
 * Effects:     Dynamically modifies the HTML table content.
 */
function updateMasteryTable(masteryData, profiles) {
    const masteryTableBody = document.getElementById("mastery-info");
    masteryTableBody.innerHTML = "";

    // Process and sort mastery data
    masteryData
        .map((mastery, index) => ({
            profile: profiles[index],
            level: mastery?.championLevel || 0,
            points: mastery?.championPoints || 0
        }))
        // Sort in descending order
        .sort((a, b) => b.points - a.points)
        .forEach(({ profile, level, points }) => {
            masteryTableBody.innerHTML += `
                <tr>
                    <td>${profile.gameName}#${profile.tagLine}</td>
                    <td>${level}</td>
                    <td>${points}</td>
                </tr>`;
        });
}