import { compareValues, updateHeaderSortArrows } from "../utils/formatters.js";

let pingsLeaderboardData = [];
let pingsDisplayMode = "avg";
let currentPingSortKey = "total";
let currentPingSortAsc = false;

export function setPingsData(data) {
    pingsLeaderboardData = data;
}

function formatPingValue(num, isTotalMode) {
    return isTotalMode ? Math.round(num).toLocaleString() : num.toFixed(1);
}

export function buildPingRowHtml(p, isTotalMode) {
    const src = isTotalMode ? p.raw : p.avg;
    const totalText = isTotalMode
        ? `${formatPingValue(src.total, true)} (${p.gamesCount})`
        : formatPingValue(src.total, false);

    return `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td>${formatPingValue(src.allIn, isTotalMode)}</td>
            <td>${formatPingValue(src.assistMe, isTotalMode)}</td>
            <td>${formatPingValue(src.basic, isTotalMode)}</td>
            <td>${formatPingValue(src.danger, isTotalMode)}</td>
            <td>${formatPingValue(src.enemyMissing, isTotalMode)}</td>
            <td>${formatPingValue(src.enemyVision, isTotalMode)}</td>
            <td>${formatPingValue(src.getBack, isTotalMode)}</td>
            <td>${formatPingValue(src.needVision, isTotalMode)}</td>
            <td>${formatPingValue(src.onMyWay, isTotalMode)}</td>
            <td>${formatPingValue(src.push, isTotalMode)}</td>
            <td><strong>${totalText}</strong></td>
        </tr>
    `;
}

export function renderPingsLeaderboard() {
    const tbody = document.getElementById("pings-leaderboard-body");
    if (!tbody) return;

    const isTotalMode = pingsDisplayMode === "total";

    pingsLeaderboardData.sort((a, b) => {
        const valA =
            currentPingSortKey === "name"
                ? a.name
                : isTotalMode
                  ? a.raw[currentPingSortKey]
                  : a.avg[currentPingSortKey];
        const valB =
            currentPingSortKey === "name"
                ? b.name
                : isTotalMode
                  ? b.raw[currentPingSortKey]
                  : b.avg[currentPingSortKey];

        return compareValues(
            { ...a, _sortVal: valA },
            { ...b, _sortVal: valB },
            "_sortVal",
            currentPingSortAsc,
        );
    });

    tbody.innerHTML = pingsLeaderboardData
        .map((p) => buildPingRowHtml(p, isTotalMode))
        .join("");

    const totalHeader = document.getElementById("pings-total-header");
    if (totalHeader) {
        const arrowSpan =
            totalHeader.querySelector(".sort-arrow")?.outerHTML ||
            '<span class="sort-arrow"></span>';
        totalHeader.innerHTML = `${isTotalMode ? "Total Pings" : "Total Avg"}${arrowSpan}`;
    }

    updateHeaderSortArrows(
        "#pings-leaderboard",
        currentPingSortKey,
        currentPingSortAsc,
    );
}

export function setupPingsLeaderboardSorting() {
    document
        .querySelectorAll("#pings-leaderboard th[data-sort]")
        .forEach((th) => {
            th.addEventListener("click", () => {
                const sortKey = th.getAttribute("data-sort");
                if (currentPingSortKey === sortKey) {
                    currentPingSortAsc = !currentPingSortAsc;
                } else {
                    currentPingSortKey = sortKey;
                    currentPingSortAsc = false;
                }
                renderPingsLeaderboard();
            });
        });

    const modeSelect = document.getElementById("pings-mode-select");
    modeSelect?.addEventListener("change", (e) => {
        pingsDisplayMode = e.target.value;
        renderPingsLeaderboard();
    });
}
