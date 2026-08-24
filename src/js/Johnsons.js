import {
    fetchRiotAccountByPuuid,
    fetchSummonerData,
    fetchRankedData,
    fetchMasteryData,
    fetchFlexStats,
    syncAndFetchPlayerPeaks
} from "./riotAPI.js";
import { getChampMap, getChampIconUrl } from "./champData.js";

const PLAYERS = [
    { name: "Aileen", puuid: "wUX2hh9YBwf66OZjsn6SauURG6dyrYsBklTqHvMv6f-EMlcKH87g_lds17PEVnbEd26gsJOwQQB1kg" },
    { name: "Anthony", puuid: "VTe2huNS57BFU3WuCefKyC_cqGjkExvB4enPSS4R5YXKXru5jFCdMPz_3HtirYPs8AqFjnalrQO95w" },
    { name: "Josh", puuid: "G6MhoNnrm8HYJ87lfJTEIoggCPb2_3Mr68Eh2OJGJeio972UwKnbzkDZUDxHcQZOoJz5rJbtWUMRlQ" },
    { name: "Justin", puuid: "81RQTX37Hxdj7i9V4UTljdySmsyj82OuiExAEOze3XohGnyUGR9etyTnjLohw87p9U-QjxMmONbEcg" },
    { name: "Mateo", puuid: "fSOoEFLuNqQlp7gY8RFUTQ2LnJpV3LcnapcRp1RDtn_CrLbaTM2bPsCzcic74Kk_QfeDjfwKHVtVsg" },
    { name: "Max", puuid: "TV09seitjrdYEiKToxrCA7rh_GN_wir_j_yZ3fmRS4Al1zpERQ6pvHzIy5dqqdDsRGyuk4DfoIDpsg" },
    { name: "Meileen", puuid: "6cwqYAckOFIdB4qJoFEvKohj9zIG_HveDYMSaOJx4oNndYnbygmKvbZSbMfrPww6xYbTYUrFNy4zkQ" },
    { name: "Owen", puuid: "9pLcWyTNsCHIA6GtYarC4ZKV02JDXyWPGY8fTzQKQ06oqgAMJ17_C2CAGrM5HvGiWBFqiH5U1GYyqg" },
    { name: "Sam", puuid: "5-1YXAqBrJ9JtM311w5RQRBDwyr0AWf2k-m9OouPheTZNuAPbB6MsKN-EncpjlWm2G98mX-WDdrOBA" },
    { name: "Shrihan", puuid: "S3-ROibvQqYney-A0xvuYXH4J8mO1_-ZWU0I20ZKNw452ioyJlrg5ZLrcf2tNWLPFAkQsPsvIMbRUw" }
];

let championMap = {};
let totalChampionCount = 0;
let leaderboardData = [];
let leaderboardMode = "wr";
let currentSortKey = "soloScore";
let currentSortAsc = false;

const TIER_ORDER = {
    IRON: 0, BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4,
    EMERALD: 5, DIAMOND: 6, MASTER: 7, GRANDMASTER: 8, CHALLENGER: 9
};
const DIV_ORDER = { IV: 0, III: 1, II: 2, I: 3 };

function getRankIconImg(tier) {
    if (!tier) return "";
    const formattedTier = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
    return `<img src="/images/Rank_${formattedTier}.png" alt="${tier}" class="rank-icon" />`;
}

function formatRank(entry) {
    if (!entry || !entry.tier) return "Unranked";

    const tierMap = {
        IRON: "I", BRONZE: "B", SILVER: "S", GOLD: "G",
        PLATINUM: "P", EMERALD: "E", DIAMOND: "D",
        MASTER: "Master", GRANDMASTER: "GM", CHALLENGER: "Challenger"
    };
    const divisionMap = { I: "1", II: "2", III: "3", IV: "4" };

    const tierShort = tierMap[entry.tier.toUpperCase()] || entry.tier;
    const isApex = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(entry.tier.toUpperCase());
    const icon = getRankIconImg(entry.tier);

    const rankText = isApex 
        ? `${tierShort} ${entry.leaguePoints} LP` 
        : `${tierShort}${divisionMap[entry.rank] || entry.rank || ""} ${entry.leaguePoints} LP`;

    return `<span class="rank-cell-content">${icon}<span>${rankText}</span></span>`;
}

function formatPoints(pts) {
    if (pts >= 1_000_000) return (pts / 1_000_000).toFixed(2) + "M";
    return (pts / 1000).toFixed(1) + "K";
}

function setupChampIconHighlighting() {
    const table = document.getElementById("profile-summary");
    if (!table) return;

    table.addEventListener("mouseover", (e) => {
        const target = e.target.closest(".top5-champ-icon");
        if (!target) return;

        const champId = target.dataset.champId;
        if (!champId) return;

        document.querySelectorAll(`.top5-champ-icon[data-champ-id="${champId}"]`).forEach(el => {
            el.classList.add("champ-highlighted");
        });
    });

    table.addEventListener("mouseout", (e) => {
        const target = e.target.closest(".top5-champ-icon");
        if (!target) return;

        const champId = target.dataset.champId;
        if (!champId) return;

        document.querySelectorAll(`.top5-champ-icon[data-champ-id="${champId}"]`).forEach(el => {
            el.classList.remove("champ-highlighted");
        });
    });
}

async function initChampionData() {
    if (Object.keys(championMap).length === 0) {
        championMap = await getChampMap();
        totalChampionCount = Object.keys(championMap).length;
        const headerEl = document.getElementById("header-champs");
        if (headerEl) {
            headerEl.innerText = `Mastery Champions (out of ${totalChampionCount})`;
        }
    }
}

function formatPeakDisplay(peak) {
    if (!peak || !peak.tier) return { rankText: "Unranked", gamesText: "0" };
    
    const currentYear = new Date().getFullYear();
    const isCurrentYear = peak.year === currentYear;
    const yearFormatted = isCurrentYear ? `<strong>(${peak.year})</strong>` : `(${peak.year})`;

    const tierMap = {
        IRON: "I", BRONZE: "B", SILVER: "S", GOLD: "G",
        PLATINUM: "P", EMERALD: "E", DIAMOND: "D",
        MASTER: "Master", GRANDMASTER: "GM", CHALLENGER: "Challenger"
    };
    const divisionMap = { I: "1", II: "2", III: "3", IV: "4" };

    const tierShort = tierMap[peak.tier.toUpperCase()] || peak.tier;
    const isApex = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(peak.tier.toUpperCase());
    const icon = getRankIconImg(peak.tier);

    const rankText = isApex 
        ? `${tierShort} ${peak.lp} LP` 
        : `${tierShort}${divisionMap[peak.rank] || peak.rank || ""} ${peak.lp} LP`;

    return {
        rankText: `<span class="rank-cell-content">${icon}<span>${rankText} ${yearFormatted}</span></span>`,
        gamesText: `${peak.games || 0} (${peak.wins || 0}W ${peak.losses || 0}L)`
    };
}

function getRankScore(entry) {
    if (!entry || !entry.tier) return -1;
    const tierVal = (TIER_ORDER[entry.tier.toUpperCase()] ?? 0) * 10000;
    const divVal = (DIV_ORDER[entry.rank] ?? 0) * 100;
    const lpVal = entry.leaguePoints ?? 0;
    return tierVal + divVal + lpVal;
}

function parseWinrate(statStr) {
    if (!statStr || statStr === "0") return -1;
    const match = statStr.match(/\(([\d.]+)%\)/);
    return match ? parseFloat(match[1]) : -1;
}

function parseGamesCount(statStr) {
    if (!statStr || statStr === "0") return 0;
    const match = statStr.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

function getResolvedSortKey(key) {
    const roleMap = {
        top: leaderboardMode === "games" ? "topGames" : "topWr",
        jgl: leaderboardMode === "games" ? "jglGames" : "jglWr",
        mid: leaderboardMode === "games" ? "midGames" : "midWr",
        bot: leaderboardMode === "games" ? "botGames" : "botWr",
        sup: leaderboardMode === "games" ? "supGames" : "supWr",
        total: leaderboardMode === "games" ? "totalGames" : "totalWr"
    };
    return roleMap[key] || key;
}

function renderLeaderboard() {
    const tbody = document.getElementById("leaderboard-body");
    if (!tbody) return;

    const activeSortKey = getResolvedSortKey(currentSortKey);

    leaderboardData.sort((a, b) => {
        let valA = a[activeSortKey];
        let valB = b[activeSortKey];

        if (typeof valA === "string") {
            return currentSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return currentSortAsc ? valA - valB : valB - valA;
    });

    tbody.innerHTML = leaderboardData.map(p => `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.soloHtml}</td>
            <td>${p.flexHtml}</td>
            <td>${p.fivesHtml}</td>
            <td>${p.topText}</td>
            <td>${p.jglText}</td>
            <td>${p.midText}</td>
            <td>${p.botText}</td>
            <td>${p.supText}</td>
            <td>${p.totalText}</td>
        </tr>
    `).join("");

    document.querySelectorAll("#leaderboard th[data-sort]").forEach(th => {
        const arrow = th.querySelector(".sort-arrow");
        if (th.getAttribute("data-sort") === currentSortKey) {
            arrow.textContent = currentSortAsc ? " ▲" : " ▼";
        } else {
            arrow.textContent = "";
        }
    });
}

function setupLeaderboardSorting() {
    document.querySelectorAll("#leaderboard th[data-sort]").forEach(th => {
        th.addEventListener("click", () => {
            const sortKey = th.getAttribute("data-sort");
            if (currentSortKey === sortKey) {
                currentSortAsc = !currentSortAsc;
            } else {
                currentSortKey = sortKey;
                currentSortAsc = false;
            }
            renderLeaderboard();
        });
    });

    const modeSelect = document.getElementById("leaderboard-mode-select");
    if (modeSelect) {
        modeSelect.addEventListener("change", (e) => {
            leaderboardMode = e.target.value;
            renderLeaderboard();
        });
    }
}

async function fetchPlayerProfile(player) {
    const account = await fetchRiotAccountByPuuid(player.puuid);
    if (!account.puuid) throw new Error(`Could not find profile for ${player.name}`);

    const [summoner, ranked, masteries, flexStats] = await Promise.all([
        fetchSummonerData(player.puuid),
        fetchRankedData(player.puuid),
        fetchMasteryData(player.puuid),
        fetchFlexStats(player.puuid, player.name, account.gameName, account.tagLine)
    ]);

    const rankedList = Array.isArray(ranked) ? ranked : [];
    const solo = rankedList.find(r => r.queueType === "RANKED_SOLO_5x5");
    const flex = rankedList.find(r => r.queueType === "RANKED_FLEX_SR");
    const fives = rankedList.find(r => r.queueType === "RANKED_PREMADE_5x5");

    const soloText = formatRank(solo);
    const flexText = formatRank(flex);
    const fivesText = formatRank(fives);

    const peakData = await syncAndFetchPlayerPeaks(player.puuid, solo, flex);
    const soloPeak = formatPeakDisplay(peakData.peakSolo);
    const flexPeak = formatPeakDisplay(peakData.peakFlex);

    const masteryList = Array.isArray(masteries) ? masteries : [];
    const top5Text = masteryList
        .slice(0, 5)
        .map(m => {
            const champName = championMap[m.championId] || `Champ ${m.championId}`;
            const champIconUrl = getChampIconUrl(champName);
            const pts = formatPoints(m.championPoints);
            return `<div class="top5-item"><img src="${champIconUrl}" alt="${champName}" title="${champName}" data-champ-id="${m.championId}" class="top5-champ-icon" /><span>${pts} (${m.championLevel})</span></div>`;
        })
        .join("");

    const playedChampsCount = masteryList.filter(m => m.championLevel > 0).length;
    const totalPoints = masteryList.reduce((sum, m) => sum + m.championPoints, 0);
    const totalMasteryLevel = masteryList.reduce((sum, m) => sum + m.championLevel, 0);
    const totalPointsText = `${totalPoints.toLocaleString()} (${totalMasteryLevel})`;

    // Profile Summary Table
    document.getElementById("row-name").insertAdjacentHTML("beforeend", `<td><strong>${player.name}</strong></td>`);
    document.getElementById("row-player").insertAdjacentHTML("beforeend", `<td>${account.gameName}#${account.tagLine}</td>`);
    document.getElementById("row-level").insertAdjacentHTML("beforeend", `<td>${summoner.summonerLevel}</td>`);
    document.getElementById("row-solo").insertAdjacentHTML("beforeend", `<td>${soloText}</td>`);
    document.getElementById("row-fives").insertAdjacentHTML("beforeend", `<td>${fivesText}</td>`);
    document.getElementById("row-top5").insertAdjacentHTML("beforeend", `<td>${top5Text}</td>`);
    document.getElementById("row-champs").insertAdjacentHTML("beforeend", `<td>${playedChampsCount}</td>`);
    document.getElementById("row-points").insertAdjacentHTML("beforeend", `<td>${totalPointsText}</td>`);
    document.getElementById("row-peak-solo").insertAdjacentHTML("beforeend", `<td>${soloPeak.rankText}</td>`);
    document.getElementById("row-peak-solo-games").insertAdjacentHTML("beforeend", `<td>${soloPeak.gamesText}</td>`);

    // S26 Flex Table
    document.getElementById("row-flex-name").insertAdjacentHTML("beforeend", `<td><strong>${player.name}</strong></td>`);
    document.getElementById("row-flex").insertAdjacentHTML("beforeend", `<td>${flexText}</td>`);
    document.getElementById("row-flex-top").insertAdjacentHTML("beforeend", `<td>${flexStats.TOP || "0"}</td>`);
    document.getElementById("row-flex-jgl").insertAdjacentHTML("beforeend", `<td>${flexStats.JGL || "0"}</td>`);
    document.getElementById("row-flex-mid").insertAdjacentHTML("beforeend", `<td>${flexStats.MID || "0"}</td>`);
    document.getElementById("row-flex-bot").insertAdjacentHTML("beforeend", `<td>${flexStats.BOT || "0"}</td>`);
    document.getElementById("row-flex-sup").insertAdjacentHTML("beforeend", `<td>${flexStats.SUP || "0"}</td>`);
    document.getElementById("row-flex-total").insertAdjacentHTML("beforeend", `<td>${flexStats.TOTAL || "0"}</td>`);
    document.getElementById("row-peak-flex").insertAdjacentHTML("beforeend", `<td>${flexPeak.rankText}</td>`);

    // Accumulate Leaderboard Row Data
    leaderboardData.push({
        name: player.name,
        soloScore: getRankScore(solo),
        soloHtml: soloText,
        flexScore: getRankScore(flex),
        flexHtml: flexText,
        fivesScore: getRankScore(fives),
        fivesHtml: fivesText,
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
        totalText: flexStats.TOTAL || "0"
    });
}

async function loadAllProfiles() {
    const statusMsg = document.getElementById("status-msg");
    const rows = [
        "row-name", "row-player", "row-level", 
        "row-solo", "row-fives", "row-top5",
        "row-champs", "row-points", "row-peak-solo", 
        "row-peak-solo-games", "row-flex-name", "row-flex",
        "row-flex-top", "row-flex-jgl", "row-flex-mid", "row-flex-bot",
        "row-flex-sup", "row-flex-total", "row-peak-flex"
    ];

    rows.forEach(rowId => {
        const tr = document.getElementById(rowId);
        if (tr) {
            while (tr.children.length > 1) {
                tr.removeChild(tr.lastChild);
            }
        }
    });

    leaderboardData = [];

    try {
        await initChampionData();

        for (let i = 0; i < PLAYERS.length; i++) {
            const p = PLAYERS[i];
            statusMsg.innerText = `Loading (${i + 1}/${PLAYERS.length}): ${p.name}...`;
            await fetchPlayerProfile(p);
            renderLeaderboard();
        }
        statusMsg.innerText = "";
    } catch (err) {
        console.error(err);
        statusMsg.innerText = `Error: ${err.message}`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("load-all-btn").addEventListener("click", loadAllProfiles);
    setupLeaderboardSorting();
    setupChampIconHighlighting();
    loadAllProfiles();
});