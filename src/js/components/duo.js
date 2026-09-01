import { PLAYERS } from "../config/players.js";
import { fetchDuoLeaderboard } from "../riotAPI.js";
import {
    getWinrateHighlightClass,
    updateHeaderSortArrows,
} from "../utils/formatters.js";

let duoLeaderboardData = [];
let currentDuoSortKey = "wr";
let currentDuoSortAsc = false;
let duoShowAllGames = false;
let duoVisibleCount = 10;
let duoIsShowAllExpanded = false;
let duoSelectedPuuid = null;

export function renderDuoPlayerDropdownOptions(filterText = "") {
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

export function renderDuoLeaderboard() {
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
        )
            return false;
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
            if (d.winRate !== prev.winRate || d.games !== prev.games)
                currentRank = index + 1;
        }
        return { ...d, displayRank: currentRank };
    });

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
                </tr>`;
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
                </tr>`;
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
                </tr>`;
        }
    }

    tbody.innerHTML = rowsHtml;
    updateHeaderSortArrows(
        "#duo-leaderboard",
        currentDuoSortKey,
        currentDuoSortAsc,
    );
}

export async function loadDuoLeaderboard() {
    try {
        const result = await fetchDuoLeaderboard();
        duoLeaderboardData = result.duos || [];
        renderDuoLeaderboard();
    } catch (error) {
        console.error(error);
    }
}

export function setupDuoLeaderboard() {
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
        duoSelectedPuuid = option.dataset.puuid || null;
        if (searchInput) searchInput.value = option.dataset.name || "";
        dropdown.classList.remove("open");
        searchInput?.blur();
        renderDuoLeaderboard();
    });

    document.addEventListener("mousedown", (e) => {
        if (!container?.contains(e.target)) dropdown?.classList.remove("open");
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
