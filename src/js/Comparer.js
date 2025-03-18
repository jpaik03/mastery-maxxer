/*
 * Handle Riot ID search form submission
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
 * Description: Updates the number of profile input fields based on the dropdown
 *              selection.
 * Effects:     Modifies the HTML to match the selected number of profiles.
 */
function updateProfileNum() {
    const profileContainer = document.getElementById("profile-container");
    const selectedCount = parseInt(document.getElementById("profile-count").value, 10);

    // Save existing input values before updating
    const existingInputs = getExistingInputs();

    // Clear existing fields
    profileContainer.innerHTML = "";

    // Add the new profile input fields
    for (let i = 1; i <= selectedCount; i++) {
        const profileDiv = createProfileInput(i, existingInputs[i - 1]);
        profileContainer.appendChild(profileDiv);
    }
}

/*
 * Name:        getExistingInputs()
 * Arguments:   None.
 * Returns:     An array of objects containing existing usernames and tags.
 * Description: Extracts the current values of the profiles before updating.
 * Effects:     None.
 */
function getExistingInputs() {
    const existingInputs = [];
    const profileEntries = document.querySelectorAll(".profile-entry");

    // Collect current entries
    for (let i = 0; i < profileEntries.length; i++) {
        const entry = profileEntries[i];
        const usernameInput = entry.querySelector(".username-input");
        const tagInput = entry.querySelector(".tag-input");

        // Store current entries
        existingInputs.push({
            username: usernameInput ? usernameInput.value : "",
            tag: tagInput ? tagInput.value : ""
        });
    }

    return existingInputs;
}

/*
 * Name:        createProfileInput()
 * Arguments:   An integer representing the profile number and an object with
 *              existing username and tag values.
 * Returns:     A <div> element containing the input fields.
 * Description: Creates a new profile input field with existing values if
 *              available.
 * Effects:     None.
 */
function createProfileInput(profileNumber, existingData = {}) {
    const profileDiv = document.createElement("div");
    profileDiv.classList.add("profile-entry");

    // Look for existing values
    const existingUsername = existingData.username || "";
    const existingTag = existingData.tag || "";

    // Update profile input fields
    profileDiv.innerHTML = `
        <label>Profile ${profileNumber}: </label>
        <input type="text" class="username-input" placeholder="Username" value="${existingUsername}" required />
        <label>#</label>
        <input type="text" class="tag-input" placeholder="Tag" value="${existingTag}" required />
    `;

    return profileDiv;
}

/*
 * Name:        handleRiotIdSubmit()
 * Arguments:   An event object from the form submission.
 * Returns:     None.
 * Description: Handles form submission, retrieves PUUIDs of each profile, and
 *              updates the UI.
 * Effects:     Calls fetchRiotAccount() to get profile data and updates
 *              profile-display.
 */
async function handleRiotIdSubmit(event) {
    event.preventDefault();

    const profileInputs = document.querySelectorAll(".profile-entry");
    const profiles = [];

    // Collect input fields in an array
    for (let i = 0; i < profileInputs.length; i++) {
        const username = profileInputs[i].querySelector(".username-input").value.trim();
        const tag = profileInputs[i].querySelector(".tag-input").value.trim();

        if (!username || !tag) {
            alert(`Please enter a valid Riot ID for Profile ${i + 1}.`);
            return;
        }
        profiles.push({ username, tag });
    }

    // Fetch account data for each profile
    const profileData = await Promise.all(profiles.map(profile => fetchRiotAccount(profile.username, profile.tag)));
    
    const validProfiles = profileData.filter(data => !data.error); 
    if (validProfiles.length === 0) {
        alert("Failed to fetch data for all profiles.");
        return;
    }

    updateProfileDisplay(validProfiles);
}

/*
 * Name:        fetchRiotAccount()
 * Arguments:   Two strings representing the player's username and tag.
 * Returns:     A promise resolving to an object containing Riot ID information.
 * Description: Calls the Riot API to fetch the PUUID using username and tag.
 * Effects:     None.
 */
async function fetchRiotAccount(username, tag) {
    try {
        const response = await fetch(`/api/account-by-riot-id?username=${encodeURIComponent(username)}&tag=${encodeURIComponent(tag)}`);
        return await response.json();
    } catch (err) {
        console.error(`Error fetching Riot ID for ${username}#${tag}:`, err);
        return { error: "Failed to fetch Riot account data" };
    }
}

/*
 * Name:        updateProfileDisplay()
 * Arguments:   An array of objects containing Riot ID information.
 * Returns:     None.
 * Description: Updates the UI to display the Riot ID names of the profiles
 *              being compared.
 * Effects:     Modifies the "profile-display" section.
 */
function updateProfileDisplay(profiles) {
    const profileDisplay = document.getElementById("profile-display");
    profileDisplay.innerHTML = profiles.map(profile => `
        <p>Riot ID: ${profile.gameName}<span>#${profile.tagLine}</span></p>
    `).join("");
}

/*
 * Name:        populateChampionDropdown()
 * Arguments:   None.
 * Returns:     None.
 * Description: Fetches champion data and fills the champion dropdown.
 * Effects:     Modifies the "champion-input" select element with champion
 *              options.
 */
async function populateChampionDropdown() {
    try {
        const championDropdown = document.getElementById("champion-input");
        const champions = await getChampionsList();

        // Clear existing options
        championDropdown.innerHTML = "";

        // Add a default option
        const defaultOption = document.createElement("option");
        defaultOption.textContent = "Select a Champion";
        defaultOption.value = "";
        championDropdown.appendChild(defaultOption);

        // Add each champion as an option
        champions.forEach(champion => {
            const option = document.createElement("option");
            option.value = champion;
            option.textContent = champion;
            championDropdown.appendChild(option);
        });
    } catch (err) {
        console.error("Error fetching champions:", err);
    }
}

/*
 * Name:        getChampionsList()
 * Arguments:   None.
 * Returns:     An array of champion names.
 * Description: Retrieves the latest champion list from Data Dragon.
 * Effects:     Fetches champion data from Riot API.
 */
async function getChampionsList() {
    try {
        // Fetch latest champion data using the optimized function
        const championsMap = await getChampionsMap();

        // Extract and return the correct champion names
        return Object.values(championsMap).sort((a, b) => a.localeCompare(b));
    } catch (err) {
        console.error("Error fetching champions:", err);
        return [];
    }
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
 * Name:        fetchAllProfilesMastery()
 * Arguments:   None.
 * Returns:     None.
 * Description: Fetches and displays mastery info for the selected champion
 *              across all entered profiles.
 * Effects:     Updates the mastery table.
 */
async function fetchAllProfilesMastery() {
    const championId = await getSelectedChampionId();
    if (!championId) return;

    const profiles = await getProfilesWithPUUIDs();
    if (!profiles.length) return;

    const masteryData = await getMasteryDataForProfiles(profiles, championId);

    updateMasteryTable(masteryData, profiles);
}

/*
 * Name:        getSelectedChampionId()
 * Arguments:   None.
 * Returns:     The champion ID if found, otherwise null.
 * Description: Fetches the selected champion’s ID from the dropdown.
 * Effects:     None.
 */
async function getSelectedChampionId() {
    const championName = document.getElementById("champion-input").value;
    if (!championName) {
        alert("Please select a champion.");
        return null;
    }

    const championsMap = await getChampionsMap();
    const championId = Object.keys(championsMap).find(key => championsMap[key] === championName);

    if (!championId) {
        alert("Error: Champion ID not found.");
        return null;
    }

    return championId;
}

/*
 * Name:        getProfilesWithPUUIDs()
 * Arguments:   None.
 * Returns:     An array of profile objects with gameName, tagLine, and PUUID.
 * Description: Fetches PUUIDs for all entered profiles. Ignores incomplete entries.
 * Effects:     Calls Riot API.
 */
async function getProfilesWithPUUIDs() {
    const profileEntries = document.querySelectorAll(".profile-entry");
    const profiles = [];

    for (const entry of profileEntries) {
        const username = entry.querySelector(".username-input").value.trim();
        const tag = entry.querySelector(".tag-input").value.trim();

        // Skip empty entries (only process if both fields are filled)
        if (!username || !tag) {
            continue;
        }

        const profileData = await fetchRiotAccount(username, tag);
        if (profileData.error) {
            console.error(`Failed to fetch data for ${username}#${tag}. Skipping.`);
            continue;
        }

        profiles.push({
            gameName: profileData.gameName,
            tagLine: profileData.tagLine,
            puuid: profileData.puuid
        });
    }

    return profiles;
}

/*
 * Name:        getMasteryDataForProfiles()
 * Arguments:   An array of profile objects and a champion ID.
 * Returns:     An array of mastery data objects.
 * Description: Fetches champion mastery data for all profiles.
 * Effects:     Calls Riot API.
 */
async function getMasteryDataForProfiles(profiles, championId) {
    return await Promise.all(profiles.map(profile => fetchAChampionMastery(profile.puuid, championId)));
}

/*
 * Name:        fetchAChampionMastery()
 * Arguments:   A string representing the player's unique identifier (PUUID)
 *              and an integer for the champion ID.
 * Returns:     Mastery data for the given champion.
 * Description: Calls the Riot API to retrieve the mastery data for the given
 *              champion and PUUID.
 * Effects:     None.
 */
async function fetchAChampionMastery(puuid, champId) {
    try {
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
 * Description: Populates the mastery table with champion mastery data for each
 *              profile, sorted by mastery points in descending order.
 * Effects:     Updates the HTML table dynamically.
 */
function updateMasteryTable(masteryData, profiles) {
    const masteryTableBody = document.getElementById("mastery-info");
    masteryTableBody.innerHTML = "";

    // Combine masteryData with profiles to maintain correct association
    const combinedData = masteryData.map((mastery, index) => ({
        profile: profiles[index],
        championLevel: mastery?.championLevel || 0,
        championPoints: mastery?.championPoints || 0,
        marksRequired: mastery?.markRequiredForNextLevel || 0,
        tokensEarned: mastery?.tokensEarned || 0
    }));

    // Sort by champion points in descending order
    combinedData.sort((a, b) => b.championPoints - a.championPoints);

    // Populate table
    combinedData.forEach(({ profile, championLevel, championPoints, marksRequired, tokensEarned }) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${profile.gameName}#${profile.tagLine}</td>
            <td>${championLevel}</td>
            <td>${championPoints}</td>
            <td>${marksRequired}</td>
            <td>${tokensEarned}</td>
        `;
        masteryTableBody.appendChild(row);
    });
}