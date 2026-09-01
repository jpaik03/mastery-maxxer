import {
    TIER_ORDER,
    DIV_ORDER,
    TIER_ABBREVIATIONS,
    DIVISION_NUMBERS,
} from "../config/players.js";

export function getRankIconImg(tier) {
    if (!tier) return "";
    const formattedTier =
        tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
    return `<img src="/images/icons_rank/Rank_${formattedTier}.png" alt="${tier}" class="rank-icon" />`;
}

export function formatRank(entry) {
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

export function formatPeakDisplay(peak) {
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

export function formatPoints(pts) {
    if (pts >= 1_000_000) return (pts / 1_000_000).toFixed(2) + "M";
    return (pts / 1000).toFixed(1) + "K";
}

export function getRankScore(entry) {
    if (!entry || !entry.tier) return -1;
    const tierVal = (TIER_ORDER[entry.tier.toUpperCase()] ?? 0) * 10000;
    const divVal = (DIV_ORDER[entry.rank] ?? 0) * 100;
    const lpVal = entry.leaguePoints ?? 0;
    return tierVal + divVal + lpVal;
}

export function compareValues(a, b, key, isAscending) {
    const valA = key && typeof a === "object" && a !== null ? a[key] : a;
    const valB = key && typeof b === "object" && b !== null ? b[key] : b;

    if (typeof valA === "string" && typeof valB === "string") {
        const cmp = valA.localeCompare(valB);
        if (cmp !== 0) return isAscending ? cmp : -cmp;
    } else {
        const numA = typeof valA === "number" ? valA : 0;
        const numB = typeof valB === "number" ? valB : 0;
        const diff = numA - numB;
        if (diff !== 0) return isAscending ? diff : -diff;
    }

    const nameA = a?.name || "";
    const nameB = b?.name || "";
    return nameA.localeCompare(nameB);
}

export function parseWinrate(statStr) {
    if (!statStr || statStr === "0") return -1;
    const match = statStr.match(/\(([\d.]+)%\)/);
    return match ? parseFloat(match[1]) : -1;
}

export function parseGamesCount(statStr) {
    if (!statStr || statStr === "0") return 0;
    const match = statStr.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

export function getWinrateHighlightClass(wr, games) {
    if (!games || games === 0 || wr < 0) return "";
    if (wr > 50) return "wr-positive";
    if (wr < 50) return "wr-negative";
    return "";
}

export function getKdaHighlightClass(kdaRatio, games) {
    if (!games || games === 0) return "";
    if (kdaRatio > 1.0) return "wr-positive";
    if (kdaRatio < 1.0) return "wr-negative";
    return "";
}

export function updateHeaderSortArrows(
    tableSelector,
    activeSortKey,
    isAscending,
) {
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
