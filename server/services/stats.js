function normalizePosition(pos) {
    if (!pos) return "UNKNOWN";
    const p = pos.toUpperCase();
    if (p === "TOP") return "TOP";
    if (p === "JUNGLE" || p === "JGL") return "JUNGLE";
    if (p === "MIDDLE" || p === "MID") return "MIDDLE";
    if (p === "BOTTOM" || p === "BOT") return "BOTTOM";
    if (p === "UTILITY" || p === "SUP" || p === "SUPPORT") return "UTILITY";
    return "UNKNOWN";
}

function aggregateRoleStats(matches) {
    const roles = {
        TOP: { wins: 0, total: 0 },
        JUNGLE: { wins: 0, total: 0 },
        MIDDLE: { wins: 0, total: 0 },
        BOTTOM: { wins: 0, total: 0 },
        UTILITY: { wins: 0, total: 0 },
    };

    let totalWins = 0;
    let totalGames = 0;

    for (const match of matches || []) {
        if (match.raw_participant?.gameEndedInEarlySurrender) continue;

        const position = normalizePosition(match.team_position);
        if (roles[position]) {
            roles[position].total++;
            if (match.win) roles[position].wins++;
        }

        totalGames++;
        if (match.win) totalWins++;
    }

    const formatWinRate = (wins, total) =>
        total === 0 ? "0" : `${total} (${((wins / total) * 100).toFixed(1)}%)`;

    return {
        TOP: formatWinRate(roles.TOP.wins, roles.TOP.total),
        JGL: formatWinRate(roles.JUNGLE.wins, roles.JUNGLE.total),
        MID: formatWinRate(roles.MIDDLE.wins, roles.MIDDLE.total),
        BOT: formatWinRate(roles.BOTTOM.wins, roles.BOTTOM.total),
        SUP: formatWinRate(roles.UTILITY.wins, roles.UTILITY.total),
        TOTAL: formatWinRate(totalWins, totalGames),
    };
}

function aggregatePingStats(matches) {
    const pingKeys = [
        "allIn",
        "assistMe",
        "basic",
        "danger",
        "enemyMissing",
        "enemyVision",
        "getBack",
        "needVision",
        "onMyWay",
        "push",
    ];

    const totals = Object.fromEntries(pingKeys.map((key) => [key, 0]));
    totals.total = 0;

    for (const match of matches || []) {
        const pings = match.pings || {};
        let matchTotal = 0;

        for (const key of pingKeys) {
            const value = pings[key] || 0;
            totals[key] += value;
            matchTotal += value;
        }

        totals.total += matchTotal;
    }

    const totalGames = matches?.length || 0;
    const averages = {};

    for (const key of [...pingKeys, "total"]) {
        averages[key] =
            totalGames > 0 ? (totals[key] / totalGames).toFixed(1) : "0.0";
    }

    return { averages, totals };
}

function computeMatchAggregations(matches) {
    const roleStats = aggregateRoleStats(matches);
    const { averages: pings, totals: rawPings } = aggregatePingStats(matches);

    return {
        ...roleStats,
        pings,
        rawPings,
        storedMatchCount: matches?.length || 0,
    };
}

module.exports = {
    normalizePosition,
    aggregateRoleStats,
    aggregatePingStats,
    computeMatchAggregations,
};
