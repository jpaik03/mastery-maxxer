/*
 *  MasteryMaxxer.js
 *  Justin Paik
 *  Created: 16 March 2025
 *  Last Updated: 28 May 2025 
 *  Riot API Mastery Maxxer
 *
 *  This script handles fetching champion mastery data for a given Riot ID. It
 *  processes user input for Riot ID, retrieves account and mastery info,
 *  formats and displays it in a UI table, and includes logic to compute mastery
 *  overflow and limiting factors.
 */

import { getChampIconUrl, getChampMap } from "./champData.js";
import { fetchRiotAccount, fetchMasteryData } from "./riotApi.js";

/*
 * Handle Riot ID search form submission
 */
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("riot-id").addEventListener("submit", handleRiotIdSubmit);
});

/*
 * Name:        handleRiotIdSubmit()
 * Arguments:   An event object from the form submission.
 * Returns:     None.
 * Description: Handles form submission, retrieves PUUID, and triggers mastery
 *              data fetching.
 *              Handles user input for Riot ID, fetches the corresponding PUUID
 *              using the Riot API, updates the UI, and fetches mastery data.
 * Effects:     Calls fetchRiotAccount() to get mastery data. Updates UI with
 *              retrieved Riot ID and calls fetchMasteryInfo().
 */
let puuid = "";
async function handleRiotIdSubmit(event) {
    event.preventDefault();
    // Get input values and trim whitespace
    const gameName = document.getElementById("gameName-input")?.value.trim() || "";
    const tagLine = document.getElementById("tagLine-input")?.value.trim() || "";

    // Show alert if either field is empty
    if (!gameName || !tagLine) {
        alert("Please enter your Riot ID.");
        return;
    }

    try {
        // Get corresponding PUUID using the Riot API
        const data = await fetchRiotAccount(gameName, tagLine);
        if (data.error) {
            alert("Error: " + data.error);
            return;
        }
        puuid = data.puuid;
        // Update the UI with the user's Riot ID
        updateRiotIdUI(data);
        // Fetch and display the mastery information
        fetchMasteryInfo(puuid);
    } catch (err) {
        console.error("Error fetching Riot account:", err);
        alert("Error fetching Riot account.");
    }
}

/*
 * Name:        updateRiotIdUI()
 * Arguments:   An object containing Riot ID information.
 * Returns:     None.
 * Description: Updates the UI to display the Riot ID.
 * Effects:     Modifies HTML elements to show retrieved data.
 */
function updateRiotIdUI(data) {
    document.getElementById("display-gameName").textContent = data.gameName;
    document.getElementById("display-tagLine").textContent = `#${data.tagLine}`;
}

/*
 * Name:        fetchMasteryInfo()
 * Arguments:   A string representing the player's unique identifier (PUUID).
 * Returns:     None.
 * Description: Fetches mastery data for the given PUUID, maps champion IDs to
 *              names, and updates the table with the mastery details.
 * Effects:     Updates the inner HTML of the "mastery-info" table.
 */
async function fetchMasteryInfo(puuid) {
    try {
        // Fetch mastery data from the Riot API
        const masteryData = await fetchMasteryData(puuid);
        if (masteryData.error) {
            alert("Error: " + masteryData.error);
            return;
        }

        // Retrieve champion name map
        const champMap = await getChampMap();
        // Get the table body element and clear previous entries
        const masteryTableBody = document.getElementById("mastery-info");
        masteryTableBody.innerHTML = "";

        // Format and insert each mastery row into the table
        masteryData.forEach(champ => {
            const masteryRow = formatMasteryRow(champ, champMap);
            masteryTableBody.appendChild(masteryRow);
        });
    } catch (err) {
        console.error("Error fetching mastery data:", err);
        alert("Error fetching mastery data.");
    }
}

/*
 * Name:        formatMasteryRow()
 * Arguments:   A champion object and a map of champion IDs to names.
 * Returns:     A table row element representing a champion's mastery info row.
 * Description: Extracts relevant champion mastery data and formats it into a
 *              table row.
 * Effects:     None.
 */
function formatMasteryRow(champ, champMap) {
    const champId = champ.championId;
    const champName = champMap[champId] || "Champion not found";
    const champIconUrl = getChampIconUrl(champName);
    const currLevel = champ.championLevel;
    const currPoints = champ.championPoints;
    const pointsForNextLevel = currPoints + champ.championPointsUntilNextLevel;
    const currMarks = champ.tokensEarned;
    const marksForNextLevel = champ.markRequiredForNextLevel;
    const nextMilestone = champ.nextSeasonMilestone;
    const numGamesReq = nextMilestone?.totalGamesRequires || "";
    const gradeReq = getGradeReq(nextMilestone);
    const rewardText = getRewardText(nextMilestone?.rewardMarks);
    const progressDetails = getProgressDetails([champ])[0];
    const limitingFactor = progressDetails.limitingFactor;

    const gradeColor = getGradeColor(gradeReq);
    const limitingColor = getLimitingColor(limitingFactor);

    const masteryRow = document.createElement("tr");
    masteryRow.innerHTML = `
        <td><img src="${champIconUrl}" alt="${champName}" class="champ-icon"></td>
        <td>${currLevel}</td>
        <td>${currPoints}<span style="color:#999999">/${pointsForNextLevel}</span></td>
        <td>${currMarks}<span style="color:#999999">/${marksForNextLevel}</span></td>
        <td style="color:${gradeColor}">${numGamesReq} ${gradeReq} earns ${rewardText}</td>
        <td style="color:${limitingColor}">${limitingFactor}</td>
    `;
    
    return masteryRow;
}

/*
 * Name:        getRewardText()
 * Arguments:   An integer representing marks needed for the next level.
 * Returns:     A string describing the marks needed.
 * Description: Formats the number of marks into a string.
 * Effects:     None.
 */
function getRewardText(nextReward) {
    if (!nextReward) {
        return "";
    }
    return nextReward === 1 ? "1 mark" : `${nextReward} marks`;
}

/*
 * Name:        getGradeReq()
 * Arguments:   Milestone data containing grade requirements for marks.
 * Returns:     A string representing the grade requirement ("S-" or "A-") for
 *              the next level.
 * Description: Extracts the grade requirement from the milestone data.
 * Effects:     None.
 */
function getGradeReq(nextMilestone) {
    if (!nextMilestone) {
        return "";
    }
    return nextMilestone.requireGradeCounts?.["S-"] ? "S-" : "A-";
}

/*
 * Name:        getGradeColor()
 * Arguments:   A string representing the grade requirement for the next level.
 * Returns:     A string representing a color for the grade text.
 * Description: Returns red color for "S-" grade, else black.
 * Effects:     None.
 */
function getGradeColor(gradeReq) {
    return gradeReq === "S-" ? "#FF0000" : "#000000";
}

/*
 * Name:        getLimitingColor()
 * Arguments:   A string describing the limiting factor to reach the next level.
 * Returns:     A string representing a color for the limiting factor text.
 * Description: Returns red if limiting factor is only marks, else black.
 * Effects:     None.
 */
function getLimitingColor(limitingFactor) {
    if (!limitingFactor) {
        return "#000000";
    }
    return limitingFactor.includes("mark") && !limitingFactor.includes("point") ? "#FF0000" : "#000000";
}

/*
 * Name:        getProgressDetails()
 * Arguments:   A list of champion mastery objects with fields: championPoints,
 *              championLevel, and tokensEarned.
 * Returns:     An array of champions with the number of games needed to
 *              reach the potential mastery level.
 * Description: Compares current points and marks to determine the limiting
 *              factor to progress to the next level for each champion.
 * Effects:     None.
 */
function getProgressDetails(masteryData) {
    return masteryData.map(champ => {
        const { championPoints, championLevel, tokensEarned } = champ;

        // Determine max reachable level based on current mastery points
        const maxLevelByPoints = getMaxLevelByPoints(championPoints, championLevel);
        // Calculate marks needed to reach new level
        let marksNeeded = Math.max(0, calculateMarksNeeded(championLevel, maxLevelByPoints) - tokensEarned);

        // Determine max reachable level based on current marks
        const maxLevelByMarks = getMaxLevelByMarks(tokensEarned, championLevel);
        // Calculate points needed to reach new level
        let pointsNeeded = Math.max(0, getLevelInfo(maxLevelByMarks).points - championPoints);

        let limitingFactor = '';

        if (maxLevelByMarks > maxLevelByPoints) {
            limitingFactor = `${pointsNeeded} points`;
        } else if (maxLevelByPoints > maxLevelByMarks) {
            limitingFactor = `${marksNeeded} mark${marksNeeded !== 1 ? 's' : ''}`;
        } else {
            marksNeeded = getLevelInfo(championLevel + 1).marks - tokensEarned;
            pointsNeeded = getLevelInfo(championLevel + 1).points - championPoints;
            limitingFactor = `${marksNeeded} mark${marksNeeded !== 1 ? 's' : ''} AND ${pointsNeeded} points`;
        }

        return {
            limitingFactor
        };
    });
}

/*
 * Name:        getMaxLevelByPoints()
 * Arguments:   An integer representing a champion's mastery points and level.
 * Returns:     The maximum level the champion can reach with current points.
 * Description: Determines the highest mastery level the champion can instantly
 *              reach based on points.
 * Effects:     None.
 */
function getMaxLevelByPoints(currPoints, currLevel) {
    let maxLevel = currLevel;
    while (currPoints >= getLevelInfo(maxLevel + 1).points) {
        maxLevel++;
    }
    return maxLevel;
}

/*
 * Name:        calculateMarksNeeded()
 * Arguments:   An integer representing the current mastery level and highest
 *              potental level by points of a champion.
 * Returns:     The total number of marks needed to advance from the current to
 *              the potential level.
 * Description: Calculates the cumulative marks needed to go from the current
 *              level to the potential level by adding marginal marks.
 * Effects:     None.
 */
function calculateMarksNeeded(currentLevel, maxLevel) {
    let marksNeeded = 0;
    for (let lvl = currentLevel + 1; lvl <= maxLevel; lvl++) {
        marksNeeded += getLevelInfo(lvl).marks;
    }
    return marksNeeded;
}

/*
 * Name:        getMaxLevelByMarks()
 * Arguments:   An integer representing a champion's marks and level.
 * Returns:     The maximum level the champion can reach with current marks.
 * Description: Determines the highest mastery level the champion can instantly
 *              reach based on marks.
 * Effects:     None.
 */
function getMaxLevelByMarks(tokensEarned, currLevel) {
    let maxLevel = currLevel;
    while (tokensEarned >= getLevelInfo(maxLevel + 1).marks) {
        tokensEarned -= getLevelInfo(maxLevel + 1).marks;
        maxLevel++;
    }
    return maxLevel;
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