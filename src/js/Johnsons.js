/*
 *  Johnsons.js
 *  Justin Paik, Owen Jin
 *  Created: 16 March 2025
 *  Last Updated: 27 August 2026
 *  Client-side controller for Johnsons dashboard
 *
 *  This module coordinates player roster profile fetches, populates summary
 *  and flex tables, formats rank/mastery metrics, and handles interactive
 *  sorting for winrate and ping leaderboards.
 */

/* MODULE IMPORTS */

import {
    fetchRiotAccountByPuuid,
    fetchSummonerData,
    fetchRankedData,
    fetchMasteryData,
    fetchRosterRankedStats,
    fetchChampionLeaderboard,
    fetchRoleLeaderboard,
    fetchDuoLeaderboard,
    syncRankedQueues,
    syncAndFetchPlayerPeaks,
} from "./riotAPI.js";
import { getChampMap, getChampIconUrl } from "./champData.js";

/* CONSTANTS & CONFIGURATION */

const PLAYERS = [
    {
        name: "Aileen",
        puuid: "wUX2hh9YBwf66OZjsn6SauURG6dyrYsBklTqHvMv6f-EMlcKH87g_lds17PEVnbEd26gsJOwQQB1kg",
    },
    {
        name: "Anthony",
        puuid: "VTe2huNS57BFU3WuCefKyC_cqGjkExvB4enPSS4R5YXKXru5jFCdMPz_3HtirYPs8AqFjnalrQO95w",
    },
    {
        name: "Josh",
        puuid: "G6MhoNnrm8HYJ87lfJTEIoggCPb2_3Mr68Eh2OJGJeio972UwKnbzkDZUDxHcQZOoJz5rJbtWUMRlQ",
    },
    {
        name: "Justin",
        puuid: "81RQTX37Hxdj7i9V4UTljdySmsyj82OuiExAEOze3XohGnyUGR9etyTnjLohw87p9U-QjxMmONbEcg",
    },
    {
        name: "Mateo",
        puuid: "fSOoEFLuNqQlp7gY8RFUTQ2LnJpV3LcnapcRp1RDtn_CrLbaTM2bPsCzcic74Kk_QfeDjfwKHVtVsg",
    },
    {
        name: "Max",
        puuid: "TV09seitjrdYEiKToxrCA7rh_GN_wir_j_yZ3fmRS4Al1zpERQ6pvHzIy5dqqdDsRGyuk4DfoIDpsg",
    },
    {
        name: "Meileen",
        puuid: "6cwqYAckOFIdB4qJoFEvKohj9zIG_HveDYMSaOJx4oNndYnbygmKvbZSbMfrPww6xYbTYUrFNy4zkQ",
    },
    {
        name: "Owen",
        puuid: "9pLcWyTNsCHIA6GtYarC4ZKV02JDXyWPGY8fTzQKQ06oqgAMJ17_C2CAGrM5HvGiWBFqiH5U1GYyqg",
    },
    {
        name: "Sam",
        puuid: "5-1YXAqBrJ9JtM311w5RQRBDwyr0AWf2k-m9OouPheTZNuAPbB6MsKN-EncpjlWm2G98mX-WDdrOBA",
    },
    {
        name: "Shrihan",
        puuid: "S3-ROibvQqYney-A0xvuYXH4J8mO1_-ZWU0I20ZKNw452ioyJlrg5ZLrcf2tNWLPFAkQsPsvIMbRUw",
    },
];

const TIER_ORDER = {
    IRON: 0,
    BRONZE: 1,
    SILVER: 2,
    GOLD: 3,
    PLATINUM: 4,
    EMERALD: 5,
    DIAMOND: 6,
    MASTER: 7,
    GRANDMASTER: 8,
    CHALLENGER: 9,
};

const DIV_ORDER = { IV: 0, III: 1, II: 2, I: 3 };

const TIER_ABBREVIATIONS = {
    IRON: "I",
    BRONZE: "B",
    SILVER: "S",
    GOLD: "G",
    PLATINUM: "P",
    EMERALD: "E",
    DIAMOND: "D",
    MASTER: "Master",
    GRANDMASTER: "GM",
    CHALLENGER: "Challenger",
};

const DIVISION_NUMBERS = { I: "1", II: "2", III: "3", IV: "4" };

const PING_KEYS = [
    "allIn",
    "assistMe",
    "basic",
    "danger",
    "enemyMissing",
    "enemyVision",
    "getBack",
    "needVision",
    "onMyWay",
    "push",
];

const PROFILE_TABLE_ROW_IDS = [
    "row-name",
    "row-player",
    "row-level",
    "row-solo",
    "row-peak-solo",
    "row-peak-solo-games",
    "row-top10",
];

/* STATE MANAGEMENT */

let profileLeaderboardData = [];
let currentProfileSortKey = "soloScore";
let currentProfileSortAsc = false;

let fivesLeaderboardData = [];
let fivesLeaderboardMode = "wr";
let currentFivesSortKey = "name";
let currentFivesSortAsc = true;

let flexLeaderboardData = [];
let flexLeaderboardMode = "wr";
let currentFlexSortKey = "name";
let currentFlexSortAsc = true;

let championMap = {};
let totalChampionCount = 0;
let sortedChampionList = [];
let championNameToIdMap = {};
let championLeaderboardData = [];
let currentChampionSortKey = "wr";
let currentChampionSortAsc = false;
let championShowAllGames = false;
let championVisibleCount = 10;
let championIsShowAllExpanded = false;

let roleLeaderboardData = [];
let currentRoleSortKey = "wr";
let currentRoleSortAsc = false;
let roleShowAllGames = false;
let roleVisibleCount = 10;
let roleIsShowAllExpanded = false;
let selectedRole = null;

let duoLeaderboardData = [];
let currentDuoSortKey = "wr";
let currentDuoSortAsc = false;
let duoShowAllGames = false;
let duoVisibleCount = 10;
let duoIsShowAllExpanded = false;
let duoSelectedPuuid = null;

let pingsLeaderboardData = [];
let pingsDisplayMode = "avg";
let currentPingSortKey = "total";
let currentPingSortAsc = false;

/* FORMATTING & CALCULATION HELPERS */

// Generate HTML image tag for tier rank badge
function getRankIconImg(tier) {
    if (!tier) return "";
    const formattedTier =
        tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
    return `<img src="/images/icons_rank/Rank_${formattedTier}.png" alt="${tier}" class="rank-icon" />`;
}

// Format tier, division, LP, and icon for table cells
function formatRank(entry) {
    if (!entry || !entry.tier) return "Unranked";

    const tierShort =
        TIER_ABBREVIATIONS[entry.tier.toUpperCase()] || entry.tier;
    const isApex = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(
        entry.tier.toUpperCase(),
    );
    const icon = getRankIconImg(entry.tier);

    const rankText = isApex
        ? `${tierShort} ${entry.leaguePoints} LP`
        : `${tierShort}${DIVISION_NUMBERS[entry.rank] || entry.rank || ""} ${entry.leaguePoints} LP`;

    return `<span class="rank-cell-content">${icon}<span>${rankText}</span></span>`;
}

// Format peak seasonal rank with year tag and games played breakdown
function formatPeakDisplay(peak) {
    if (!peak || !peak.tier) return { rankText: "Unranked", gamesText: "0" };

    const currentYear = new Date().getFullYear();
    const isCurrentYear = peak.year === currentYear;
    const yearFormatted = isCurrentYear
        ? `<strong>(${peak.year})</strong>`
        : `(${peak.year})`;

    const tierShort = TIER_ABBREVIATIONS[peak.tier.toUpperCase()] || peak.tier;
    const isApex = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(
        peak.tier.toUpperCase(),
    );
    const icon = getRankIconImg(peak.tier);

    const rankText = isApex
        ? `${tierShort} ${peak.lp} LP`
        : `${tierShort}${DIVISION_NUMBERS[peak.rank] || peak.rank || ""} ${peak.lp} LP`;

    return {
        rankText: `<span class="rank-cell-content">${icon}<span>${rankText} ${yearFormatted}</span></span>`,
        gamesText: `${peak.games || 0} (${peak.wins || 0}W ${peak.losses || 0}L)`,
    };
}

// Convert champion points into standard K/M suffix notation
function formatPoints(pts) {
    if (pts >= 1_000_000) return (pts / 1_000_000).toFixed(2) + "M";
    return (pts / 1000).toFixed(1) + "K";
}

// Calculate sortable numeric score for a tier and division
function getRankScore(entry) {
    if (!entry || !entry.tier) return -1;
    const tierVal = (TIER_ORDER[entry.tier.toUpperCase()] ?? 0) * 10000;
    const divVal = (DIV_ORDER[entry.rank] ?? 0) * 100;
    const lpVal = entry.leaguePoints ?? 0;
    return tierVal + divVal + lpVal;
}

// Compare two values or objects for sorting with secondary name tie-breaker
function compareValues(a, b, key, isAscending) {
    const valA = key && typeof a === "object" && a !== null ? a[key] : a;
    const valB = key && typeof b === "object" && b !== null ? b[key] : b;

    if (typeof valA === "string" && typeof valB === "string") {
        const cmp = valA.localeCompare(valB);
        if (cmp !== 0) return isAscending ? cmp : -cmp;
    } else {
        const numA = typeof valA === "number" ? valA : 0;
        const numB = typeof valB === "number" ? valB : 0;
        const diff = numA - numB;
        if (diff !== 0) return isAscending ? diff : -diff;
    }

    // Secondary tie-breaker: sort alphabetically by player name if objects
    const nameA = a?.name || "";
    const nameB = b?.name || "";
    return nameA.localeCompare(nameB);
}

// Parse float winrate from formatted role cell string
function parseWinrate(statStr) {
    if (!statStr || statStr === "0") return -1;
    const match = statStr.match(/\(([\d.]+)%\)/);
    return match ? parseFloat(match[1]) : -1;
}

// Parse integer game count from formatted role cell string
function parseGamesCount(statStr) {
    if (!statStr || statStr === "0") return 0;
    const match = statStr.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

// Return a soft highlight CSS class based on win rate threshold
function getWinrateHighlightClass(wr, games) {
    if (!games || games === 0 || wr < 0) return "";
    if (wr > 50) return "wr-positive";
    if (wr < 50) return "wr-negative";
    return "";
}

// Resolve active column sort key based on current winrate vs games view mode for 5s
function getResolvedFivesSortKey(key) {
    const roleMap = {
        top: fivesLeaderboardMode === "games" ? "topGames" : "topWr",
        jgl: fivesLeaderboardMode === "games" ? "jglGames" : "jglWr",
        mid: fivesLeaderboardMode === "games" ? "midGames" : "midWr",
        bot: fivesLeaderboardMode === "games" ? "botGames" : "botWr",
        sup: fivesLeaderboardMode === "games" ? "supGames" : "supWr",
        total: fivesLeaderboardMode === "games" ? "totalGames" : "totalWr",
    };
    return roleMap[key] || key;
}

// Resolve active column sort key based on current winrate vs games view mode for Flex
function getResolvedFlexSortKey(key) {
    const roleMap = {
        top: flexLeaderboardMode === "games" ? "topGames" : "topWr",
        jgl: flexLeaderboardMode === "games" ? "jglGames" : "jglWr",
        mid: flexLeaderboardMode === "games" ? "midGames" : "midWr",
        bot: flexLeaderboardMode === "games" ? "botGames" : "botWr",
        sup: flexLeaderboardMode === "games" ? "supGames" : "supWr",
        total: flexLeaderboardMode === "games" ? "totalGames" : "totalWr",
    };
    return roleMap[key] || key;
}

// Format a numeric ping count or average value
function formatPingValue(num, isTotalMode) {
    return isTotalMode ? Math.round(num).toLocaleString() : num.toFixed(1);
}

/* HTML BUILDERS & DATA MAPPERS */

// Build top 10 mastery icon and level HTML snippet
function buildTop10MasteryHtml(masteries) {
    return (masteries || [])
        .slice(0, 10)
        .map((m) => {
            const champName =
                championMap[m.championId] || `Champ ${m.championId}`;
            const champIconUrl = getChampIconUrl(champName);
            const pts = formatPoints(m.championPoints);
            return `<div class="top10-item"><img src="${champIconUrl}" alt="${champName}" title="${champName}" data-champ-id="${m.championId}" class="top10-champ-icon" /><span>${pts} (${m.championLevel})</span></div>`;
        })
        .join("");
}

// Generate an HTML table row for the general profile leaderboard
function buildProfileLeaderboardRowHtml(p) {
    return `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.soloHtml}</td>
            <td>${p.masteryText}</td>
            <td>${p.level}</td>
            <td>${p.playedChampsCount}</td>
        </tr>
    `;
}

// Generate an HTML table row for the S26 Ranked 5s role leaderboard
function buildFivesLeaderboardRowHtml(p) {
    return `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.fivesHtml}</td>
            <td class="${getWinrateHighlightClass(p.topWr, p.topGames)}">${p.topText}</td>
            <td class="${getWinrateHighlightClass(p.jglWr, p.jglGames)}">${p.jglText}</td>
            <td class="${getWinrateHighlightClass(p.midWr, p.midGames)}">${p.midText}</td>
            <td class="${getWinrateHighlightClass(p.botWr, p.botGames)}">${p.botText}</td>
            <td class="${getWinrateHighlightClass(p.supWr, p.supGames)}">${p.supText}</td>
            <td class="${getWinrateHighlightClass(p.totalWr, p.totalGames)}">${p.totalText}</td>
        </tr>
    `;
}

// Generate an HTML table row for the S26 Flex role leaderboard
function buildFlexLeaderboardRowHtml(p) {
    return `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.flexHtml}</td>
            <td class="${getWinrateHighlightClass(p.topWr, p.topGames)}">${p.topText}</td>
            <td class="${getWinrateHighlightClass(p.jglWr, p.jglGames)}">${p.jglText}</td>
            <td class="${getWinrateHighlightClass(p.midWr, p.midGames)}">${p.midText}</td>
            <td class="${getWinrateHighlightClass(p.botWr, p.botGames)}">${p.botText}</td>
            <td class="${getWinrateHighlightClass(p.supWr, p.supGames)}">${p.supText}</td>
            <td class="${getWinrateHighlightClass(p.totalWr, p.totalGames)}">${p.totalText}</td>
        </tr>
    `;
}

// Return highlight CSS class based on KDA ratio threshold
function getKdaHighlightClass(kdaRatio, games) {
    if (!games || games === 0) return "";
    if (kdaRatio > 1.0) return "wr-positive";
    if (kdaRatio < 1.0) return "wr-negative";
    return "";
}

// Generate an HTML table row for the champion-specific leaderboard
function buildChampionLeaderboardRowHtml(player) {
    const wrClass = getWinrateHighlightClass(player.winRate, player.games);
    const kdaClass = getKdaHighlightClass(player.kdaRatio, player.games);
    const kdaRatioText =
        player.deaths === 0 && (player.kills > 0 || player.assists > 0)
            ? "Perfect"
            : player.kdaRatio.toFixed(2);
    const kdaDisplay = `${player.avgKills.toFixed(1)}/${player.avgDeaths.toFixed(1)}/${player.avgAssists.toFixed(1)} (${kdaRatioText})`;

    return `
        <tr>
            <td><strong>${player.displayRank}</strong></td>
            <td><strong>${player.name}</strong></td>
            <td>${player.games}</td>
            <td>${player.wins}-${player.losses}</td>
            <td class="${wrClass}">${player.games > 0 ? `${player.winRate.toFixed(1)}%` : "—"}</td>
            <td class="${kdaClass}">${player.games > 0 ? kdaDisplay : "—"}</td>
        </tr>
    `;
}

// Generate an HTML table row for the pings leaderboard
function buildPingRowHtml(p, isTotalMode) {
    const src = isTotalMode ? p.raw : p.avg;
    const totalText = isTotalMode
        ? `${formatPingValue(src.total, true)} (${p.gamesCount})`
        : formatPingValue(src.total, false);

    return `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td>${formatPingValue(src.allIn, isTotalMode)}</td>
            <td>${formatPingValue(src.assistMe, isTotalMode)}</td>
            <td>${formatPingValue(src.basic, isTotalMode)}</td>
            <td>${formatPingValue(src.danger, isTotalMode)}</td>
            <td>${formatPingValue(src.enemyMissing, isTotalMode)}</td>
            <td>${formatPingValue(src.enemyVision, isTotalMode)}</td>
            <td>${formatPingValue(src.getBack, isTotalMode)}</td>
            <td>${formatPingValue(src.needVision, isTotalMode)}</td>
            <td>${formatPingValue(src.onMyWay, isTotalMode)}</td>
            <td>${formatPingValue(src.push, isTotalMode)}</td>
            <td><strong>${totalText}</strong></td>
        </tr>
    `;
}

// Build leaderboard row object containing sortable and display fields for 5s
function buildFivesLeaderboardEntry(player, fives, fivesStats) {
    return {
        name: player.name,
        fivesScore: getRankScore(fives),
        fivesHtml: formatRank(fives),
        topWr: parseWinrate(fivesStats.TOP),
        topGames: parseGamesCount(fivesStats.TOP),
        topText: fivesStats.TOP || "0",
        jglWr: parseWinrate(fivesStats.JGL),
        jglGames: parseGamesCount(fivesStats.JGL),
        jglText: fivesStats.JGL || "0",
        midWr: parseWinrate(fivesStats.MID),
        midGames: parseGamesCount(fivesStats.MID),
        midText: fivesStats.MID || "0",
        botWr: parseWinrate(fivesStats.BOT),
        botGames: parseGamesCount(fivesStats.BOT),
        botText: fivesStats.BOT || "0",
        supWr: parseWinrate(fivesStats.SUP),
        supGames: parseGamesCount(fivesStats.SUP),
        supText: fivesStats.SUP || "0",
        totalWr: parseWinrate(fivesStats.TOTAL),
        totalGames: parseGamesCount(fivesStats.TOTAL),
        totalText: fivesStats.TOTAL || "0",
    };
}

// Build leaderboard row object containing sortable and display fields for Flex
function buildFlexLeaderboardEntry(player, flex, flexStats) {
    return {
        name: player.name,
        flexScore: getRankScore(flex),
        flexHtml: formatRank(flex),
        topWr: parseWinrate(flexStats.TOP),
        topGames: parseGamesCount(flexStats.TOP),
        topText: flexStats.TOP || "0",
        jglWr: parseWinrate(flexStats.JGL),
        jglGames: parseGamesCount(flexStats.JGL),
        jglText: flexStats.JGL || "0",
        midWr: parseWinrate(flexStats.MID),
        midGames: parseGamesCount(flexStats.MID),
        midText: flexStats.MID || "0",
        botWr: parseWinrate(flexStats.BOT),
        botGames: parseGamesCount(flexStats.BOT),
        botText: flexStats.BOT || "0",
        supWr: parseWinrate(flexStats.SUP),
        supGames: parseGamesCount(flexStats.SUP),
        supText: flexStats.SUP || "0",
        totalWr: parseWinrate(flexStats.TOTAL),
        totalGames: parseGamesCount(flexStats.TOTAL),
        totalText: flexStats.TOTAL || "0",
    };
}

// Build normalized ping data bundle for average and total views across Flex and 5s
function buildPingsLeaderboardEntry(player, flexStats, rankedFivesStats) {
    const flexPings = flexStats.rawPings || {};
    const fivesPings = rankedFivesStats?.rawPings || {};

    const rawTotals = {};
    let grandTotal = 0;

    PING_KEYS.forEach((key) => {
        const count = (flexPings[key] || 0) + (fivesPings[key] || 0);
        rawTotals[key] = count;
        grandTotal += count;
    });
    rawTotals.total = grandTotal;

    const totalGames =
        (flexStats.storedMatchCount || 0) +
        (rankedFivesStats?.storedMatchCount || 0);

    const avg = {};
    PING_KEYS.forEach((key) => {
        avg[key] = totalGames > 0 ? rawTotals[key] / totalGames : 0;
    });
    avg.total = totalGames > 0 ? rawTotals.total / totalGames : 0;

    return {
        name: player.name,
        gamesCount: totalGames,
        avg,
        raw: rawTotals,
    };
}

// Extract and parse queue entries from ranked API response
function extractQueueEntries(rankedData) {
    const rankedList = Array.isArray(rankedData) ? rankedData : [];
    return {
        solo: rankedList.find((r) => r.queueType === "RANKED_SOLO_5x5"),
        flex: rankedList.find((r) => r.queueType === "RANKED_FLEX_SR"),
        fives: rankedList.find((r) => r.queueType === "RANKED_PREMADE_5x5"),
    };
}

// Compute total mastery points, levels, and played champion counts
function summarizeMasteryData(masteries) {
    const masteryList = Array.isArray(masteries) ? masteries : [];
    const totalPoints = masteryList.reduce(
        (sum, m) => sum + m.championPoints,
        0,
    );
    const totalMasteryLevel = masteryList.reduce(
        (sum, m) => sum + m.championLevel,
        0,
    );

    return {
        masteryList,
        totalPoints,
        totalPointsText: `${totalPoints.toLocaleString()} (${totalMasteryLevel})`,
        playedChampsCount: masteryList.filter((m) => m.championLevel > 0)
            .length,
        top10Text: buildTop10MasteryHtml(masteryList),
    };
}

/* DOM TABLE MUTATIONS & RENDERING */

// Clear dynamically generated column cells from profile tables
function clearProfileTables() {
    PROFILE_TABLE_ROW_IDS.forEach((rowId) => {
        const tr = document.getElementById(rowId);
        if (tr) {
            while (tr.children.length > 1) {
                tr.removeChild(tr.lastChild);
            }
        }
    });
}

// Append player column cells to Profile Summary
function appendProfileTableColumns(profileData) {
    const { name, account, summoner, soloText, top10Text, soloPeak } =
        profileData;

    // Profile Summary Table
    document
        .getElementById("row-name")
        .insertAdjacentHTML("beforeend", `<td><strong>${name}</strong></td>`);
    document
        .getElementById("row-player")
        .insertAdjacentHTML(
            "beforeend",
            `<td>${account.gameName}#${account.tagLine}</td>`,
        );
    document
        .getElementById("row-level")
        .insertAdjacentHTML("beforeend", `<td>${summoner.summonerLevel}</td>`);
    document
        .getElementById("row-solo")
        .insertAdjacentHTML("beforeend", `<td>${soloText}</td>`);
    document
        .getElementById("row-peak-solo")
        .insertAdjacentHTML("beforeend", `<td>${soloPeak.rankText}</td>`);
    document
        .getElementById("row-peak-solo-games")
        .insertAdjacentHTML("beforeend", `<td>${soloPeak.gamesText}</td>`);
    document
        .getElementById("row-top10")
        .insertAdjacentHTML("beforeend", `<td>${top10Text}</td>`);
}

// Update sorting arrow indicators on table header elements
function updateHeaderSortArrows(tableSelector, activeSortKey, isAscending) {
    document
        .querySelectorAll(`${tableSelector} th[data-sort]`)
        .forEach((th) => {
            const arrow = th.querySelector(".sort-arrow");
            if (arrow) {
                arrow.textContent =
                    th.getAttribute("data-sort") === activeSortKey
                        ? isAscending
                            ? " ▲"
                            : " ▼"
                        : "";
            }
        });
}

// Render profile summary leaderboard table
function renderProfileLeaderboard() {
    const tbody = document.getElementById("leaderboard-body");
    if (!tbody) return;

    profileLeaderboardData.sort((a, b) =>
        compareValues(a, b, currentProfileSortKey, currentProfileSortAsc),
    );

    tbody.innerHTML = profileLeaderboardData
        .map(buildProfileLeaderboardRowHtml)
        .join("");
    updateHeaderSortArrows(
        "#leaderboard",
        currentProfileSortKey,
        currentProfileSortAsc,
    );
}

// Render S26 Ranked 5s role winrate leaderboard table
function renderFivesLeaderboard() {
    const tbody = document.getElementById("fives-leaderboard-body");
    if (!tbody) return;

    const activeSortKey = getResolvedFivesSortKey(currentFivesSortKey);
    fivesLeaderboardData.sort((a, b) =>
        compareValues(a, b, activeSortKey, currentFivesSortAsc),
    );

    tbody.innerHTML = fivesLeaderboardData
        .map(buildFivesLeaderboardRowHtml)
        .join("");
    updateHeaderSortArrows(
        "#fives-leaderboard",
        currentFivesSortKey,
        currentFivesSortAsc,
    );
}

// Render S26 Flex role winrate leaderboard table
function renderFlexLeaderboard() {
    const tbody = document.getElementById("flex-leaderboard-body");
    if (!tbody) return;

    const activeSortKey = getResolvedFlexSortKey(currentFlexSortKey);
    flexLeaderboardData.sort((a, b) =>
        compareValues(a, b, activeSortKey, currentFlexSortAsc),
    );

    tbody.innerHTML = flexLeaderboardData
        .map(buildFlexLeaderboardRowHtml)
        .join("");
    updateHeaderSortArrows(
        "#flex-leaderboard",
        currentFlexSortKey,
        currentFlexSortAsc,
    );
}

// Render filtered list of champion options for custom dropdown
function renderChampionDropdownOptions(filterText = "") {
    const dropdown = document.getElementById("champion-dropdown");
    if (!dropdown) return;

    const cleanFilter = filterText.replace(/['’]/g, "").toLowerCase().trim();
    const filtered = sortedChampionList.filter(({ name }) => {
        const cleanName = name.replace(/['’]/g, "").toLowerCase();
        return cleanName.includes(cleanFilter);
    });

    if (filtered.length === 0) {
        dropdown.innerHTML = `<div class="custom-select-option" style="color: #888; cursor: default;">No champions</div>`;
        return;
    }

    dropdown.innerHTML = filtered
        .map(
            ({ id, name }) =>
                `<div class="custom-select-option" data-id="${id}" data-name="${name}">${name}</div>`,
        )
        .join("");
}

// Render champion-specific winrate/games leaderboard table
function renderChampionLeaderboard() {
    const tbody = document.getElementById("champion-leaderboard-body");
    if (!tbody) return;

    const filteredPlayers = championLeaderboardData.filter((player) => {
        if (player.games === 0) return false;
        if (championShowAllGames) return true;
        return player.games >= 3;
    });

    if (filteredPlayers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding: 10px; color: #888;">No games recorded on this champion.</td></tr>`;
        updateHeaderSortArrows(
            "#champion-leaderboard",
            currentChampionSortKey,
            currentChampionSortAsc,
        );
        return;
    }

    // Calculate permanent ranks based strictly on Win Rate (descending)
    const rankedPlayers = [...filteredPlayers].sort((a, b) => {
        const diff = b.winRate - a.winRate;
        if (diff !== 0) return diff;
        const gamesDiff = b.games - a.games;
        if (gamesDiff !== 0) return gamesDiff;
        return a.name.localeCompare(b.name);
    });

    let currentRank = 1;
    const playersWithPermanentRanks = rankedPlayers.map((p, index) => {
        if (index > 0) {
            const prev = rankedPlayers[index - 1];
            if (p.winRate !== prev.winRate || p.games !== prev.games) {
                currentRank = index + 1;
            }
        }
        return { ...p, displayRank: currentRank };
    });

    // Sort rows based on the active table column
    const sortedPlayers = [...playersWithPermanentRanks].sort((a, b) => {
        if (currentChampionSortKey === "player") {
            const cmp = a.name.localeCompare(b.name);
            if (cmp !== 0) return currentChampionSortAsc ? cmp : -cmp;
            const wrDiff = b.winRate - a.winRate;
            if (wrDiff !== 0) return wrDiff;
            return b.games - a.games;
        } else if (currentChampionSortKey === "games") {
            const diff = a.games - b.games;
            if (diff !== 0) return currentChampionSortAsc ? diff : -diff;
            const wrDiff = a.winRate - b.winRate;
            if (wrDiff !== 0) return -wrDiff;
        } else if (currentChampionSortKey === "kda") {
            const diff = a.kdaRatio - b.kdaRatio;
            if (diff !== 0) return currentChampionSortAsc ? diff : -diff;
            const wrDiff = a.winRate - b.winRate;
            if (wrDiff !== 0) return -wrDiff;
        } else if (currentChampionSortKey === "rank") {
            const diff = a.displayRank - b.displayRank;
            if (diff !== 0) return currentChampionSortAsc ? diff : -diff;
        } else {
            // "wr" and "wl"
            const diff = a.winRate - b.winRate;
            if (diff !== 0) return currentChampionSortAsc ? diff : -diff;
            const gamesDiff = a.games - b.games;
            if (gamesDiff !== 0) return -gamesDiff;
        }

        return a.name.localeCompare(b.name);
    });

    const effectiveLimit = championIsShowAllExpanded
        ? sortedPlayers.length
        : championVisibleCount;
    const visiblePlayers = sortedPlayers.slice(0, effectiveLimit);

    let rowsHtml = visiblePlayers.map(buildChampionLeaderboardRowHtml).join("");

    if (sortedPlayers.length > 10) {
        if (championIsShowAllExpanded) {
            rowsHtml += `
                <tr id="champion-action-row" class="table-action-row">
                    <td colspan="6">
                        <span id="champion-show-less-btn" class="duo-action-btn">
                            <strong>Show top 10 only ▲</strong>
                        </span>
                    </td>
                </tr>
            `;
        } else if (sortedPlayers.length > championVisibleCount) {
            const remaining = sortedPlayers.length - championVisibleCount;
            const nextBatchSize = Math.min(10, remaining);
            rowsHtml += `
                <tr id="champion-action-row" class="table-action-row">
                    <td colspan="6">
                        <span id="champion-show-more-btn" class="duo-action-btn">
                            <strong>Show ${nextBatchSize} more (${remaining} remaining) ▼</strong>
                        </span>
                        <span class="duo-action-separator">|</span>
                        <span id="champion-show-all-btn" class="duo-action-btn">
                            <strong>Show all (${sortedPlayers.length})</strong>
                        </span>
                    </td>
                </tr>
            `;
        }
    }

    tbody.innerHTML = rowsHtml;
    updateHeaderSortArrows(
        "#champion-leaderboard",
        currentChampionSortKey,
        currentChampionSortAsc,
    );
}

// Render filtered list of player options for duo custom dropdown
function renderDuoPlayerDropdownOptions(filterText = "") {
    const dropdown = document.getElementById("duo-player-dropdown");
    if (!dropdown) return;

    const cleanFilter = filterText.toLowerCase().trim();
    const filtered = PLAYERS.filter(({ name }) =>
        name.toLowerCase().includes(cleanFilter),
    );

    let html = `<div class="custom-select-option" data-puuid="">All players</div>`;

    if (filtered.length === 0) {
        html += `<div class="custom-select-option" style="color: #888; cursor: default;">No players found</div>`;
    } else {
        html += filtered
            .map(
                ({ puuid, name }) =>
                    `<div class="custom-select-option" data-puuid="${puuid}" data-name="${name}">${name}</div>`,
            )
            .join("");
    }

    dropdown.innerHTML = html;
}

// Render ADC-Support pairings leaderboard
function renderDuoLeaderboard() {
    const tbody = document.getElementById("duo-leaderboard-body");
    if (!tbody) return;

    const puuidToName = Object.fromEntries(
        PLAYERS.map((p) => [p.puuid, p.name]),
    );

    const filteredDuos = duoLeaderboardData.filter((d) => {
        if (d.games === 0) return false;
        if (
            duoSelectedPuuid &&
            d.botPuuid !== duoSelectedPuuid &&
            d.supPuuid !== duoSelectedPuuid
        ) {
            return false;
        }
        if (duoShowAllGames) return true;
        return d.games >= 5;
    });

    if (filteredDuos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding: 10px; color: #888;">No bot lane duos found with >= 5 games.</td></tr>`;
        updateHeaderSortArrows(
            "#duo-leaderboard",
            currentDuoSortKey,
            currentDuoSortAsc,
        );
        return;
    }

    // Calculate permanent ranks based strictly on Win Rate (descending)
    const rankedDuos = [...filteredDuos].sort((a, b) => {
        const diff = b.winRate - a.winRate;
        if (diff !== 0) return diff;
        const gamesDiff = b.games - a.games;
        if (gamesDiff !== 0) return gamesDiff;
        const nameA = `${puuidToName[a.botPuuid] || "Unknown"} + ${puuidToName[a.supPuuid] || "Unknown"}`;
        const nameB = `${puuidToName[b.botPuuid] || "Unknown"} + ${puuidToName[b.supPuuid] || "Unknown"}`;
        return nameA.localeCompare(nameB);
    });

    let currentRank = 1;
    const duosWithPermanentRanks = rankedDuos.map((d, index) => {
        if (index > 0) {
            const prev = rankedDuos[index - 1];
            if (d.winRate !== prev.winRate || d.games !== prev.games) {
                currentRank = index + 1;
            }
        }
        return { ...d, displayRank: currentRank };
    });

    // Sort rows based on the active table column
    const sortedDuos = [...duosWithPermanentRanks].sort((a, b) => {
        const botNameA = puuidToName[a.botPuuid] || "Unknown";
        const botNameB = puuidToName[b.botPuuid] || "Unknown";
        const supNameA = puuidToName[a.supPuuid] || "Unknown";
        const supNameB = puuidToName[b.supPuuid] || "Unknown";

        if (currentDuoSortKey === "bot") {
            const cmp = botNameA.localeCompare(botNameB);
            if (cmp !== 0) return currentDuoSortAsc ? cmp : -cmp;
            const wrDiff = b.winRate - a.winRate;
            if (wrDiff !== 0) return wrDiff;
            const gamesDiff = b.games - a.games;
            if (gamesDiff !== 0) return gamesDiff;
            return supNameA.localeCompare(supNameB);
        } else if (currentDuoSortKey === "sup") {
            const cmp = supNameA.localeCompare(supNameB);
            if (cmp !== 0) return currentDuoSortAsc ? cmp : -cmp;
            const wrDiff = b.winRate - a.winRate;
            if (wrDiff !== 0) return wrDiff;
            const gamesDiff = b.games - a.games;
            if (gamesDiff !== 0) return gamesDiff;
            return botNameA.localeCompare(botNameB);
        } else if (currentDuoSortKey === "games") {
            const diff = a.games - b.games;
            if (diff !== 0) return currentDuoSortAsc ? diff : -diff;
            const wrDiff = a.winRate - b.winRate;
            if (wrDiff !== 0) return -wrDiff;
        } else if (currentDuoSortKey === "rank") {
            const diff = a.displayRank - b.displayRank;
            if (diff !== 0) return currentDuoSortAsc ? diff : -diff;
        } else {
            // "wr" and "wl"
            const diff = a.winRate - b.winRate;
            if (diff !== 0) return currentDuoSortAsc ? diff : -diff;
            const gamesDiff = a.games - b.games;
            if (gamesDiff !== 0) return -gamesDiff;
        }

        const nameA = `${botNameA} + ${supNameA}`;
        const nameB = `${botNameB} + ${supNameB}`;
        return nameA.localeCompare(nameB);
    });

    const effectiveLimit = duoIsShowAllExpanded
        ? sortedDuos.length
        : duoVisibleCount;
    const visibleDuos = sortedDuos.slice(0, effectiveLimit);

    let rowsHtml = visibleDuos
        .map((d) => {
            const botName = puuidToName[d.botPuuid] || "Unknown";
            const supName = puuidToName[d.supPuuid] || "Unknown";
            const wrClass = getWinrateHighlightClass(d.winRate, d.games);

            return `
                <tr>
                    <td><strong>${d.displayRank}</strong></td>
                    <td><strong>${botName}</strong></td>
                    <td><strong>${supName}</strong></td>
                    <td>${d.games}</td>
                    <td>${d.wins}-${d.losses}</td>
                    <td class="${wrClass}">${d.games > 0 ? `${d.winRate.toFixed(1)}%` : "—"}</td>
                </tr>
            `;
        })
        .join("");

    if (sortedDuos.length > 10) {
        if (duoIsShowAllExpanded) {
            rowsHtml += `
                <tr id="duo-action-row" class="table-action-row">
                    <td colspan="6">
                        <span id="duo-show-less-btn" class="duo-action-btn">
                            <strong>Show top 10 only ▲</strong>
                        </span>
                    </td>
                </tr>
            `;
        } else if (sortedDuos.length > duoVisibleCount) {
            const remaining = sortedDuos.length - duoVisibleCount;
            const nextBatchSize = Math.min(10, remaining);
            rowsHtml += `
                <tr id="duo-action-row" class="table-action-row">
                    <td colspan="6">
                        <span id="duo-show-more-btn" class="duo-action-btn">
                            <strong>Show ${nextBatchSize} more (${remaining} remaining) ▼</strong>
                        </span>
                        <span class="duo-action-separator">|</span>
                        <span id="duo-show-all-btn" class="duo-action-btn">
                            <strong>Show all (${sortedDuos.length})</strong>
                        </span>
                    </td>
                </tr>
            `;
        }
    }

    tbody.innerHTML = rowsHtml;
    updateHeaderSortArrows(
        "#duo-leaderboard",
        currentDuoSortKey,
        currentDuoSortAsc,
    );
}

// Render pings leaderboard table (average or total count view)
function renderPingsLeaderboard() {
    const tbody = document.getElementById("pings-leaderboard-body");
    if (!tbody) return;

    const isTotalMode = pingsDisplayMode === "total";

    pingsLeaderboardData.sort((a, b) => {
        const valA =
            currentPingSortKey === "name"
                ? a.name
                : isTotalMode
                  ? a.raw[currentPingSortKey]
                  : a.avg[currentPingSortKey];
        const valB =
            currentPingSortKey === "name"
                ? b.name
                : isTotalMode
                  ? b.raw[currentPingSortKey]
                  : b.avg[currentPingSortKey];

        // Pass resolved values with player objects for name tie-breaking
        return compareValues(
            { ...a, _sortVal: valA },
            { ...b, _sortVal: valB },
            "_sortVal",
            currentPingSortAsc,
        );
    });

    tbody.innerHTML = pingsLeaderboardData
        .map((p) => buildPingRowHtml(p, isTotalMode))
        .join("");

    const totalHeader = document.getElementById("pings-total-header");
    if (totalHeader) {
        const arrowSpan =
            totalHeader.querySelector(".sort-arrow")?.outerHTML ||
            '<span class="sort-arrow"></span>';
        totalHeader.innerHTML = `${isTotalMode ? "Total Pings" : "Total Avg"}${arrowSpan}`;
    }

    updateHeaderSortArrows(
        "#pings-leaderboard",
        currentPingSortKey,
        currentPingSortAsc,
    );
}

/* EVENT HANDLERS & DOM BINDINGS */

// Bind view toggle button listeners
function setupViewToggle() {
    const profilesBtn = document.getElementById("tab-profiles-btn");
    const rankedBtn = document.getElementById("tab-ranked-btn");
    const profilesView = document.getElementById("view-profiles");
    const rankedView = document.getElementById("view-ranked");

    if (!profilesBtn || !rankedBtn || !profilesView || !rankedView) return;

    profilesBtn.addEventListener("click", () => {
        profilesBtn.classList.add("active");
        rankedBtn.classList.remove("active");
        profilesView.style.display = "block";
        rankedView.style.display = "none";
    });

    rankedBtn.addEventListener("click", () => {
        rankedBtn.classList.add("active");
        profilesBtn.classList.remove("active");
        rankedView.style.display = "block";
        profilesView.style.display = "none";
    });
}

// Bind event listeners for profile leaderboard column headers
function setupProfileLeaderboardSorting() {
    document.querySelectorAll("#leaderboard th[data-sort]").forEach((th) => {
        th.addEventListener("click", () => {
            const sortKey = th.getAttribute("data-sort");
            if (currentProfileSortKey === sortKey) {
                currentProfileSortAsc = !currentProfileSortAsc;
            } else {
                currentProfileSortKey = sortKey;
                currentProfileSortAsc = false;
            }
            renderProfileLeaderboard();
        });
    });
}

// Bind shared sort by mode select for both Ranked 5s and Flex tables
function setupSharedRankedSorting() {
    const sharedSelect = document.getElementById("ranked-shared-mode-select");
    if (sharedSelect) {
        sharedSelect.addEventListener("change", (e) => {
            fivesLeaderboardMode = e.target.value;
            flexLeaderboardMode = e.target.value;
            renderFivesLeaderboard();
            renderFlexLeaderboard();
        });
    }
}

// Bind event listeners for 5s leaderboard column headers
function setupFivesLeaderboardSorting() {
    document
        .querySelectorAll("#fives-leaderboard th[data-sort]")
        .forEach((th) => {
            th.addEventListener("click", () => {
                const sortKey = th.getAttribute("data-sort");
                if (currentFivesSortKey === sortKey) {
                    currentFivesSortAsc = !currentFivesSortAsc;
                } else {
                    currentFivesSortKey = sortKey;
                    currentFivesSortAsc = sortKey === "name";
                }
                renderFivesLeaderboard();
            });
        });
}

// Bind event listeners for flex leaderboard column headers
function setupFlexLeaderboardSorting() {
    document
        .querySelectorAll("#flex-leaderboard th[data-sort]")
        .forEach((th) => {
            th.addEventListener("click", () => {
                const sortKey = th.getAttribute("data-sort");
                if (currentFlexSortKey === sortKey) {
                    currentFlexSortAsc = !currentFlexSortAsc;
                } else {
                    currentFlexSortKey = sortKey;
                    currentFlexSortAsc = sortKey === "name";
                }
                renderFlexLeaderboard();
            });
        });
}

// Bind event listeners for custom champion searchable dropdown & table sorting
function setupChampionLeaderboard() {
    const container = document.getElementById("champ-select-container");
    const searchInput = document.getElementById("champion-search");
    const dropdown = document.getElementById("champion-dropdown");
    const tbody = document.getElementById("champion-leaderboard-body");

    const showAllCb = document.getElementById("champion-show-all-cb");
    showAllCb?.addEventListener("change", (e) => {
        championShowAllGames = e.target.checked;
        championVisibleCount = 10;
        championIsShowAllExpanded = false;
        renderChampionLeaderboard();
    });

    searchInput?.addEventListener("focus", () => {
        renderChampionDropdownOptions(searchInput.value);
        dropdown?.classList.add("open");
        searchInput.select();
    });

    searchInput?.addEventListener("input", () => {
        renderChampionDropdownOptions(searchInput.value);
        dropdown?.classList.add("open");
        championVisibleCount = 10;
        championIsShowAllExpanded = false;
        loadChampionLeaderboard();
    });

    // Use mousedown to capture selection before input blur events fire
    dropdown?.addEventListener("mousedown", (e) => {
        const option = e.target.closest(".custom-select-option");
        if (!option || !option.dataset.id) return;

        e.preventDefault();
        const championId = option.dataset.id;
        searchInput.value = "";
        dropdown.classList.remove("open");
        searchInput.blur();
        championVisibleCount = 10;
        championIsShowAllExpanded = false;
        loadChampionLeaderboard(championId);
    });

    document.addEventListener("mousedown", (e) => {
        if (!container?.contains(e.target)) {
            dropdown?.classList.remove("open");
        }
    });

    document
        .querySelectorAll("#champion-leaderboard th[data-sort]")
        .forEach((th) => {
            th.addEventListener("click", () => {
                const sortKey = th.getAttribute("data-sort");
                if (currentChampionSortKey === sortKey) {
                    currentChampionSortAsc = !currentChampionSortAsc;
                } else {
                    currentChampionSortKey = sortKey;
                    currentChampionSortAsc = ["rank", "player"].includes(
                        sortKey,
                    );
                }
                renderChampionLeaderboard();
            });
        });

    tbody?.addEventListener("click", (e) => {
        if (e.target.closest("#champion-show-more-btn")) {
            championVisibleCount += 10;
            renderChampionLeaderboard();
        } else if (e.target.closest("#champion-show-all-btn")) {
            championIsShowAllExpanded = true;
            renderChampionLeaderboard();
        } else if (e.target.closest("#champion-show-less-btn")) {
            championIsShowAllExpanded = false;
            championVisibleCount = 10;
            renderChampionLeaderboard();
        }
    });
}

// Setup event listeners for duo leaderboard
function setupDuoLeaderboard() {
    const container = document.getElementById("duo-player-select-container");
    const searchInput = document.getElementById("duo-player-search");
    const dropdown = document.getElementById("duo-player-dropdown");
    const showAllCb = document.getElementById("duo-show-all-cb");
    const tbody = document.getElementById("duo-leaderboard-body");

    searchInput?.addEventListener("focus", () => {
        renderDuoPlayerDropdownOptions(searchInput.value);
        dropdown?.classList.add("open");
        searchInput.select();
    });

    searchInput?.addEventListener("input", () => {
        renderDuoPlayerDropdownOptions(searchInput.value);
        dropdown?.classList.add("open");
        const query = searchInput.value.trim().toLowerCase();
        const matched = PLAYERS.find((p) => p.name.toLowerCase() === query);
        duoSelectedPuuid = matched
            ? matched.puuid
            : query === ""
              ? null
              : duoSelectedPuuid;
        renderDuoLeaderboard();
    });

    dropdown?.addEventListener("mousedown", (e) => {
        const option = e.target.closest(".custom-select-option");
        if (!option) return;

        e.preventDefault();
        const puuid = option.dataset.puuid || null;
        const name = option.dataset.name || "";

        duoSelectedPuuid = puuid;
        searchInput.value = name;
        dropdown.classList.remove("open");
        searchInput.blur();
        renderDuoLeaderboard();
    });

    document.addEventListener("mousedown", (e) => {
        if (!container?.contains(e.target)) {
            dropdown?.classList.remove("open");
        }
    });

    document
        .querySelectorAll("#duo-leaderboard th[data-sort]")
        .forEach((th) => {
            th.addEventListener("click", () => {
                const sortKey = th.getAttribute("data-sort");
                if (currentDuoSortKey === sortKey) {
                    currentDuoSortAsc = !currentDuoSortAsc;
                } else {
                    currentDuoSortKey = sortKey;
                    currentDuoSortAsc = ["rank", "bot", "sup"].includes(
                        sortKey,
                    );
                }
                renderDuoLeaderboard();
            });
        });

    showAllCb?.addEventListener("change", (e) => {
        duoShowAllGames = e.target.checked;
        duoVisibleCount = 10;
        duoIsShowAllExpanded = false;
        renderDuoLeaderboard();
    });

    tbody?.addEventListener("click", (e) => {
        if (e.target.closest("#duo-show-more-btn")) {
            duoVisibleCount += 10;
            renderDuoLeaderboard();
        } else if (e.target.closest("#duo-show-all-btn")) {
            duoIsShowAllExpanded = true;
            renderDuoLeaderboard();
        } else if (e.target.closest("#duo-show-less-btn")) {
            duoIsShowAllExpanded = false;
            duoVisibleCount = 10;
            renderDuoLeaderboard();
        }
    });
}

// Bind event listeners for ping leaderboard column headers and view toggles
function setupPingsLeaderboardSorting() {
    document
        .querySelectorAll("#pings-leaderboard th[data-sort]")
        .forEach((th) => {
            th.addEventListener("click", () => {
                const sortKey = th.getAttribute("data-sort");
                if (currentPingSortKey === sortKey) {
                    currentPingSortAsc = !currentPingSortAsc;
                } else {
                    currentPingSortKey = sortKey;
                    currentPingSortAsc = false;
                }
                renderPingsLeaderboard();
            });
        });

    const modeSelect = document.getElementById("pings-mode-select");
    if (modeSelect) {
        modeSelect.addEventListener("change", (e) => {
            pingsDisplayMode = e.target.value;
            renderPingsLeaderboard();
        });
    }
}

// Bind hover listeners for champion mastery icon highlighting
function setupChampIconHighlighting() {
    const table = document.getElementById("profile-summary");
    if (!table) return;

    table.addEventListener("mouseover", (e) => {
        const target = e.target.closest(".top10-champ-icon");
        if (!target) return;

        const champId = target.dataset.champId;
        if (!champId) return;

        document
            .querySelectorAll(`.top10-champ-icon[data-champ-id="${champId}"]`)
            .forEach((el) => {
                el.classList.add("champ-highlighted");
            });
    });

    table.addEventListener("mouseout", (e) => {
        const target = e.target.closest(".top10-champ-icon");
        if (!target) return;

        const champId = target.dataset.champId;
        if (!champId) return;

        document
            .querySelectorAll(`.top10-champ-icon[data-champ-id="${champId}"]`)
            .forEach((el) => {
                el.classList.remove("champ-highlighted");
            });
    });
}

/* DATA FETCHING & PIPELINE */

// Fetch and cache champion metadata
async function initChampionData() {
    if (Object.keys(championMap).length === 0) {
        championMap = await getChampMap();
        totalChampionCount = Object.keys(championMap).length;

        const headerEl = document.getElementById("header-champs");
        if (headerEl) {
            headerEl.innerHTML = `Mastery Champions (out of ${totalChampionCount})<span class="sort-arrow"></span>`;
        }

        // Sort names ignoring apostrophes and special characters
        const sortedChamps = Object.entries(championMap).sort(
            ([, nameA], [, nameB]) => {
                const cleanA = nameA.replace(/['’]/g, "").toLowerCase();
                const cleanB = nameB.replace(/['’]/g, "").toLowerCase();
                return cleanA.localeCompare(cleanB);
            },
        );

        championNameToIdMap = {};
        sortedChampionList = sortedChamps.map(([id, name]) => {
            championNameToIdMap[name.toLowerCase()] = id;
            return { id, name };
        });

        const searchInput = document.getElementById("champion-search");
        if (searchInput) {
            searchInput.value = "";
        }

        renderChampionDropdownOptions();
    }
}

// Query aggregate champion statistics across the roster and populate leaderboard
async function loadChampionLeaderboard(explicitChampionId = null) {
    const searchInput = document.getElementById("champion-search");
    const iconContainer = document.getElementById("champion-icon-container");

    const query = searchInput?.value?.trim().toLowerCase();
    const championId = explicitChampionId || championNameToIdMap[query];

    if (!championId) return;

    // Update champion icon display
    if (iconContainer) {
        const champName = championMap[championId];
        const iconUrl = getChampIconUrl(champName);
        iconContainer.innerHTML = `<img src="${iconUrl}" alt="${champName}" title="${champName}" id="champion-selected-icon" />`;
    }

    try {
        const result = await fetchChampionLeaderboard(championId);
        const statsByPuuid = new Map(
            (result.players || []).map((player) => [player.puuid, player]),
        );

        championLeaderboardData = PLAYERS.map((player) => {
            const playerStats = statsByPuuid.get(player.puuid);
            return {
                name: player.name,
                puuid: player.puuid,
                wins: playerStats?.wins || 0,
                losses: playerStats?.losses || 0,
                games: playerStats?.games || 0,
                winRate: playerStats?.winRate || 0,
                kills: playerStats?.kills || 0,
                deaths: playerStats?.deaths || 0,
                assists: playerStats?.assists || 0,
                avgKills: playerStats?.avgKills || 0,
                avgDeaths: playerStats?.avgDeaths || 0,
                avgAssists: playerStats?.avgAssists || 0,
                kdaRatio: playerStats?.kdaRatio || 0,
            };
        });

        renderChampionLeaderboard();
    } catch (error) {
        console.error(error);
    }
}

// Map short role keys to position icon assets
const ROLE_ICON_MAP = {
    TOP: "/images/icons_position/Position_Top.png",
    JGL: "/images/icons_position/Position_Jungle.png",
    MID: "/images/icons_position/Position_Middle.png",
    BOT: "/images/icons_position/Position_Bottom.png",
    SUP: "/images/icons_position/Position_Support.png",
};

// Generate an HTML table row for the role-specific leaderboard
function buildRoleLeaderboardRowHtml(player) {
    const wrClass = getWinrateHighlightClass(player.winRate, player.games);
    const kdaClass = getKdaHighlightClass(player.kdaRatio, player.games);
    const kdaRatioText =
        player.deaths === 0 && (player.kills > 0 || player.assists > 0)
            ? "Perfect"
            : player.kdaRatio.toFixed(2);
    const kdaDisplay = `${player.avgKills.toFixed(1)}/${player.avgDeaths.toFixed(1)}/${player.avgAssists.toFixed(1)} (${kdaRatioText})`;
    const csDisplay = player.games > 0 ? player.csPerMin.toFixed(1) : "—";

    const topChampsHtml =
        (player.topChamps || []).length > 0
            ? `<div class="role-top-champs-cell">${player.topChamps
                  .map((c) => {
                      const champName =
                          championMap[c.championId] ||
                          c.championName ||
                          `Champ ${c.championId}`;
                      const iconUrl = getChampIconUrl(champName);
                      return `<img src="${iconUrl}" alt="${champName}" title="${champName}: ${c.games}G (${c.winRate.toFixed(0)}% WR)" class="top10-champ-icon" />`;
                  })
                  .join("")}</div>`
            : "—";

    return `
        <tr>
            <td><strong>${player.displayRank}</strong></td>
            <td><strong>${player.name}</strong></td>
            <td>${player.games}</td>
            <td>${player.wins}-${player.losses}</td>
            <td class="${wrClass}">${player.games > 0 ? `${player.winRate.toFixed(1)}%` : "—"}</td>
            <td class="${kdaClass}">${player.games > 0 ? kdaDisplay : "—"}</td>
            <td>${csDisplay}</td>
            <td>${topChampsHtml}</td>
        </tr>
    `;
}

// Render role-specific winrate leaderboard table
function renderRoleLeaderboard() {
    const tbody = document.getElementById("role-leaderboard-body");
    if (!tbody) return;

    if (!selectedRole) {
        tbody.innerHTML = "";
        updateHeaderSortArrows(
            "#role-leaderboard",
            currentRoleSortKey,
            currentRoleSortAsc,
        );
        return;
    }

    const filteredPlayers = roleLeaderboardData.filter((player) => {
        if (player.games === 0) return false;
        if (roleShowAllGames) return true;
        return player.games >= 5;
    });

    if (filteredPlayers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="padding: 10px; color: #888;">No games recorded in this role with >= 5 games.</td></tr>`;
        updateHeaderSortArrows(
            "#role-leaderboard",
            currentRoleSortKey,
            currentRoleSortAsc,
        );
        return;
    }

    // Calculate permanent ranks based strictly on Win Rate (descending)
    const rankedPlayers = [...filteredPlayers].sort((a, b) => {
        const diff = b.winRate - a.winRate;
        if (diff !== 0) return diff;
        const gamesDiff = b.games - a.games;
        if (gamesDiff !== 0) return gamesDiff;
        return a.name.localeCompare(b.name);
    });

    let currentRank = 1;
    const playersWithPermanentRanks = rankedPlayers.map((p, index) => {
        if (index > 0) {
            const prev = rankedPlayers[index - 1];
            if (p.winRate !== prev.winRate || p.games !== prev.games) {
                currentRank = index + 1;
            }
        }
        return { ...p, displayRank: currentRank };
    });

    // Sort rows based on the active table column
    const sortedPlayers = [...playersWithPermanentRanks].sort((a, b) => {
        if (currentRoleSortKey === "player") {
            const cmp = a.name.localeCompare(b.name);
            if (cmp !== 0) return currentRoleSortAsc ? cmp : -cmp;
            const wrDiff = b.winRate - a.winRate;
            if (wrDiff !== 0) return wrDiff;
            return b.games - a.games;
        } else if (currentRoleSortKey === "games") {
            const diff = a.games - b.games;
            if (diff !== 0) return currentRoleSortAsc ? diff : -diff;
            const wrDiff = a.winRate - b.winRate;
            if (wrDiff !== 0) return -wrDiff;
        } else if (currentRoleSortKey === "kda") {
            const diff = a.kdaRatio - b.kdaRatio;
            if (diff !== 0) return currentRoleSortAsc ? diff : -diff;
            const wrDiff = a.winRate - b.winRate;
            if (wrDiff !== 0) return -wrDiff;
        } else if (currentRoleSortKey === "cs") {
            const diff = a.csPerMin - b.csPerMin;
            if (diff !== 0) return currentRoleSortAsc ? diff : -diff;
            const wrDiff = a.winRate - b.winRate;
            if (wrDiff !== 0) return -wrDiff;
        } else if (currentRoleSortKey === "rank") {
            const diff = a.displayRank - b.displayRank;
            if (diff !== 0) return currentRoleSortAsc ? diff : -diff;
        } else {
            // "wr" and "wl"
            const diff = a.winRate - b.winRate;
            if (diff !== 0) return currentRoleSortAsc ? diff : -diff;
            const gamesDiff = a.games - b.games;
            if (gamesDiff !== 0) return -gamesDiff;
        }

        return a.name.localeCompare(b.name);
    });

    const effectiveLimit = roleIsShowAllExpanded
        ? sortedPlayers.length
        : roleVisibleCount;
    const visiblePlayers = sortedPlayers.slice(0, effectiveLimit);

    let rowsHtml = visiblePlayers.map(buildRoleLeaderboardRowHtml).join("");

    if (sortedPlayers.length > 10) {
        if (roleIsShowAllExpanded) {
            rowsHtml += `
                <tr id="role-action-row" class="table-action-row">
                    <td colspan="8">
                        <span id="role-show-less-btn" class="duo-action-btn">
                            <strong>Show top 10 only ▲</strong>
                        </span>
                    </td>
                </tr>
            `;
        } else if (sortedPlayers.length > roleVisibleCount) {
            const remaining = sortedPlayers.length - roleVisibleCount;
            const nextBatchSize = Math.min(10, remaining);
            rowsHtml += `
                <tr id="role-action-row" class="table-action-row">
                    <td colspan="8">
                        <span id="role-show-more-btn" class="duo-action-btn">
                            <strong>Show ${nextBatchSize} more (${remaining} remaining) ▼</strong>
                        </span>
                        <span class="duo-action-separator">|</span>
                        <span id="role-show-all-btn" class="duo-action-btn">
                            <strong>Show all (${sortedPlayers.length})</strong>
                        </span>
                    </td>
                </tr>
            `;
        }
    }

    tbody.innerHTML = rowsHtml;
    updateHeaderSortArrows(
        "#role-leaderboard",
        currentRoleSortKey,
        currentRoleSortAsc,
    );
}

// Fetch aggregate role stats and populate leaderboard
async function loadRoleLeaderboard(role = selectedRole) {
    selectedRole = role;
    const iconContainer = document.getElementById("role-icon-container");

    if (!role) {
        if (iconContainer) iconContainer.innerHTML = "";
        roleLeaderboardData = [];
        renderRoleLeaderboard();
        return;
    }

    if (iconContainer && ROLE_ICON_MAP[role]) {
        iconContainer.innerHTML = `<img src="${ROLE_ICON_MAP[role]}" alt="${role}" title="${role}" id="role-selected-icon" />`;
    }

    try {
        const result = await fetchRoleLeaderboard(role);
        const statsByPuuid = new Map(
            (result.players || []).map((player) => [player.puuid, player]),
        );

        roleLeaderboardData = PLAYERS.map((player) => {
            const playerStats = statsByPuuid.get(player.puuid);
            return {
                name: player.name,
                puuid: player.puuid,
                wins: playerStats?.wins || 0,
                losses: playerStats?.losses || 0,
                games: playerStats?.games || 0,
                winRate: playerStats?.winRate || 0,
                kills: playerStats?.kills || 0,
                deaths: playerStats?.deaths || 0,
                assists: playerStats?.assists || 0,
                avgKills: playerStats?.avgKills || 0,
                avgDeaths: playerStats?.avgDeaths || 0,
                avgAssists: playerStats?.avgAssists || 0,
                kdaRatio: playerStats?.kdaRatio || 0,
                csPerMin: playerStats?.csPerMin || 0,
                topChamps: playerStats?.topChamps || [],
            };
        });

        renderRoleLeaderboard();
    } catch (error) {
        console.error(error);
    }
}

// Setup event listeners for role leaderboard
function setupRoleLeaderboard() {
    const container = document.getElementById("role-select-container");
    const searchInput = document.getElementById("role-search");
    const dropdown = document.getElementById("role-dropdown");
    const showAllCb = document.getElementById("role-show-all-cb");
    const tbody = document.getElementById("role-leaderboard-body");

    searchInput?.addEventListener("click", () => {
        dropdown?.classList.toggle("open");
    });

    dropdown?.addEventListener("mousedown", (e) => {
        const option = e.target.closest(".custom-select-option");
        if (!option) return;

        e.preventDefault();
        const role = option.dataset.role;
        const roleName = option.textContent.trim();

        if (searchInput) searchInput.value = roleName;
        dropdown.classList.remove("open");

        roleVisibleCount = 10;
        roleIsShowAllExpanded = false;
        loadRoleLeaderboard(role);
    });

    document.addEventListener("mousedown", (e) => {
        if (!container?.contains(e.target)) {
            dropdown?.classList.remove("open");
        }
    });

    showAllCb?.addEventListener("change", (e) => {
        roleShowAllGames = e.target.checked;
        roleVisibleCount = 10;
        roleIsShowAllExpanded = false;
        renderRoleLeaderboard();
    });

    document
        .querySelectorAll("#role-leaderboard th[data-sort]")
        .forEach((th) => {
            th.addEventListener("click", () => {
                const sortKey = th.getAttribute("data-sort");
                if (currentRoleSortKey === sortKey) {
                    currentRoleSortAsc = !currentRoleSortAsc;
                } else {
                    currentRoleSortKey = sortKey;
                    currentRoleSortAsc = ["rank", "player"].includes(sortKey);
                }
                renderRoleLeaderboard();
            });
        });

    tbody?.addEventListener("click", (e) => {
        if (e.target.closest("#role-show-more-btn")) {
            roleVisibleCount += 10;
            renderRoleLeaderboard();
        } else if (e.target.closest("#role-show-all-btn")) {
            roleIsShowAllExpanded = true;
            renderRoleLeaderboard();
        } else if (e.target.closest("#role-show-less-btn")) {
            roleIsShowAllExpanded = false;
            roleVisibleCount = 10;
            renderRoleLeaderboard();
        }
    });
}

// Fetch duo combo data from API
async function loadDuoLeaderboard() {
    try {
        const result = await fetchDuoLeaderboard();
        duoLeaderboardData = result.duos || [];
        renderDuoLeaderboard();
    } catch (error) {
        console.error(error);
    }
}

// Fetch a single player's live profile and update all tables using cached DB stats
async function fetchPlayerProfile(player, rankedStats) {
    const [account, summoner, ranked, masteries] = await Promise.all([
        fetchRiotAccountByPuuid(player.puuid),
        fetchSummonerData(player.puuid),
        fetchRankedData(player.puuid),
        fetchMasteryData(player.puuid),
    ]);

    const { solo, flex, fives } = extractQueueEntries(ranked);
    const { totalPoints, totalPointsText, playedChampsCount, top10Text } =
        summarizeMasteryData(masteries);

    const peakData = await syncAndFetchPlayerPeaks(player.puuid, solo, flex);

    const flexStats = rankedStats[player.puuid]?.flex || {};
    const rankedFivesStats = rankedStats[player.puuid]?.fives || {};

    return {
        profileData: {
            name: player.name,
            account,
            summoner,
            soloText: formatRank(solo),
            top10Text,
            soloPeak: formatPeakDisplay(peakData.peakSolo),
        },
        profileLeaderboard: {
            name: player.name,
            soloScore: getRankScore(solo),
            soloHtml: formatRank(solo),
            masteryPoints: totalPoints,
            masteryText: totalPointsText,
            level: summoner.summonerLevel || 0,
            playedChampsCount,
        },
        fivesLeaderboard: buildFivesLeaderboardEntry(
            player,
            fives,
            rankedFivesStats,
        ),
        flexLeaderboard: buildFlexLeaderboardEntry(player, flex, flexStats),
        pingsLeaderboard: buildPingsLeaderboardEntry(
            player,
            flexStats,
            rankedFivesStats,
        ),
    };
}

// Clear tables, bulk fetch DB data, and load all player profiles concurrently
async function loadAllProfiles() {
    const statusMsg = document.getElementById("status-msg");

    clearProfileTables();
    profileLeaderboardData = [];
    fivesLeaderboardData = [];
    flexLeaderboardData = [];
    pingsLeaderboardData = [];

    try {
        statusMsg.innerText = "Syncing matches & loading statistics...";

        // Sync new matches and initialize champ metadata
        await syncRankedQueues();
        await initChampionData();

        // Fetch all DB statistics in a single bulk query
        const rosterRankedStats = await fetchRosterRankedStats();

        // Load players in small batches with slight delays to respect Riot rate limits
        statusMsg.innerText = "Fetching player profiles...";

        const BATCH_SIZE = 2;
        const DELAY_BETWEEN_BATCHES_MS = 250;
        const results = [];

        for (let i = 0; i < PLAYERS.length; i += BATCH_SIZE) {
            const batch = PLAYERS.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
                batch.map((player) =>
                    fetchPlayerProfile(player, rosterRankedStats),
                ),
            );
            results.push(...batchResults);
            if (i + BATCH_SIZE < PLAYERS.length) {
                await new Promise((resolve) =>
                    setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS),
                );
            }
        }

        // Populate datasets in strictly defined PLAYERS order
        for (const res of results) {
            appendProfileTableColumns(res.profileData);
            profileLeaderboardData.push(res.profileLeaderboard);
            fivesLeaderboardData.push(res.fivesLeaderboard);
            flexLeaderboardData.push(res.flexLeaderboard);
            pingsLeaderboardData.push(res.pingsLeaderboard);
        }

        // Render all tables once complete
        renderProfileLeaderboard();
        renderFivesLeaderboard();
        renderFlexLeaderboard();
        renderPingsLeaderboard();

        // Reset role dropdown input and state to empty default
        const roleInput = document.getElementById("role-search");
        if (roleInput) roleInput.value = "";
        selectedRole = null;
        renderRoleLeaderboard();

        await loadDuoLeaderboard();

        statusMsg.innerText = "";
    } catch (error) {
        console.error(error);
        statusMsg.innerText = `Error: ${error.message}`;
    }
}

/* APPLICATION INITIALIZATION */

document.addEventListener("DOMContentLoaded", () => {
    document
        .getElementById("load-all-btn")
        .addEventListener("click", loadAllProfiles);
    setupViewToggle();
    setupProfileLeaderboardSorting();
    setupSharedRankedSorting();
    setupFivesLeaderboardSorting();
    setupFlexLeaderboardSorting();
    setupChampionLeaderboard();
    setupRoleLeaderboard();
    setupDuoLeaderboard();
    setupPingsLeaderboardSorting();
    setupChampIconHighlighting();
    loadAllProfiles();
});
