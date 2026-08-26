/*
 *  server.js
 *  Justin Paik
 *  Created: 16 March 2025
 *  Last Updated: 26 August 2026
 *  Express server and Riot API proxy endpoints
 */

require("dotenv").config();

const express = require("express");
const axios = require("axios");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.API_KEY;
const REGION = process.env.REGION || "americas";
const PLATFORM = process.env.PLATFORM || "na1";

const regionalClient = axios.create({
    baseURL: `https://${REGION}.api.riotgames.com`,
    headers: { "X-Riot-Token": API_KEY },
});

const platformClient = axios.create({
    baseURL: `https://${PLATFORM}.api.riotgames.com`,
    headers: { "X-Riot-Token": API_KEY },
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
);

const SEASON_2026_START = 1767873600;

const RANKED_FLEX_QUEUE_ID = 440;
const RANKED_FIVES_QUEUE_ID = 710;

const TRACKED_PUUIDS = new Set([
    "wUX2hh9YBwf66OZjsn6SauURG6dyrYsBklTqHvMv6f-EMlcKH87g_lds17PEVnbEd26gsJOwQQB1kg",
    "VTe2huNS57BFU3WuCefKyC_cqGjkExvB4enPSS4R5YXKXru5jFCdMPz_3HtirYPs8AqFjnalrQO95w",
    "G6MhoNnrm8HYJ87lfJTEIoggCPb2_3Mr68Eh2OJGJeio972UwKnbzkDZUDxHcQZOoJz5rJbtWUMRlQ",
    "81RQTX37Hxdj7i9V4UTljdySmsyj82OuiExAEOze3XohGnyUGR9etyTnjLohw87p9U-QjxMmONbEcg",
    "fSOoEFLuNqQlp7gY8RFUTQ2LnJpV3LcnapcRp1RDtn_CrLbaTM2bPsCzcic74Kk_QfeDjfwKHVtVsg",
    "TV09seitjrdYEiKToxrCA7rh_GN_wir_j_yZ3fmRS4Al1zpERQ6pvHzIy5dqqdDsRGyuk4DfoIDpsg",
    "6cwqYAckOFIdB4qJoFEvKohj9zIG_HveDYMSaOJx4oNndYnbygmKvbZSbMfrPww6xYbTYUrFNy4zkQ",
    "9pLcWyTNsCHIA6GtYarC4ZKV02JDXyWPGY8fTzQKQ06oqgAMJ17_C2CAGrM5HvGiWBFqiH5U1GYyqg",
    "5-1YXAqBrJ9JtM311w5RQRBDwyr0AWf2k-m9OouPheTZNuAPbB6MsKN-EncpjlWm2G98mX-WDdrOBA",
    "S3-ROibvQqYney-A0xvuYXH4J8mO1_-ZWU0I20ZKNw452ioyJlrg5ZLrcf2tNWLPFAkQsPsvIMbRUw",
]);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/js", express.static(path.join(__dirname, "src/js")));
app.use("/css", express.static(path.join(__dirname, "src/css")));

const handleApiError = (res, error, defaultMsg) => {
    const status = error.response?.status || 500;
    const message =
        error.response?.data?.status?.message ||
        error.message ||
        defaultMsg;

    console.error(`API Error [${status}]:`, error.message);
    return res.status(status).json({ error: message });
};

async function fetchWithRetry(requestFn) {
    try {
        return await requestFn();
    } catch (error) {
        if (error.response?.status === 429) {
            const retryAfter = parseInt(
                error.response.headers["retry-after"] || "5",
                10,
            );

            console.log(
                `Rate limit reached. Waiting ${retryAfter}s before retrying...`,
            );

            await new Promise((resolve) =>
                setTimeout(
                    resolve,
                    (retryAfter + 1) * 1000,
                ),
            );

            return await fetchWithRetry(requestFn);
        }

        throw error;
    }
}

/* RIOT API ROUTES */

app.get("/api/account-by-puuid", async (req, res) => {
    const { puuid } = req.query;

    if (!puuid) {
        return res.status(400).json({
            error: "PUUID required",
        });
    }

    try {
        const response = await regionalClient.get(
            `/riot/account/v1/accounts/by-puuid/${puuid}`,
        );

        res.json(response.data);
    } catch (error) {
        handleApiError(
            res,
            error,
            "Failed to fetch Riot account by PUUID",
        );
    }
});

app.get("/api/account-by-riot-id", async (req, res) => {
    const { gameName, tagLine } = req.query;

    if (!gameName || !tagLine) {
        return res.status(400).json({
            error: "Missing gameName or tagLine",
        });
    }

    try {
        const response = await regionalClient.get(
            `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
                gameName,
            )}/${encodeURIComponent(tagLine)}`,
        );

        res.json(response.data);
    } catch (error) {
        handleApiError(
            res,
            error,
            "Failed to fetch Riot account by Riot ID",
        );
    }
});

app.get("/api/summoner-by-puuid", async (req, res) => {
    const { puuid } = req.query;

    if (!puuid) {
        return res.status(400).json({
            error: "PUUID required",
        });
    }

    try {
        const response = await platformClient.get(
            `/lol/summoner/v4/summoners/by-puuid/${puuid}`,
        );

        res.json(response.data);
    } catch (error) {
        handleApiError(
            res,
            error,
            "Failed to fetch summoner info",
        );
    }
});

app.get("/api/ranked-by-puuid", async (req, res) => {
    const { puuid } = req.query;

    if (!puuid) {
        return res.status(400).json({
            error: "PUUID required",
        });
    }

    try {
        const response = await platformClient.get(
            `/lol/league/v4/entries/by-puuid/${puuid}`,
        );

        res.json(response.data);
    } catch (error) {
        handleApiError(
            res,
            error,
            "Failed to fetch ranked entries",
        );
    }
});

app.get("/api/champion-mastery", async (req, res) => {
    const { puuid, count } = req.query;

    if (!puuid) {
        return res.status(400).json({
            error: "PUUID required",
        });
    }

    try {
        const endpoint = count
            ? `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`
            : `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`;

        const response = await platformClient.get(endpoint);
        res.json(response.data);
    } catch (error) {
        handleApiError(
            res,
            error,
            "Failed to fetch mastery data",
        );
    }
});

app.get("/api/a-champion-mastery", async (req, res) => {
    const { puuid, championId } = req.query;

    if (!puuid || !championId) {
        return res.status(400).json({
            error: "PUUID and championId required",
        });
    }

    try {
        const response = await platformClient.get(
            `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/by-champion/${championId}`,
        );

        res.json(response.data);
    } catch (error) {
        handleApiError(
            res,
            error,
            "Failed to fetch specific champion mastery",
        );
    }
});

app.get("/api/match-history", async (req, res) => {
    const {
        puuid,
        count = 20,
        queue,
        start = 0,
    } = req.query;

    if (!puuid) {
        return res.status(400).json({
            error: "PUUID required",
        });
    }

    try {
        const params = {
            start: Number(start),
            count: Number(count),
        };

        if (queue) {
            params.queue = Number(queue);
        }

        const response = await regionalClient.get(
            `/lol/match/v5/matches/by-puuid/${puuid}/ids`,
            { params },
        );

        res.json(response.data);
    } catch (error) {
        handleApiError(
            res,
            error,
            "Failed to fetch match history",
        );
    }
});

app.get("/api/match-info", async (req, res) => {
    const { matchId } = req.query;

    if (!matchId) {
        return res.status(400).json({
            error: "Match ID required",
        });
    }

    try {
        const response = await regionalClient.get(
            `/lol/match/v5/matches/${matchId}`,
        );

        res.json(response.data);
    } catch (error) {
        handleApiError(
            res,
            error,
            "Failed to fetch match details",
        );
    }
});

/* MATCH INGESTION HELPERS */

function extractPingData(participant) {
    return {
        allIn: participant.allInPings || 0,
        assistMe: participant.assistMePings || 0,
        basic: participant.commandPings || 0,
        danger: participant.dangerPings || 0,
        enemyMissing:
            participant.enemyMissingPings || 0,
        enemyVision:
            participant.enemyVisionPings || 0,
        getBack: participant.getBackPings || 0,
        needVision:
            participant.needVisionPings || 0,
        onMyWay: participant.onMyWayPings || 0,
        push: participant.pushPings || 0,
    };
}

function formatPlayerMatchRecord(
    matchId,
    participant,
    match,
) {
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
        quadra_kills:
            participant.quadraKills || 0,
        penta_kills:
            participant.pentaKills || 0,
        team_id: participant.teamId,
        pings: extractPingData(participant),
        raw_participant: participant,
    };
}

async function fetchMatchIdsByQueue(
    puuid,
    queueId,
    startTime,
) {
    const matchIds = [];
    let start = 0;

    while (true) {
        const response = await fetchWithRetry(() =>
            regionalClient.get(
                `/lol/match/v5/matches/by-puuid/${puuid}/ids`,
                {
                    params: {
                        queue: queueId,
                        startTime,
                        start,
                        count: 100,
                    },
                },
            ),
        );

        const page = response.data || [];
        matchIds.push(...page);

        if (page.length < 100) {
            break;
        }

        start += 100;
    }

    return matchIds;
}


async function ingestPlayerMatches(matchIds) {
    for (const matchId of matchIds) {
        const { count, error: countError } =
            await supabase
                .from("player_matches")
                .select("id", {
                    count: "exact",
                    head: true,
                })
                .eq("match_id", matchId);

        if (countError) {
            throw countError;
        }

        if (count > 0) {
            continue;
        }

        const matchResponse = await fetchWithRetry(
            () =>
                regionalClient.get(
                    `/lol/match/v5/matches/${matchId}`,
                ),
        );

        const match = matchResponse.data;
        const participants =
            match?.info?.participants || [];

        const trackedParticipants =
            participants.filter((participant) =>
                TRACKED_PUUIDS.has(
                    participant.puuid,
                ),
            );

        const rawDuration =
            match.info?.gameDuration || 0;

        const durationInSeconds =
            rawDuration > 10000
                ? Math.floor(rawDuration / 1000)
                : rawDuration;

        const records = [];

        for (const participant of trackedParticipants) {
            const isRemake =
                participant.gameEndedInEarlySurrender ||
                participant.teamEarlySurrendered ||
                (match.info?.endOfGameResult &&
                    match.info.endOfGameResult !==
                        "GameComplete") ||
                durationInSeconds < 300;

            if (!isRemake) {
                records.push(
                    formatPlayerMatchRecord(
                        matchId,
                        participant,
                        match,
                    ),
                );
            }
        }

        if (records.length > 0) {
            const { error } = await supabase
                .from("player_matches")
                .upsert(records, {
                    onConflict: "match_id,puuid",
                });

            if (error) {
                throw error;
            }
        }

        await new Promise((resolve) =>
            setTimeout(resolve, 50),
        );
    }
}

/* STAT AGGREGATION HELPERS */

function aggregateRoleStats(matches) {
    const roles = {
        TOP: { wins: 0, total: 0 },
        JUNGLE: { wins: 0, total: 0 },
        MIDDLE: { wins: 0, total: 0 },
        BOTTOM: { wins: 0, total: 0 },
        UTILITY: { wins: 0, total: 0 },
    };

    let totalWins = 0;

    for (const match of matches || []) {
        const position =
            match.team_position?.toUpperCase();

        if (roles[position]) {
            roles[position].total++;

            if (match.win) {
                roles[position].wins++;
            }
        }

        if (match.win) {
            totalWins++;
        }
    }

    const formatWinRate = (wins, total) => {
        if (total === 0) {
            return "0";
        }

        return `${total} (${(
            (wins / total) *
            100
        ).toFixed(1)}%)`;
    };

    return {
        TOP: formatWinRate(
            roles.TOP.wins,
            roles.TOP.total,
        ),
        JGL: formatWinRate(
            roles.JUNGLE.wins,
            roles.JUNGLE.total,
        ),
        MID: formatWinRate(
            roles.MIDDLE.wins,
            roles.MIDDLE.total,
        ),
        BOT: formatWinRate(
            roles.BOTTOM.wins,
            roles.BOTTOM.total,
        ),
        SUP: formatWinRate(
            roles.UTILITY.wins,
            roles.UTILITY.total,
        ),
        TOTAL: formatWinRate(
            totalWins,
            matches?.length || 0,
        ),
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

    const totals = Object.fromEntries(
        pingKeys.map((key) => [key, 0]),
    );

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
            totalGames > 0
                ? (
                      totals[key] / totalGames
                  ).toFixed(1)
                : "0.0";
    }

    return {
        averages,
        totals,
    };
}

function computeMatchAggregations(matches) {
    const roleStats =
        aggregateRoleStats(matches);

    const {
        averages: pings,
        totals: rawPings,
    } = aggregatePingStats(matches);

    return {
        ...roleStats,
        pings,
        rawPings,
        storedMatchCount:
            matches?.length || 0,
    };
}

/* PEAK RANK HELPERS */

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

const DIV_WEIGHTS = {
    IV: 0,
    III: 1,
    II: 2,
    I: 3,
};

function calculateRankScore(tier, rank, lp) {
    if (!tier) {
        return -1;
    }

    const tierValue =
        (TIER_WEIGHTS[
            tier.toUpperCase()
        ] ?? 0) * 10000;

    const divisionValue =
        (DIV_WEIGHTS[rank] ?? 0) * 100;

    return (
        tierValue +
        divisionValue +
        (lp || 0)
    );
}

function evaluatePeakEntry(
    liveEntry,
    storedPeak,
    queuePrefix,
    currentYear,
) {
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
        const currentScore =
            calculateRankScore(
                liveEntry.tier,
                liveEntry.rank,
                liveEntry.leaguePoints,
            );

        const storedScore =
            calculateRankScore(
                storedPeak.tier,
                storedPeak.rank,
                storedPeak.lp,
            );

        const liveGames =
            (liveEntry.wins || 0) +
            (liveEntry.losses || 0);

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

            updates[
                `${queuePrefix}_tier`
            ] = liveEntry.tier;

            updates[
                `${queuePrefix}_rank`
            ] = liveEntry.rank;

            updates[
                `${queuePrefix}_lp`
            ] = liveEntry.leaguePoints;

            updates[
                `${queuePrefix}_year`
            ] = currentYear;

            updates[
                `${queuePrefix}_games`
            ] = liveGames;

            updates[
                `${queuePrefix}_wins`
            ] = liveEntry.wins;

            updates[
                `${queuePrefix}_losses`
            ] = liveEntry.losses;
        } else if (
            storedPeak.year === currentYear
        ) {
            peak.games = liveGames;
            peak.wins = liveEntry.wins;
            peak.losses =
                liveEntry.losses;

            updates[
                `${queuePrefix}_games`
            ] = liveGames;

            updates[
                `${queuePrefix}_wins`
            ] = liveEntry.wins;

            updates[
                `${queuePrefix}_losses`
            ] = liveEntry.losses;
        }
    }

    return {
        peak,
        updates,
    };
}

/* FLEX DATABASE ROUTES */

app.get("/api/player-flex-stats", async (req, res) => {
    const {
        puuid,
        name,
        gameName,
        tagLine,
    } = req.query;

    if (!puuid) {
        return res.status(400).json({
            error: "PUUID required",
        });
    }

    try {
        // Keep the player's profile information current.
        const { error: playerError } = await supabase
            .from("players")
            .upsert(
                {
                    puuid,
                    name: name || "Unknown",
                    game_name: gameName || "Unknown",
                    tag_line: tagLine || "Unknown",
                },
                {
                    onConflict: "puuid",
                },
            );

        if (playerError) {
            throw playerError;
        }

        // Read existing Queue 440 matches from Supabase.
        // Synchronization happens in /api/sync-roster-ranked.
        const {
            data: flexMatches,
            error: matchError,
        } = await supabase
            .from("player_matches")
            .select("team_position,win,pings")
            .eq("puuid", puuid)
            .eq(
                "queue_id",
                RANKED_FLEX_QUEUE_ID,
            )
            .gte(
                "game_creation",
                SEASON_2026_START * 1000,
            );

        if (matchError) {
            throw matchError;
        }

        res.json(
            computeMatchAggregations(
                flexMatches || [],
            ),
        );
    } catch (error) {
        handleApiError(
            res,
            error,
            "Failed to aggregate Flex stats",
        );
    }
});

app.post("/api/sync-roster-ranked", async (req, res) => {
    try {
        const syncStartedAt = Date.now();
        const uniqueMatchIds = new Set();

        let discoveredFlexMatches = 0;
        let discoveredFivesMatches = 0;

        for (const puuid of TRACKED_PUUIDS) {
            const {
                data: player,
                error: playerError,
            } = await supabase
                .from("players")
                .select("last_synced_at")
                .eq("puuid", puuid)
                .maybeSingle();

            if (playerError) {
                throw playerError;
            }

            const startTime = player?.last_synced_at
                ? Math.floor(
                      player.last_synced_at / 1000,
                  )
                : SEASON_2026_START;

            // Fetch Flex and Ranked 5v5 from the same timestamp.
            const [
                flexMatchIds,
                fivesMatchIds,
            ] = await Promise.all([
                fetchMatchIdsByQueue(
                    puuid,
                    RANKED_FLEX_QUEUE_ID,
                    startTime,
                ),
                fetchMatchIdsByQueue(
                    puuid,
                    RANKED_FIVES_QUEUE_ID,
                    startTime,
                ),
            ]);

            discoveredFlexMatches +=
                flexMatchIds.length;

            discoveredFivesMatches +=
                fivesMatchIds.length;

            for (const matchId of flexMatchIds) {
                uniqueMatchIds.add(matchId);
            }

            for (const matchId of fivesMatchIds) {
                uniqueMatchIds.add(matchId);
            }
        }

        // Store matches from both queues.
        await ingestPlayerMatches(
            Array.from(uniqueMatchIds),
        );

        // Advance the shared timestamp only after both queues
        // have been fetched and saved successfully.
        const { error: timestampError } =
            await supabase
                .from("players")
                .update({
                    last_synced_at: syncStartedAt,
                })
                .in(
                    "puuid",
                    Array.from(TRACKED_PUUIDS),
                );

        if (timestampError) {
            throw timestampError;
        }

        const [
            flexCountResult,
            fivesCountResult,
        ] = await Promise.all([
            supabase
                .from("player_matches")
                .select("id", {
                    count: "exact",
                    head: true,
                })
                .eq(
                    "queue_id",
                    RANKED_FLEX_QUEUE_ID,
                )
                .gte(
                    "game_creation",
                    SEASON_2026_START * 1000,
                ),

            supabase
                .from("player_matches")
                .select("id", {
                    count: "exact",
                    head: true,
                })
                .eq(
                    "queue_id",
                    RANKED_FIVES_QUEUE_ID,
                )
                .gte(
                    "game_creation",
                    SEASON_2026_START * 1000,
                ),
        ]);

        if (flexCountResult.error) {
            throw flexCountResult.error;
        }

        if (fivesCountResult.error) {
            throw fivesCountResult.error;
        }

        res.json({
            success: true,
            syncedAt: syncStartedAt,
            newUniqueMatchCount:
                uniqueMatchIds.size,
            discovered: {
                flex: discoveredFlexMatches,
                rankedFives:
                    discoveredFivesMatches,
            },
            storedPlayerRows: {
                flex:
                    flexCountResult.count || 0,
                rankedFives:
                    fivesCountResult.count || 0,
            },
        });
    } catch (error) {
        handleApiError(
            res,
            error,
            "Failed to synchronize ranked queues",
        );
    }
});

app.get("/api/player-ranked-fives-stats", async (req, res) => {
        const { puuid } = req.query;

        if (!puuid) {
            return res.status(400).json({
                error: "PUUID required",
            });
        }

        try {
            const {
                data: matches,
                error,
            } = await supabase
                .from("player_matches")
                .select(
                    "team_position,win,pings",
                )
                .eq("puuid", puuid)
                .eq(
                    "queue_id",
                    RANKED_FIVES_QUEUE_ID,
                )
                .gte(
                    "game_creation",
                    SEASON_2026_START *
                        1000,
                );

            if (error) {
                throw error;
            }

            res.json(
                computeMatchAggregations(
                    matches || [],
                ),
            );
        } catch (error) {
            handleApiError(
                res,
                error,
                "Failed to aggregate Ranked 5v5 stats",
            );
        }
    },
);

/* PEAK RANK ROUTE */

app.post("/api/player-peaks", async (req, res) => {
    const {
        puuid,
        soloEntry,
        flexEntry,
    } = req.body;

    if (!puuid) {
        return res.status(400).json({
            error: "PUUID required",
        });
    }

    try {
        const {
            data: player,
            error,
        } = await supabase
            .from("players")
            .select("*")
            .eq("puuid", puuid)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!player) {
            return res.status(404).json({
                error: "Player not found",
            });
        }

        const currentYear =
            new Date().getFullYear();

        const storedSolo = {
            tier:
                player.peak_solo_tier,
            rank:
                player.peak_solo_rank,
            lp: player.peak_solo_lp,
            year:
                player.peak_solo_year,
            games:
                player.peak_solo_games,
            wins:
                player.peak_solo_wins,
            losses:
                player.peak_solo_losses,
        };

        const storedFlex = {
            tier:
                player.peak_flex_tier,
            rank:
                player.peak_flex_rank,
            lp: player.peak_flex_lp,
            year:
                player.peak_flex_year,
            games:
                player.peak_flex_games,
            wins:
                player.peak_flex_wins,
            losses:
                player.peak_flex_losses,
        };

        const {
            peak: peakSolo,
            updates: soloUpdates,
        } = evaluatePeakEntry(
            soloEntry,
            storedSolo,
            "peak_solo",
            currentYear,
        );

        const {
            peak: peakFlex,
            updates: flexUpdates,
        } = evaluatePeakEntry(
            flexEntry,
            storedFlex,
            "peak_flex",
            currentYear,
        );

        const updates = {
            ...soloUpdates,
            ...flexUpdates,
        };

        if (
            Object.keys(updates).length >
            0
        ) {
            const { error } =
                await supabase
                    .from("players")
                    .update(updates)
                    .eq("puuid", puuid);

            if (error) {
                throw error;
            }
        }

        res.json({
            peakSolo,
            peakFlex,
        });
    } catch (error) {
        handleApiError(
            res,
            error,
            "Failed to update peaks",
        );
    }
});

/* STATIC HTML ROUTES */

app.get("/MasteryMaxxer", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "MasteryMaxxer.html",
        ),
    );
});

app.get("/Comparer", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "Comparer.html",
        ),
    );
});

app.get("/Johnsons", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "Johnsons.html",
        ),
    );
});

/* SERVER INITIALIZATION */

app.listen(PORT, () => {
    console.log(
        `Server running at http://localhost:${PORT}/Johnsons`,
    );
});