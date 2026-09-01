const supabase = require("../config/supabase");

const TIER_WEIGHTS = {
    IRON: 0,
    BRONZE: 1,
    SILVER: 2,
    GOLD: 3,
    PLATINUM: 4,
    EMERALD: 5,
    DIAMOND: 6,
    MASTER: 7,
    GRANDMASTER: 8,
    CHALLENGER: 9,
};

const DIV_WEIGHTS = { IV: 0, III: 1, II: 2, I: 3 };

function calculateRankScore(tier, rank, lp) {
    if (!tier) return -1;
    const tierValue = (TIER_WEIGHTS[tier.toUpperCase()] ?? 0) * 10000;
    const divisionValue = (DIV_WEIGHTS[rank] ?? 0) * 100;
    return tierValue + divisionValue + (lp || 0);
}

function evaluatePeakEntry(liveEntry, storedPeak, queuePrefix, currentYear) {
    let peak = {
        tier: storedPeak.tier,
        rank: storedPeak.rank,
        lp: storedPeak.lp,
        year: storedPeak.year,
        games: storedPeak.games,
        wins: storedPeak.wins,
        losses: storedPeak.losses,
    };

    const updates = {};

    if (liveEntry?.tier) {
        const currentScore = calculateRankScore(
            liveEntry.tier,
            liveEntry.rank,
            liveEntry.leaguePoints,
        );
        const storedScore = calculateRankScore(
            storedPeak.tier,
            storedPeak.rank,
            storedPeak.lp,
        );
        const liveGames = (liveEntry.wins || 0) + (liveEntry.losses || 0);

        if (currentScore > storedScore) {
            peak = {
                tier: liveEntry.tier,
                rank: liveEntry.rank,
                lp: liveEntry.leaguePoints,
                year: currentYear,
                games: liveGames,
                wins: liveEntry.wins,
                losses: liveEntry.losses,
            };
            updates[`${queuePrefix}_tier`] = liveEntry.tier;
            updates[`${queuePrefix}_rank`] = liveEntry.rank;
            updates[`${queuePrefix}_lp`] = liveEntry.leaguePoints;
            updates[`${queuePrefix}_year`] = currentYear;
            updates[`${queuePrefix}_games`] = liveGames;
            updates[`${queuePrefix}_wins`] = liveEntry.wins;
            updates[`${queuePrefix}_losses`] = liveEntry.losses;
        } else if (storedPeak.year === currentYear) {
            peak.games = liveGames;
            peak.wins = liveEntry.wins;
            peak.losses = liveEntry.losses;
            updates[`${queuePrefix}_games`] = liveGames;
            updates[`${queuePrefix}_wins`] = liveEntry.wins;
            updates[`${queuePrefix}_losses`] = liveEntry.losses;
        }
    }

    return { peak, updates };
}

function extractStoredPeak(player, queuePrefix) {
    return {
        tier: player[`${queuePrefix}_tier`],
        rank: player[`${queuePrefix}_rank`],
        lp: player[`${queuePrefix}_lp`],
        year: player[`${queuePrefix}_year`],
        games: player[`${queuePrefix}_games`],
        wins: player[`${queuePrefix}_wins`],
        losses: player[`${queuePrefix}_losses`],
    };
}

async function evaluateAndPersistPeaks(puuid, player, soloEntry, flexEntry) {
    const currentYear = new Date().getFullYear();

    const storedSolo = extractStoredPeak(player, "peak_solo");
    const storedFlex = extractStoredPeak(player, "peak_flex");

    const { peak: peakSolo, updates: soloUpdates } = evaluatePeakEntry(
        soloEntry,
        storedSolo,
        "peak_solo",
        currentYear,
    );
    const { peak: peakFlex, updates: flexUpdates } = evaluatePeakEntry(
        flexEntry,
        storedFlex,
        "peak_flex",
        currentYear,
    );

    const updates = { ...soloUpdates, ...flexUpdates };

    if (Object.keys(updates).length > 0) {
        const { error } = await supabase
            .from("players")
            .update(updates)
            .eq("puuid", puuid);
        if (error) throw error;
    }

    return { peakSolo, peakFlex };
}

module.exports = {
    evaluateAndPersistPeaks,
};
