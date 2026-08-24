import {
    fetchRiotAccountByPuuid,
    fetchSummonerData,
    fetchRankedData,
    fetchMasteryData,
    fetchFlexStats,
    syncAndFetchPlayerPeaks
} from "./riotAPI.js";
import { getChampMap } from "./champData.js";

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
    const rankStr = formatRank({ tier: peak.tier, rank: peak.rank, leaguePoints: peak.lp });
    const isCurrentYear = peak.year === currentYear;
    const yearFormatted = isCurrentYear ? `<strong>(${peak.year})</strong>` : `(${peak.year})`;

    return {
        rankText: `${rankStr} ${yearFormatted}`,
        gamesText: `${peak.games || 0} (${peak.wins || 0}W ${peak.losses || 0}L)`
    };
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

    // Dynamic peak sync from Supabase
    const peakData = await syncAndFetchPlayerPeaks(player.puuid, solo, flex);
    const soloPeak = formatPeakDisplay(peakData.peakSolo);
    const flexPeak = formatPeakDisplay(peakData.peakFlex);

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

    // Append cells
    document.getElementById("row-name").insertAdjacentHTML("beforeend", `<td><strong>${player.name}</strong></td>`);
    document.getElementById("row-player").insertAdjacentHTML("beforeend", `<td>${account.gameName}#${account.tagLine}</td>`);
    document.getElementById("row-level").insertAdjacentHTML("beforeend", `<td>${summoner.summonerLevel}</td>`);
    document.getElementById("row-solo").insertAdjacentHTML("beforeend", `<td>${soloText}</td>`);
    document.getElementById("row-peak-solo").insertAdjacentHTML("beforeend", `<td>${soloPeak.rankText}</td>`);
    document.getElementById("row-peak-solo-games").insertAdjacentHTML("beforeend", `<td>${soloPeak.gamesText}</td>`);
    document.getElementById("row-flex").insertAdjacentHTML("beforeend", `<td>${flexText}</td>`);
    document.getElementById("row-peak-flex").insertAdjacentHTML("beforeend", `<td>${flexPeak.rankText}</td>`);
    document.getElementById("row-peak-flex-games").insertAdjacentHTML("beforeend", `<td>${flexPeak.gamesText}</td>`);
    document.getElementById("row-fives").insertAdjacentHTML("beforeend", `<td>${fivesText}</td>`);
    document.getElementById("row-top5").insertAdjacentHTML("beforeend", `<td>${top5Text}</td>`);
    document.getElementById("row-champs").insertAdjacentHTML("beforeend", `<td>${playedChampsCount}</td>`);
    document.getElementById("row-points").insertAdjacentHTML("beforeend", `<td>${totalPointsText}</td>`);
    document.getElementById("row-flex-top").insertAdjacentHTML("beforeend", `<td>${flexStats.TOP || "0"}</td>`);
    document.getElementById("row-flex-jgl").insertAdjacentHTML("beforeend", `<td>${flexStats.JGL || "0"}</td>`);
    document.getElementById("row-flex-mid").insertAdjacentHTML("beforeend", `<td>${flexStats.MID || "0"}</td>`);
    document.getElementById("row-flex-bot").insertAdjacentHTML("beforeend", `<td>${flexStats.BOT || "0"}</td>`);
    document.getElementById("row-flex-sup").insertAdjacentHTML("beforeend", `<td>${flexStats.SUP || "0"}</td>`);
    document.getElementById("row-flex-total").insertAdjacentHTML("beforeend", `<td>${flexStats.TOTAL || "0"}</td>`);
}

async function loadAllProfiles() {
    const statusMsg = document.getElementById("status-msg");
    const rows = [
        "row-name", "row-player", "row-level", 
        "row-solo", "row-peak-solo", "row-peak-solo-games", "row-flex",
        "row-peak-flex", "row-peak-flex-games", "row-fives", "row-top5",
        "row-champs", "row-points", "row-flex-top", "row-flex-jgl",
        "row-flex-mid", "row-flex-bot", "row-flex-sup", "row-flex-total"
    ];

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
        statusMsg.innerText = "";
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

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("load-all-btn").addEventListener("click", loadAllProfiles);
    loadAllProfiles();
});