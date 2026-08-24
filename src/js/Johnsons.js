import {
    fetchRiotAccount,
    fetchSummonerData,
    fetchRankedData,
    fetchMasteryData
} from "./riotAPI.js";
import { getChampMap } from "./champData.js";

// Baseline data from your sheet
const PLAYERS = [
    { 
        name: "Aileen", gameName: "BlackLotus", tagLine: "143",
        peakSolo: { tier: "GOLD", rank: "IV", lp: 1, year: 2022, games: 57, wins: 32, losses: 25 },
        peakFlex: { tier: "GOLD", rank: "II", lp: 43, year: 2026, games: 165, wins: 84, losses: 81 }
    },
    { 
        name: "Anthony", gameName: "seven", tagLine: "0715",
        peakSolo: { tier: "EMERALD", rank: "I", lp: 12, year: 2026, games: 793, wins: 402, losses: 391 },
        peakFlex: { tier: "PLATINUM", rank: "II", lp: 51, year: 2026, games: 337, wins: 178, losses: 159 }
    },
    { 
        name: "Josh", gameName: "sheeple38", tagLine: "NA1",
        peakSolo: { tier: "DIAMOND", rank: "III", lp: 8, year: 2026, games: 249, wins: 129, losses: 120 },
        peakFlex: { tier: "EMERALD", rank: "II", lp: 95, year: 2026, games: 339, wins: 164, losses: 175 }
    },
    { 
        name: "Justin", gameName: "Seltzer", tagLine: "서폿 소나",
        peakSolo: { tier: "EMERALD", rank: "IV", lp: 1, year: 2024, games: 30, wins: 15, losses: 15 },
        peakFlex: { tier: "EMERALD", rank: "II", lp: 71, year: 2026, games: 72, wins: 39, losses: 33 }
    },
    { 
        name: "Mateo", gameName: "Kirby101101", tagLine: "NA1",
        peakSolo: { tier: "MASTER", rank: "I", lp: 278, year: 2026, games: 156, wins: 79, losses: 77 },
        peakFlex: { tier: "EMERALD", rank: "I", lp: 1, year: 2026, games: 335, wins: 166, losses: 169 }
    },
    { 
        name: "Max", gameName: "Maxm19", tagLine: "NA1",
        peakSolo: { tier: "EMERALD", rank: "II", lp: 51, year: 2026, games: 190, wins: 95, losses: 95 },
        peakFlex: { tier: "EMERALD", rank: "I", lp: 70, year: 2026, games: 228, wins: 121, losses: 107 }
    },
    { 
        name: "Meileen", gameName: "propaneglizzy", tagLine: "00000",
        peakSolo: { tier: "SILVER", rank: "IV", lp: 20, year: 2026, games: 16, wins: 6, losses: 10 },
        peakFlex: { tier: "SILVER", rank: "IV", lp: 24, year: 2026, games: 11, wins: 6, losses: 5 }
    },
    { 
        name: "Owen", gameName: "Chryseraph", tagLine: "Elysa",
        peakSolo: { tier: "DIAMOND", rank: "IV", lp: 90, year: 2026, games: 902, wins: 468, losses: 434 },
        peakFlex: { tier: "EMERALD", rank: "IV", lp: 55, year: 2026, games: 253, wins: 120, losses: 133 }
    },
    { 
        name: "Sam", gameName: "Ribeyyye", tagLine: "NA1",
        peakSolo: { tier: "SILVER", rank: "IV", lp: 83, year: 2025, games: 84, wins: 35, losses: 49 },
        peakFlex: { tier: "SILVER", rank: "IV", lp: 12, year: 2026, games: 71, wins: 40, losses: 31 }
    },
    { 
        name: "Shrihan", gameName: "shriggalicious", tagLine: "trinh",
        peakSolo: { tier: "BRONZE", rank: "II", lp: 22, year: 2021, games: 19, wins: 10, losses: 9 },
        peakFlex: { tier: "SILVER", rank: "I", lp: 75, year: 2025, games: 27, wins: 17, losses: 10 }
    }
];

let championMap = {};
let totalChampionCount = 0;

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

async function fetchPlayerProfile(player) {
    const account = await fetchRiotAccount(player.gameName, player.tagLine);
    if (!account.puuid) throw new Error(`Could not find ${player.gameName}#${player.tagLine}`);

    const [summoner, ranked, masteries] = await Promise.all([
        fetchSummonerData(account.puuid),
        fetchRankedData(account.puuid),
        fetchMasteryData(account.puuid)
    ]);

    const rankedList = Array.isArray(ranked) ? ranked : [];
    const solo = rankedList.find(r => r.queueType === "RANKED_SOLO_5x5");
    const flex = rankedList.find(r => r.queueType === "RANKED_FLEX_SR");
    const fives = rankedList.find(r => r.queueType === "RANKED_PREMADE_5x5");

    const soloText = formatRank(solo);
    const flexText = formatRank(flex);
    const fivesText = formatRank(fives);

    const masteryList = Array.isArray(masteries) ? masteries : [];

    const top5Text = masteryList
        .slice(0, 5)
        .map(m => {
            const champName = championMap[m.championId] || `Champ ${m.championId}`;
            const pts = formatPoints(m.championPoints);
            return `${champName}; ${pts} (${m.championLevel})`;
        })
        .join("<br>");

    const playedChampsCount = masteryList.filter(m => m.championLevel > 0).length;
    const totalPoints = masteryList.reduce((sum, m) => sum + m.championPoints, 0);
    const totalMasteryLevel = masteryList.reduce((sum, m) => sum + m.championLevel, 0);
    const totalPointsText = `${totalPoints.toLocaleString()} (${totalMasteryLevel})`;
    const soloPeak = computePeak(solo, player.peakSolo);
    const flexPeak = computePeak(flex, player.peakFlex);

    // Append cells to each row
    document.getElementById("row-name").insertAdjacentHTML("beforeend", `<td><strong>${player.name}</strong></td>`);
    document.getElementById("row-player").insertAdjacentHTML("beforeend", `<td>${account.gameName}#${account.tagLine}</td>`);
    document.getElementById("row-level").insertAdjacentHTML("beforeend", `<td>${summoner.summonerLevel}</td>`);
    document.getElementById("row-solo").insertAdjacentHTML("beforeend", `<td>${soloText}</td>`);
    document.getElementById("row-flex").insertAdjacentHTML("beforeend", `<td>${flexText}</td>`);
    document.getElementById("row-fives").insertAdjacentHTML("beforeend", `<td>${fivesText}</td>`);
    document.getElementById("row-top5").insertAdjacentHTML("beforeend", `<td>${top5Text}</td>`);
    document.getElementById("row-champs").insertAdjacentHTML("beforeend", `<td>${playedChampsCount}</td>`);
    document.getElementById("row-points").insertAdjacentHTML("beforeend", `<td>${totalPointsText}</td>`);
    document.getElementById("row-peak-solo").insertAdjacentHTML("beforeend", `<td>${soloPeak.rankText}</td>`);
    document.getElementById("row-peak-solo-games").insertAdjacentHTML("beforeend", `<td>${soloPeak.gamesText}</td>`);
    document.getElementById("row-peak-flex").insertAdjacentHTML("beforeend", `<td>${flexPeak.rankText}</td>`);
    document.getElementById("row-peak-flex-games").insertAdjacentHTML("beforeend", `<td>${flexPeak.gamesText}</td>`);
}

async function loadAllProfiles() {
    const statusMsg = document.getElementById("status-msg");
    const rows = [
        "row-name", "row-player", "row-level", 
        "row-solo", "row-peak-solo", "row-peak-solo-games",
        "row-flex", "row-peak-flex", "row-peak-flex-games",
        "row-fives", "row-top5", "row-champs", "row-points"
    ];

    // Clear previous cells
    rows.forEach(rowId => {
        const tr = document.getElementById(rowId);
        if (tr) {
            while (tr.children.length > 1) {
                tr.removeChild(tr.lastChild);
            }
        }
    });

    try {
        await initChampionData();

        for (let i = 0; i < PLAYERS.length; i++) {
            const p = PLAYERS[i];
            statusMsg.innerText = `Loading (${i + 1}/${PLAYERS.length}): ${p.name}...`;
            await fetchPlayerProfile(p);
        }
    } catch (err) {
        console.error(err);
        statusMsg.innerText = `Error: ${err.message}`;
    }
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

    if (isApex) return `${tierShort} ${entry.leaguePoints} LP`;

    const divShort = divisionMap[entry.rank] || entry.rank || "";
    return `${tierShort}${divShort} ${entry.leaguePoints} LP`;
}

function formatPoints(pts) {
    if (pts >= 1_000_000) return (pts / 1_000_000).toFixed(2) + "M";
    return Math.round(pts / 1000) + "K";
}

const TIER_ORDER = {
    IRON: 0, BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4,
    EMERALD: 5, DIAMOND: 6, MASTER: 7, GRANDMASTER: 8, CHALLENGER: 9
};

const DIV_ORDER = { IV: 0, III: 1, II: 2, I: 3 };

function getRankScore(entry) {
    if (!entry || !entry.tier) return -1;
    const tierVal = (TIER_ORDER[entry.tier.toUpperCase()] ?? 0) * 10000;
    const divVal = (DIV_ORDER[entry.rank] ?? 0) * 100;
    const lpVal = entry.leaguePoints ?? entry.lp ?? 0;
    return tierVal + divVal + lpVal;
}

function computePeak(currentEntry, baselinePeak) {
    const currentYear = new Date().getFullYear();
    const currentScore = getRankScore(currentEntry);
    const baselineScore = getRankScore(baselinePeak);

    let peak = baselinePeak;

    if (currentEntry && (baselinePeak.year === currentYear || currentScore > baselineScore)) {
        const liveWins = currentEntry.wins || 0;
        const liveLosses = currentEntry.losses || 0;
        const liveTotal = liveWins + liveLosses;

        if (currentScore > baselineScore) {
            peak = {
                tier: currentEntry.tier,
                rank: currentEntry.rank,
                lp: currentEntry.leaguePoints,
                year: currentYear,
                games: liveTotal,
                wins: liveWins,
                losses: liveLosses
            };
        } else {
            peak = {
                ...baselinePeak,
                games: liveTotal,
                wins: liveWins,
                losses: liveLosses
            };
        }
    }

    const rankStr = formatRank({ tier: peak.tier, rank: peak.rank, leaguePoints: peak.lp });
    const isCurrentYear = peak.year === currentYear;
    const yearFormatted = isCurrentYear ? `<strong>(${peak.year})</strong>` : `(${peak.year})`;

    return {
        rankText: `${rankStr} ${yearFormatted}`,
        gamesText: `${peak.games} (${peak.wins}W ${peak.losses}L)`
    };
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("load-all-btn").addEventListener("click", loadAllProfiles);
    // Automatically fetch on page load
    loadAllProfiles();
});