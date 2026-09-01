const supabase = require("../config/supabase");
const {
    regionalClient,
    fetchWithRetry,
    RANKED_FLEX_QUEUE_ID,
    RANKED_FIVES_QUEUE_ID,
    TRACKED_PUUIDS,
} = require("../config/riot");

function extractPingData(participant) {
    return {
        allIn: participant.allInPings || 0,
        assistMe: participant.assistMePings || 0,
        basic: participant.commandPings || 0,
        danger: participant.dangerPings || 0,
        enemyMissing: participant.enemyMissingPings || 0,
        enemyVision: participant.enemyVisionPings || 0,
        getBack: participant.getBackPings || 0,
        needVision: participant.needVisionPings || 0,
        onMyWay: participant.onMyWayPings || 0,
        push: participant.pushPings || 0,
    };
}

function formatPlayerMatchRecord(matchId, participant, match) {
    return {
        match_id: matchId,
        puuid: participant.puuid,
        queue_id: match.info.queueId,
        game_creation: match.info.gameCreation,
        champion_id: participant.championId,
        champion_name: participant.championName,
        team_position:
            participant.individualPosition ||
            participant.teamPosition ||
            "UNKNOWN",
        win: Boolean(participant.win),
        quadra_kills: participant.quadraKills || 0,
        penta_kills: participant.pentaKills || 0,
        team_id: participant.teamId,
        pings: extractPingData(participant),
        raw_participant: participant,
    };
}

async function fetchMatchIdsByQueue(puuid, queueId, startTime) {
    const matchIds = [];
    let start = 0;

    while (true) {
        const response = await fetchWithRetry(() =>
            regionalClient.get(`/lol/match/v5/matches/by-puuid/${puuid}/ids`, {
                params: { queue: queueId, startTime, start, count: 100 },
            }),
        );
        const page = response.data || [];
        matchIds.push(...page);
        if (page.length < 100) break;
        start += 100;
    }

    return matchIds;
}

async function ingestPlayerMatches(matchIds) {
    const uniqueIds = Array.from(new Set(matchIds));

    for (const matchId of uniqueIds) {
        const { data: existing, error: countError } = await supabase
            .from("player_matches")
            .select("id")
            .eq("match_id", matchId)
            .limit(1);

        if (countError) throw countError;
        if (existing && existing.length > 0) continue;

        const matchResponse = await fetchWithRetry(() =>
            regionalClient.get(`/lol/match/v5/matches/${matchId}`),
        );
        const match = matchResponse.data;
        const participants = match?.info?.participants || [];
        const trackedParticipants = participants.filter((p) =>
            TRACKED_PUUIDS.has(p.puuid),
        );

        const rawDuration = match.info?.gameDuration || 0;
        const durationInSeconds =
            rawDuration > 10000 ? Math.floor(rawDuration / 1000) : rawDuration;

        const records = [];
        for (const participant of trackedParticipants) {
            const isRemake =
                participant.gameEndedInEarlySurrender ||
                participant.teamEarlySurrendered ||
                (match.info?.endOfGameResult &&
                    match.info.endOfGameResult !== "GameComplete") ||
                durationInSeconds < 300;

            if (!isRemake) {
                records.push(
                    formatPlayerMatchRecord(matchId, participant, match),
                );
            }
        }

        if (records.length > 0) {
            const { error } = await supabase
                .from("player_matches")
                .upsert(records, { onConflict: "match_id,puuid" });
            if (error) throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}

async function discoverRosterRankedMatchIds(trackedPuuids, seasonStartTime) {
    const uniqueMatchIds = new Set();
    let discoveredFlex = 0;
    let discoveredFives = 0;

    const playerTasks = Array.from(trackedPuuids).map(async (puuid) => {
        const { data: player, error: playerError } = await supabase
            .from("players")
            .select("last_synced_at")
            .eq("puuid", puuid)
            .maybeSingle();

        if (playerError) throw playerError;

        const startTime = player?.last_synced_at
            ? Math.floor(player.last_synced_at / 1000)
            : seasonStartTime;

        const [flexMatchIds, fivesMatchIds] = await Promise.all([
            fetchMatchIdsByQueue(puuid, RANKED_FLEX_QUEUE_ID, startTime),
            fetchMatchIdsByQueue(puuid, RANKED_FIVES_QUEUE_ID, startTime),
        ]);

        return { flexMatchIds, fivesMatchIds };
    });

    const results = await Promise.all(playerTasks);

    for (const { flexMatchIds, fivesMatchIds } of results) {
        discoveredFlex += flexMatchIds.length;
        discoveredFives += fivesMatchIds.length;
        flexMatchIds.forEach((id) => uniqueMatchIds.add(id));
        fivesMatchIds.forEach((id) => uniqueMatchIds.add(id));
    }

    return {
        uniqueMatchIds: Array.from(uniqueMatchIds),
        discovered: { flex: discoveredFlex, rankedFives: discoveredFives },
    };
}

async function updateRosterLastSyncedAt(trackedPuuids, timestamp) {
    const { error } = await supabase
        .from("players")
        .update({ last_synced_at: timestamp })
        .in("puuid", Array.from(trackedPuuids));

    if (error) throw error;
}

async function getStoredRankedRowCounts(seasonStartTime) {
    const [flexResult, fivesResult] = await Promise.all([
        supabase
            .from("player_matches")
            .select("id", { count: "exact", head: true })
            .eq("queue_id", RANKED_FLEX_QUEUE_ID)
            .gte("game_creation", seasonStartTime * 1000),
        supabase
            .from("player_matches")
            .select("id", { count: "exact", head: true })
            .eq("queue_id", RANKED_FIVES_QUEUE_ID)
            .gte("game_creation", seasonStartTime * 1000),
    ]);

    if (flexResult.error) throw flexResult.error;
    if (fivesResult.error) throw fivesResult.error;

    return {
        flex: flexResult.count || 0,
        rankedFives: fivesResult.count || 0,
    };
}

module.exports = {
    ingestPlayerMatches,
    discoverRosterRankedMatchIds,
    updateRosterLastSyncedAt,
    getStoredRankedRowCounts,
};
