import { PLAYERS, PING_KEYS } from "./config/players.js";
import {
    fetchRiotAccountByPuuid,
    fetchSummonerData,
    fetchRankedData,
    fetchMasteryData,
    fetchRosterRankedStats,
    syncRankedQueues,
    syncAndFetchPlayerPeaks,
} from "./riotAPI.js";
import { getChampMap } from "./champData.js";
import {
    formatRank,
    formatPeakDisplay,
    getRankScore,
    parseWinrate,
    parseGamesCount,
} from "./utils/formatters.js";

import {
    setProfileData,
    clearProfileTables,
    appendProfileTableColumns,
    renderProfileLeaderboard,
    setupProfileLeaderboardSorting,
    buildTop10MasteryHtml,
} from "./components/profiles.js";

import {
    setFivesData,
    setFlexData,
    renderFivesLeaderboard,
    renderFlexLeaderboard,
    setupSharedRankedSorting,
    setupFivesLeaderboardSorting,
    setupFlexLeaderboardSorting,
} from "./components/flexFives.js";

import {
    setupChampionLeaderboard,
    renderChampionDropdownOptions,
} from "./components/champion.js";

import {
    setupRoleLeaderboard,
    renderRoleLeaderboard,
} from "./components/role.js";

import { setupDuoLeaderboard, loadDuoLeaderboard } from "./components/duo.js";

import {
    setPingsData,
    renderPingsLeaderboard,
    setupPingsLeaderboardSorting,
} from "./components/pings.js";

let championMap = {};
let totalChampionCount = 0;
let sortedChampionList = [];
let championNameToIdMap = {};

function setupViewToggle() {
    const profilesBtn = document.getElementById("tab-profiles-btn");
    const rankedBtn = document.getElementById("tab-ranked-btn");
    const profilesView = document.getElementById("view-profiles");
    const rankedView = document.getElementById("view-ranked");

    profilesBtn?.addEventListener("click", () => {
        profilesBtn.classList.add("active");
        rankedBtn?.classList.remove("active");
        if (profilesView) profilesView.style.display = "block";
        if (rankedView) rankedView.style.display = "none";
    });

    rankedBtn?.addEventListener("click", () => {
        rankedBtn.classList.add("active");
        profilesBtn?.classList.remove("active");
        if (rankedView) rankedView.style.display = "block";
        if (profilesView) profilesView.style.display = "none";
    });
}

function setupChampIconHighlighting() {
    const table = document.getElementById("profile-summary");
    if (!table) return;

    table.addEventListener("mouseover", (e) => {
        const target = e.target.closest(".top10-champ-icon");
        const champId = target?.dataset?.champId;
        if (!champId) return;
        document
            .querySelectorAll(`.top10-champ-icon[data-champ-id="${champId}"]`)
            .forEach((el) => {
                el.classList.add("champ-highlighted");
            });
    });

    table.addEventListener("mouseout", (e) => {
        const target = e.target.closest(".top10-champ-icon");
        const champId = target?.dataset?.champId;
        if (!champId) return;
        document
            .querySelectorAll(`.top10-champ-icon[data-champ-id="${champId}"]`)
            .forEach((el) => {
                el.classList.remove("champ-highlighted");
            });
    });
}

function extractQueueEntries(rankedData) {
    const rankedList = Array.isArray(rankedData) ? rankedData : [];
    return {
        solo: rankedList.find((r) => r.queueType === "RANKED_SOLO_5x5"),
        flex: rankedList.find((r) => r.queueType === "RANKED_FLEX_SR"),
        fives: rankedList.find((r) => r.queueType === "RANKED_PREMADE_5x5"),
    };
}

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
        top10Text: buildTop10MasteryHtml(masteryList, championMap),
    };
}

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

    return { name: player.name, gamesCount: totalGames, avg, raw: rawTotals };
}

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

async function initChampionData() {
    if (Object.keys(championMap).length === 0) {
        championMap = await getChampMap();
        totalChampionCount = Object.keys(championMap).length;

        const headerEl = document.getElementById("header-champs");
        if (headerEl) {
            headerEl.innerHTML = `Unique Champs Played (out of ${totalChampionCount})<span class="sort-arrow"></span>`;
        }

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

        renderChampionDropdownOptions(sortedChampionList);
    }
}

async function loadAllProfiles() {
    const statusMsg = document.getElementById("status-msg");

    clearProfileTables();
    const profileLeaderboardData = [];
    const fivesLeaderboardData = [];
    const flexLeaderboardData = [];
    const pingsLeaderboardData = [];

    try {
        if (statusMsg)
            statusMsg.innerText = "Syncing matches & loading statistics...";

        await syncRankedQueues();
        await initChampionData();

        const rosterRankedStats = await fetchRosterRankedStats();

        if (statusMsg) statusMsg.innerText = "Fetching player profiles...";

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

        for (const res of results) {
            appendProfileTableColumns(res.profileData);
            profileLeaderboardData.push(res.profileLeaderboard);
            fivesLeaderboardData.push(res.fivesLeaderboard);
            flexLeaderboardData.push(res.flexLeaderboard);
            pingsLeaderboardData.push(res.pingsLeaderboard);
        }

        setProfileData(profileLeaderboardData);
        setFivesData(fivesLeaderboardData);
        setFlexData(flexLeaderboardData);
        setPingsData(pingsLeaderboardData);

        renderProfileLeaderboard();
        renderFivesLeaderboard();
        renderFlexLeaderboard();
        renderPingsLeaderboard();

        const roleInput = document.getElementById("role-search");
        if (roleInput) roleInput.value = "";
        renderRoleLeaderboard(championMap);

        await loadDuoLeaderboard();

        if (statusMsg) statusMsg.innerText = "";
    } catch (error) {
        console.error(error);
        if (statusMsg) statusMsg.innerText = `Error: ${error.message}`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document
        .getElementById("load-all-btn")
        ?.addEventListener("click", loadAllProfiles);
    setupViewToggle();
    setupProfileLeaderboardSorting();
    setupSharedRankedSorting();
    setupFivesLeaderboardSorting();
    setupFlexLeaderboardSorting();
    setupChampionLeaderboard(
        () => sortedChampionList,
        () => championMap,
        () => championNameToIdMap,
    );
    setupRoleLeaderboard(() => championMap);
    setupDuoLeaderboard();
    setupPingsLeaderboardSorting();
    setupChampIconHighlighting();
    loadAllProfiles();
});
