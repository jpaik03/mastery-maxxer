/*
 *  MasteryOverflow.js
 *  Justin Paik
 *  Created: 16 March 2025
 *  Last Updated: 27 May 2025 
 *  Riot API Mastery Overflow
 *
 *  This script handles fetching champion mastery data for a given Riot ID. It
 *  processes user input for Riot ID, retrieves account and mastery info,
 *  formats and displays it in a UI table, and includes logic to compute mastery
 *  overflow and limiting factors.
 */

import { getChampionIconUrl, getChampionsMap } from "./champData.js";
import { fetchRiotAccount, fetchMasteryData } from "./riotAPI.js";

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
    const username = document.getElementById("username-input")?.value.trim() || "";
    const tag = document.getElementById("tag-input")?.value.trim() || "";

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
        const masteryData = await fetchMasteryData(puuid);
        if (masteryData.error) {
            alert("Error: " + masteryData.error);
            return;
        }

        const championsMap = await getChampionsMap();
        const masteryTableBody = document.getElementById("mastery-info");
        masteryTableBody.innerHTML = "";

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
 * Returns:     A table row element representing a champion's mastery info row.
 * Description: Extracts relevant champion mastery data and formats it into a
 *              table row.
 * Effects:     None.
 */
function formatMasteryRow(champion, championsMap) {
    const championId = champion.championId;
    const championName = championsMap[championId] || "Champion not found";
    const championIconUrl = getChampionIconUrl(championName);
    const championLevel = champion.championLevel;
    const championPoints = champion.championPoints;
    const pointsNeeded = championPoints + champion.championPointsUntilNextLevel;
    const marksEarned = champion.tokensEarned;
    const marksRequiredForNextLevel = champion.markRequiredForNextLevel;
    const nextSeasonMilestone = champion.nextSeasonMilestone;
    const numGamesReq = nextSeasonMilestone?.totalGamesRequires || "";
    const gradeReq = getGradeReq(nextSeasonMilestone);
    const rewardText = getRewardText(nextSeasonMilestone?.rewardMarks);
    const overflowData = getMasteryOverflow([champion])[0];
    const limitingFactor = overflowData.limitingFactor;

    const gradeColor = getGradeColor(gradeReq);
    const limitingColor = getLimitingColor(limitingFactor);

    const row = document.createElement("tr");
    row.innerHTML = `
        <td><img src="${championIconUrl}" alt="${championName}" class="champion-icon"></td>
        <td>${championLevel}</td>
        <td>${championPoints}<span style="color:#999999">/${pointsNeeded}</span></td>
        <td>${marksEarned}<span style="color:#999999">/${marksRequiredForNextLevel}</span></td>
        <td style="color:${gradeColor}">${numGamesReq} ${gradeReq} earns ${rewardText}</td>
        <td style="color:${limitingColor}">${limitingFactor}</td>
    `;
    
    return row;
}

/*
 * Name:        getRewardText()
 * Arguments:   An integer representing marks needed for the next level.
 * Returns:     A string describing the marks needed.
 * Description: Formats marks into a string.
 * Effects:     None.
 */
function getRewardText(nextReward) {
    if (!nextReward) return "";
    return nextReward === 1 ? "1 mark" : `${nextReward} marks`;
}

/*
 * Name:        getGradeReq()
 * Arguments:   An object containing milestone info.
 * Returns:     A string representing the grade requirement ("S-" or "A-") for
 *              the next level.
 * Description: Extracts the grade requirement from the milestone data.
 * Effects:     None.
 */
function getGradeReq(nextSeasonMilestone) {
    if (!nextSeasonMilestone) return "";
    return nextSeasonMilestone.requireGradeCounts?.["S-"] ? "S-" : "A-";
}

/*
 * Name:        getGradeColor()
 * Arguments:   A string representing the grade requirement for the next level.
 * Returns:     A string representing a color for the grade text.
 * Description: Returns red color for "S-" grade, black for others.
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
    if (!limitingFactor) return "#000000";
    return limitingFactor.includes("mark") && !limitingFactor.includes("point") ? "#FF0000" : "#000000";
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
        const { championPoints, championLevel, tokensEarned, championPointsUntilNextLevel } = champion;

        // Determine max reachable level based on current mastery points
        const maxLevelByPoints = getMaxLevelByPoints(championPoints, championLevel);
        // Calculate marks needed to reach new level
        const marksNeeded = Math.max(0, calculateMarksNeeded(championLevel, maxLevelByPoints) - tokensEarned);

        // Determine max reachable level based on current marks
        const maxLevelByMarks = getMaxLevelByMarks(tokensEarned, championLevel);
        // Calculate points needed to reach new level
        const pointsNeeded = Math.max(0, calculatePointsNeeded(championLevel, maxLevelByMarks) - championPoints);

        let limitingFactor = 'Maxed';
        if (championPointsUntilNextLevel > 0 && marksNeeded > 0) {
            limitingFactor = `${marksNeeded} mark${marksNeeded !== 1 ? 's' : ''} AND ${pointsNeeded} points`;
        } else if (marksNeeded > 0) {
            limitingFactor = `${marksNeeded} mark${marksNeeded !== 1 ? 's' : ''}`;
        } else if (championPointsUntilNextLevel > 0) {
            limitingFactor = `${pointsNeeded} points`;
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
function getMaxLevelByPoints(championPoints, championLevel) {
    let maxLevel = championLevel;
    while (championPoints >= getLevelInfo(maxLevel + 1).points) {
        maxLevel++;
    }
    return maxLevel;
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
function calculateMarksNeeded(currentLevel, maxLevel) {
    let totalMarks = 0;
    for (let lvl = currentLevel + 1; lvl <= maxLevel + 1; lvl++) {
        totalMarks += getLevelInfo(lvl).marks;
    }
    return totalMarks;
}

/*
 * Name:        getMaxLevelByMarks()
 * Arguments:   An integer representing a champion's marks and level.
 * Returns:     The maximum level the champion can reach with current marks.
 * Description: Determines the highest mastery level the champion can instantly
 *              reach based on marks.
 * Effects:     None.
 */
function getMaxLevelByMarks(tokensEarned, championLevel) {
    let maxLevel = championLevel;

    while (tokensEarned >= getLevelInfo(maxLevel + 1).marks) {
        tokensEarned -= getLevelInfo(maxLevel + 1).marks;
        maxLevel++;
    }

    return maxLevel;
}

/*
 * Name:        calculatePointsNeeded()
 * Arguments:   An integer representing a champion's current mastery level and
 *              potential level.
 * Returns:     The total number of points needed to advance from the current to
 *              the potential level.
 * Description: Finds the required points from the current level to the highest
 *              reachable level.
 * Effects:     None.
 */
function calculatePointsNeeded(currentLevel, maxLevel) {
    let totalPoints = 0;
    for (let lvl = currentLevel + 1; lvl <= maxLevel + 1; lvl++) {
        totalPoints = getLevelInfo(lvl).points;
    }
    return totalPoints;
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