import { PLAYERS } from "../config/players.js";
import { fetchChampionLeaderboard } from "../riotAPI.js";
import { getChampIconUrl } from "../champData.js";
import {
    getWinrateHighlightClass,
    getKdaHighlightClass,
    updateHeaderSortArrows,
} from "../utils/formatters.js";

let championLeaderboardData = [];
let currentChampionSortKey = "wr";
let currentChampionSortAsc = false;
let championShowAllGames = false;
let championVisibleCount = 10;
let championIsShowAllExpanded = false;

export function renderChampionDropdownOptions(
    sortedChampionList,
    filterText = "",
) {
    const dropdown = document.getElementById("champion-dropdown");
    if (!dropdown) return;

    const cleanFilter = filterText.replace(/['’]/g, "").toLowerCase().trim();
    const filtered = sortedChampionList.filter(({ name }) =>
        name.replace(/['’]/g, "").toLowerCase().includes(cleanFilter),
    );

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

export function buildChampionLeaderboardRowHtml(player) {
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

export function renderChampionLeaderboard() {
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
            if (p.winRate !== prev.winRate || p.games !== prev.games)
                currentRank = index + 1;
        }
        return { ...p, displayRank: currentRank };
    });

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
                </tr>`;
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
                </tr>`;
        }
    }

    tbody.innerHTML = rowsHtml;
    updateHeaderSortArrows(
        "#champion-leaderboard",
        currentChampionSortKey,
        currentChampionSortAsc,
    );
}

export async function loadChampionLeaderboard(
    explicitChampionId = null,
    championMap = {},
    championNameToIdMap = {},
) {
    const searchInput = document.getElementById("champion-search");
    const iconContainer = document.getElementById("champion-icon-container");

    const query = searchInput?.value?.trim().toLowerCase();
    const championId = explicitChampionId || championNameToIdMap[query];

    if (!championId) return;

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

export function setupChampionLeaderboard(
    getSortedChampions,
    getChampMapRef,
    getChampNameToIdRef,
) {
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
        renderChampionDropdownOptions(getSortedChampions(), searchInput.value);
        dropdown?.classList.add("open");
        searchInput.select();
    });

    searchInput?.addEventListener("input", () => {
        renderChampionDropdownOptions(getSortedChampions(), searchInput.value);
        dropdown?.classList.add("open");
        championVisibleCount = 10;
        championIsShowAllExpanded = false;
        loadChampionLeaderboard(null, getChampMapRef(), getChampNameToIdRef());
    });

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
        loadChampionLeaderboard(
            championId,
            getChampMapRef(),
            getChampNameToIdRef(),
        );
    });

    document.addEventListener("mousedown", (e) => {
        if (!container?.contains(e.target)) dropdown?.classList.remove("open");
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
