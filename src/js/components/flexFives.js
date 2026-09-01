import {
    compareValues,
    getWinrateHighlightClass,
    updateHeaderSortArrows,
} from "../utils/formatters.js";

let fivesLeaderboardData = [];
let fivesLeaderboardMode = "wr";
let currentFivesSortKey = "name";
let currentFivesSortAsc = true;

let flexLeaderboardData = [];
let flexLeaderboardMode = "wr";
let currentFlexSortKey = "name";
let currentFlexSortAsc = true;

export function setFivesData(data) {
    fivesLeaderboardData = data;
}
export function setFlexData(data) {
    flexLeaderboardData = data;
}

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

export function buildFivesLeaderboardRowHtml(p) {
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

export function buildFlexLeaderboardRowHtml(p) {
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

export function renderFivesLeaderboard() {
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

export function renderFlexLeaderboard() {
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

export function setupSharedRankedSorting() {
    const sharedSelect = document.getElementById("ranked-shared-mode-select");
    sharedSelect?.addEventListener("change", (e) => {
        fivesLeaderboardMode = e.target.value;
        flexLeaderboardMode = e.target.value;
        renderFivesLeaderboard();
        renderFlexLeaderboard();
    });
}

export function setupFivesLeaderboardSorting() {
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

export function setupFlexLeaderboardSorting() {
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
