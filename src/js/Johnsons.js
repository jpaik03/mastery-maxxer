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
    fetchFlexStats,
    fetchRankedFivesStats,
    fetchChampionLeaderboard,
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
    "row-flex-name",
    "row-flex",
    "row-flex-top",
    "row-flex-jgl",
    "row-flex-mid",
    "row-flex-bot",
    "row-flex-sup",
    "row-flex-total",
    "row-peak-flex",
    "row-fives-name",
    "row-fives-rank",
    "row-fives-top",
    "row-fives-jgl",
    "row-fives-mid",
    "row-fives-bot",
    "row-fives-sup",
    "row-fives-total",
];

/* STATE MANAGEMENT */

let championMap = {};
let totalChampionCount = 0;

let profileLeaderboardData = [];
let currentProfileSortKey = "soloScore";
let currentProfileSortAsc = false;

let flexLeaderboardData = [];
let flexLeaderboardMode = "wr";
let currentFlexSortKey = "flexScore";
let currentFlexSortAsc = false;

let championLeaderboardData = [];
let championLeaderboardMode = "wr";

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

// Compare two values for sorting (supports numeric and string comparisons)
function compareValues(valA, valB, isAscending) {
    if (typeof valA === "string" && typeof valB === "string") {
        return isAscending
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
    }
    return isAscending ? valA - valB : valB - valA;
}

// Format a numeric ping count or average value
function formatPingValue(num, isTotalMode) {
    return isTotalMode ? Math.round(num).toLocaleString() : num.toFixed(1);
}

// Resolve active column sort key based on current winrate vs games view mode
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

// Generate an HTML table row for the S26 Flex role leaderboard
function buildFlexLeaderboardRowHtml(p) {
    return `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.flexHtml}</td>
            <td>${p.fivesHtml}</td>
            <td>${p.topText}</td>
            <td>${p.jglText}</td>
            <td>${p.midText}</td>
            <td>${p.botText}</td>
            <td>${p.supText}</td>
            <td>${p.totalText}</td>
        </tr>
    `;
}

// Generate an HTML table row for the champion-specific leaderboard
function buildChampionLeaderboardRowHtml(player, index) {
    return `
        <tr>
            <td><strong>${index + 1}</strong></td>
            <td><strong>${player.name}</strong></td>
            <td>${player.wins}-${player.losses}</td>
            <td>${player.games > 0 ? `${player.winRate.toFixed(1)}%` : "—"}</td>
            <td>${player.games}</td>
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

// Build normalized ping data bundle for average and total views
function buildPingsLeaderboardEntry(player, flexStats) {
    const pings = flexStats.pings || {};
    const raw = flexStats.rawPings || {};

    const avg = {};
    const rawTotals = {};

    PING_KEYS.forEach((key) => {
        avg[key] = parseFloat(pings[key] || 0);
        rawTotals[key] = raw[key] || 0;
    });

    avg.total = parseFloat(pings.total || 0);
    rawTotals.total = raw.total || 0;

    return {
        name: player.name,
        gamesCount:
            flexStats.storedMatchCount || parseGamesCount(flexStats.TOTAL) || 0,
        avg,
        raw: rawTotals,
    };
}

// Build leaderboard row object containing sortable and display fields for Flex
function buildFlexLeaderboardEntry(player, flex, fives, flexStats) {
    return {
        name: player.name,
        flexScore: getRankScore(flex),
        flexHtml: formatRank(flex),
        fivesScore: getRankScore(fives),
        fivesHtml: formatRank(fives),
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

// Append player column cells to Profile Summary and S26 Flex tables
function appendProfileTableColumns(profileData) {
    const {
        name,
        account,
        summoner,
        soloText,
        fivesText,
        top10Text,
        soloPeak,
        flexText,
        flexStats,
        flexPeak,
        rankedFivesStats,
    } = profileData;

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

    // S26 Flex Table
    document
        .getElementById("row-flex-name")
        .insertAdjacentHTML("beforeend", `<td><strong>${name}</strong></td>`);
    document
        .getElementById("row-flex")
        .insertAdjacentHTML("beforeend", `<td>${flexText}</td>`);
    document
        .getElementById("row-flex-top")
        .insertAdjacentHTML("beforeend", `<td>${flexStats.TOP || "0"}</td>`);
    document
        .getElementById("row-flex-jgl")
        .insertAdjacentHTML("beforeend", `<td>${flexStats.JGL || "0"}</td>`);
    document
        .getElementById("row-flex-mid")
        .insertAdjacentHTML("beforeend", `<td>${flexStats.MID || "0"}</td>`);
    document
        .getElementById("row-flex-bot")
        .insertAdjacentHTML("beforeend", `<td>${flexStats.BOT || "0"}</td>`);
    document
        .getElementById("row-flex-sup")
        .insertAdjacentHTML("beforeend", `<td>${flexStats.SUP || "0"}</td>`);
    document
        .getElementById("row-flex-total")
        .insertAdjacentHTML("beforeend", `<td>${flexStats.TOTAL || "0"}</td>`);
    document
        .getElementById("row-peak-flex")
        .insertAdjacentHTML("beforeend", `<td>${flexPeak.rankText}</td>`);

    // S26 Ranked 5v5 Table
    document
        .getElementById("row-fives-name")
        .insertAdjacentHTML("beforeend", `<td><strong>${name}</strong></td>`);
    document
        .getElementById("row-fives-rank")
        .insertAdjacentHTML("beforeend", `<td>${fivesText}</td>`);
    document
        .getElementById("row-fives-top")
        .insertAdjacentHTML(
            "beforeend",
            `<td>${rankedFivesStats.TOP || "0"}</td>`,
        );
    document
        .getElementById("row-fives-jgl")
        .insertAdjacentHTML(
            "beforeend",
            `<td>${rankedFivesStats.JGL || "0"}</td>`,
        );
    document
        .getElementById("row-fives-mid")
        .insertAdjacentHTML(
            "beforeend",
            `<td>${rankedFivesStats.MID || "0"}</td>`,
        );
    document
        .getElementById("row-fives-bot")
        .insertAdjacentHTML(
            "beforeend",
            `<td>${rankedFivesStats.BOT || "0"}</td>`,
        );
    document
        .getElementById("row-fives-sup")
        .insertAdjacentHTML(
            "beforeend",
            `<td>${rankedFivesStats.SUP || "0"}</td>`,
        );
    document
        .getElementById("row-fives-total")
        .insertAdjacentHTML(
            "beforeend",
            `<td>${rankedFivesStats.TOTAL || "0"}</td>`,
        );
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
        compareValues(
            a[currentProfileSortKey],
            b[currentProfileSortKey],
            currentProfileSortAsc,
        ),
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

// Render S26 Flex role winrate leaderboard table
function renderFlexLeaderboard() {
    const tbody = document.getElementById("flex-leaderboard-body");
    if (!tbody) return;

    const activeSortKey = getResolvedFlexSortKey(currentFlexSortKey);
    flexLeaderboardData.sort((a, b) =>
        compareValues(a[activeSortKey], b[activeSortKey], currentFlexSortAsc),
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

// Render champion-specific winrate/games leaderboard table
function renderChampionLeaderboard() {
    const tbody = document.getElementById("champion-leaderboard-body");
    if (!tbody) return;

    const sortedPlayers = [...championLeaderboardData].sort((a, b) => {
        if (championLeaderboardMode === "games") {
            return (
                b.games - a.games ||
                b.winRate - a.winRate ||
                a.name.localeCompare(b.name)
            );
        }
        return (
            b.winRate - a.winRate ||
            b.games - a.games ||
            a.name.localeCompare(b.name)
        );
    });

    tbody.innerHTML = sortedPlayers
        .map(buildChampionLeaderboardRowHtml)
        .join("");
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

        return compareValues(valA, valB, currentPingSortAsc);
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

// Bind event listeners for flex leaderboard column headers and view toggles
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
                    currentFlexSortAsc = false;
                }
                renderFlexLeaderboard();
            });
        });

    const modeSelect = document.getElementById("flex-leaderboard-mode-select");
    if (modeSelect) {
        modeSelect.addEventListener("change", (e) => {
            flexLeaderboardMode = e.target.value;
            renderFlexLeaderboard();
        });
    }
}

// Bind event listeners for champion-specific leaderboard selection and sorting mode
function setupChampionLeaderboard() {
    const championSelect = document.getElementById("champion-select");
    const modeSelect = document.getElementById("champion-mode-select");

    championSelect?.addEventListener("change", loadChampionLeaderboard);
    modeSelect?.addEventListener("change", (event) => {
        championLeaderboardMode = event.target.value;
        renderChampionLeaderboard();
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

        const championSelect = document.getElementById("champion-select");
        if (championSelect) {
            championSelect.innerHTML = Object.entries(championMap)
                .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB))
                .map(([id, name]) => `<option value="${id}">${name}</option>`)
                .join("");
        }
    }
}

// Query aggregate champion statistics across the roster and populate leaderboard
async function loadChampionLeaderboard() {
    const championSelect = document.getElementById("champion-select");
    const championStatus = document.getElementById("champion-status");
    const championId = championSelect?.value;

    if (!championId) return;

    championStatus.textContent = "Loading...";

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
            };
        });

        renderChampionLeaderboard();
        championStatus.textContent = "";
    } catch (error) {
        console.error(error);
        championStatus.textContent = `Error: ${error.message}`;
    }
}

// Fetch a single player's full profile and update all tables
async function fetchPlayerProfile(player) {
    const account = await fetchRiotAccountByPuuid(player.puuid);
    if (!account.puuid) {
        throw new Error(`Could not find profile for ${player.name}`);
    }

    const [summoner, ranked, masteries, flexStats, rankedFivesStats] =
        await Promise.all([
            fetchSummonerData(player.puuid),
            fetchRankedData(player.puuid),
            fetchMasteryData(player.puuid),
            fetchFlexStats(
                player.puuid,
                player.name,
                account.gameName,
                account.tagLine,
            ),
            fetchRankedFivesStats(player.puuid),
        ]);

    const { solo, flex, fives } = extractQueueEntries(ranked);
    const { totalPoints, totalPointsText, playedChampsCount, top10Text } =
        summarizeMasteryData(masteries);

    const peakData = await syncAndFetchPlayerPeaks(player.puuid, solo, flex);

    // Append profile table columns
    appendProfileTableColumns({
        name: player.name,
        account,
        summoner,
        soloText: formatRank(solo),
        fivesText: formatRank(fives),
        top10Text,
        soloPeak: formatPeakDisplay(peakData.peakSolo),
        flexText: formatRank(flex),
        flexStats,
        flexPeak: formatPeakDisplay(peakData.peakFlex),
        rankedFivesStats,
    });

    // Accumulate profile summary leaderboard dataset
    profileLeaderboardData.push({
        name: player.name,
        soloScore: getRankScore(solo),
        soloHtml: formatRank(solo),
        masteryPoints: totalPoints,
        masteryText: totalPointsText,
        level: summoner.summonerLevel || 0,
        playedChampsCount,
    });

    // Accumulate flex leaderboard dataset
    flexLeaderboardData.push(
        buildFlexLeaderboardEntry(player, flex, fives, flexStats),
    );

    // Accumulate pings leaderboard dataset
    pingsLeaderboardData.push(buildPingsLeaderboardEntry(player, flexStats));
}

// Clear tables, fetch metadata, and sequentially load all player profiles
async function loadAllProfiles() {
    const statusMsg = document.getElementById("status-msg");

    clearProfileTables();
    profileLeaderboardData = [];
    flexLeaderboardData = [];
    pingsLeaderboardData = [];

    try {
        statusMsg.innerText = "Checking for new Flex and Ranked 5v5 matches...";

        await syncRankedQueues();
        await initChampionData();
        await loadChampionLeaderboard();

        for (let i = 0; i < PLAYERS.length; i++) {
            const player = PLAYERS[i];
            statusMsg.innerText = `Loading (${i + 1}/${PLAYERS.length}): ${player.name}...`;

            await fetchPlayerProfile(player);
            renderProfileLeaderboard();
            renderFlexLeaderboard();
            renderPingsLeaderboard();
        }

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
    setupFlexLeaderboardSorting();
    setupChampionLeaderboard();
    setupPingsLeaderboardSorting();
    setupChampIconHighlighting();
    loadAllProfiles();
});
