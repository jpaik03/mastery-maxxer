import { PLAYERS, ROLE_ICON_MAP } from "../config/players.js";
import { fetchRoleLeaderboard } from "../riotAPI.js";
import { getChampIconUrl } from "../champData.js";
import {
    getWinrateHighlightClass,
    getKdaHighlightClass,
    updateHeaderSortArrows,
} from "../utils/formatters.js";

let roleLeaderboardData = [];
let currentRoleSortKey = "wr";
let currentRoleSortAsc = false;
let roleShowAllGames = false;
let roleVisibleCount = 10;
let roleIsShowAllExpanded = false;
let selectedRole = null;

export function buildRoleLeaderboardRowHtml(player, championMap = {}) {
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

export function renderRoleLeaderboard(championMap = {}) {
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

    let rowsHtml = visiblePlayers
        .map((p) => buildRoleLeaderboardRowHtml(p, championMap))
        .join("");

    if (sortedPlayers.length > 10) {
        if (roleIsShowAllExpanded) {
            rowsHtml += `
                <tr id="role-action-row" class="table-action-row">
                    <td colspan="8">
                        <span id="role-show-less-btn" class="duo-action-btn">
                            <strong>Show top 10 only ▲</strong>
                        </span>
                    </td>
                </tr>`;
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
                </tr>`;
        }
    }

    tbody.innerHTML = rowsHtml;
    updateHeaderSortArrows(
        "#role-leaderboard",
        currentRoleSortKey,
        currentRoleSortAsc,
    );
}

export async function loadRoleLeaderboard(
    role = selectedRole,
    championMap = {},
) {
    selectedRole = role;
    const iconContainer = document.getElementById("role-icon-container");

    if (!role) {
        if (iconContainer) iconContainer.innerHTML = "";
        roleLeaderboardData = [];
        renderRoleLeaderboard(championMap);
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

        renderRoleLeaderboard(championMap);
    } catch (error) {
        console.error(error);
    }
}

export function setupRoleLeaderboard(getChampMapRef) {
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
        loadRoleLeaderboard(role, getChampMapRef());
    });

    document.addEventListener("mousedown", (e) => {
        if (!container?.contains(e.target)) dropdown?.classList.remove("open");
    });

    showAllCb?.addEventListener("change", (e) => {
        roleShowAllGames = e.target.checked;
        roleVisibleCount = 10;
        roleIsShowAllExpanded = false;
        renderRoleLeaderboard(getChampMapRef());
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
                renderRoleLeaderboard(getChampMapRef());
            });
        });

    tbody?.addEventListener("click", (e) => {
        if (e.target.closest("#role-show-more-btn")) {
            roleVisibleCount += 10;
            renderRoleLeaderboard(getChampMapRef());
        } else if (e.target.closest("#role-show-all-btn")) {
            roleIsShowAllExpanded = true;
            renderRoleLeaderboard(getChampMapRef());
        } else if (e.target.closest("#role-show-less-btn")) {
            roleIsShowAllExpanded = false;
            roleVisibleCount = 10;
            renderRoleLeaderboard(getChampMapRef());
        }
    });
}
