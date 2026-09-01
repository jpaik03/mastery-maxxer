import { PROFILE_TABLE_ROW_IDS } from "../config/players.js";
import {
    formatPoints,
    compareValues,
    updateHeaderSortArrows,
} from "../utils/formatters.js";
import { getChampIconUrl } from "../champData.js";

let profileLeaderboardData = [];
let currentProfileSortKey = "soloScore";
let currentProfileSortAsc = false;

export function setProfileData(data) {
    profileLeaderboardData = data;
}

export function buildTop10MasteryHtml(masteries, championMap) {
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

export function buildProfileLeaderboardRowHtml(p) {
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

export function clearProfileTables() {
    PROFILE_TABLE_ROW_IDS.forEach((rowId) => {
        const tr = document.getElementById(rowId);
        if (tr) {
            while (tr.children.length > 1) {
                tr.removeChild(tr.lastChild);
            }
        }
    });
}

export function appendProfileTableColumns(profileData) {
    const { name, account, summoner, soloText, top10Text, soloPeak } =
        profileData;
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

export function renderProfileLeaderboard() {
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

export function setupProfileLeaderboardSorting() {
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
