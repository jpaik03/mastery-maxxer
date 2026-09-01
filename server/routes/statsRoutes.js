const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const {
    SEASON_2026_START,
    RANKED_FLEX_QUEUE_ID,
    RANKED_FIVES_QUEUE_ID,
    TRACKED_PUUIDS,
    handleApiError,
} = require("../config/riot");
const {
    computeMatchAggregations,
    normalizePosition,
} = require("../services/stats");
const {
    discoverRosterRankedMatchIds,
    ingestPlayerMatches,
    updateRosterLastSyncedAt,
    getStoredRankedRowCounts,
} = require("../services/ingestion");
const { evaluateAndPersistPeaks } = require("../services/peaks");

router.post("/sync-roster-ranked", async (req, res) => {
    try {
        const syncStartedAt = Date.now();
        const { uniqueMatchIds, discovered } =
            await discoverRosterRankedMatchIds(
                TRACKED_PUUIDS,
                SEASON_2026_START,
            );

        await ingestPlayerMatches(uniqueMatchIds);
        await updateRosterLastSyncedAt(TRACKED_PUUIDS, syncStartedAt);
        const storedPlayerRows =
            await getStoredRankedRowCounts(SEASON_2026_START);

        res.json({
            success: true,
            syncedAt: syncStartedAt,
            newUniqueMatchCount: uniqueMatchIds.length,
            discovered,
            storedPlayerRows,
        });
    } catch (error) {
        handleApiError(res, error, "Failed to synchronize ranked queues");
    }
});

router.get("/roster-ranked-stats", async (req, res) => {
    try {
        let allMatches = [];
        let from = 0;
        const step = 1000;

        while (true) {
            const { data, error } = await supabase
                .from("player_matches")
                .select(
                    "puuid,queue_id,team_position,win,pings,game_creation,raw_participant",
                )
                .in("queue_id", [RANKED_FLEX_QUEUE_ID, RANKED_FIVES_QUEUE_ID])
                .gte("game_creation", SEASON_2026_START * 1000)
                .range(from, from + step - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;

            allMatches.push(...data);
            if (data.length < step) break;
            from += step;
        }

        const grouped = {};
        for (const puuid of TRACKED_PUUIDS) {
            grouped[puuid] = { flex: [], fives: [] };
        }

        for (const m of allMatches) {
            if (!grouped[m.puuid]) continue;
            if (m.queue_id === RANKED_FLEX_QUEUE_ID) {
                grouped[m.puuid].flex.push(m);
            } else if (m.queue_id === RANKED_FIVES_QUEUE_ID) {
                grouped[m.puuid].fives.push(m);
            }
        }

        const results = {};
        for (const puuid of TRACKED_PUUIDS) {
            results[puuid] = {
                flex: computeMatchAggregations(grouped[puuid].flex),
                fives: computeMatchAggregations(grouped[puuid].fives),
            };
        }

        res.json(results);
    } catch (error) {
        handleApiError(res, error, "Failed to fetch roster ranked stats");
    }
});

router.get("/champion-leaderboard", async (req, res) => {
    const championId = Number(req.query.championId);
    if (!Number.isInteger(championId) || championId <= 0) {
        return res
            .status(400)
            .json({ error: "A valid championId is required" });
    }

    try {
        const { data: matches, error } = await supabase
            .from("player_matches")
            .select("puuid,win,raw_participant")
            .eq("champion_id", championId)
            .in("queue_id", [RANKED_FLEX_QUEUE_ID, RANKED_FIVES_QUEUE_ID]);

        if (error) throw error;

        const statsByPuuid = new Map();
        for (const match of matches || []) {
            const current = statsByPuuid.get(match.puuid) || {
                puuid: match.puuid,
                wins: 0,
                losses: 0,
                games: 0,
                kills: 0,
                deaths: 0,
                assists: 0,
            };

            current.games += 1;
            if (match.win) current.wins += 1;
            else current.losses += 1;

            const p = match.raw_participant || {};
            current.kills += p.kills || 0;
            current.deaths += p.deaths || 0;
            current.assists += p.assists || 0;

            statsByPuuid.set(match.puuid, current);
        }

        const players = Array.from(statsByPuuid.values()).map((player) => {
            const avgKills = player.games > 0 ? player.kills / player.games : 0;
            const avgDeaths =
                player.games > 0 ? player.deaths / player.games : 0;
            const avgAssists =
                player.games > 0 ? player.assists / player.games : 0;
            const kdaRatio =
                player.deaths === 0
                    ? player.kills + player.assists
                    : (player.kills + player.assists) / player.deaths;

            return {
                ...player,
                winRate:
                    player.games > 0 ? (player.wins / player.games) * 100 : 0,
                avgKills,
                avgDeaths,
                avgAssists,
                kdaRatio,
            };
        });

        res.json({ championId, players });
    } catch (error) {
        handleApiError(res, error, "Failed to aggregate champion leaderboard");
    }
});

router.get("/role-leaderboard", async (req, res) => {
    const role = (req.query.role || "").toUpperCase();
    const validPositions = {
        TOP: ["TOP"],
        JGL: ["JUNGLE", "JGL"],
        MID: ["MIDDLE", "MID"],
        BOT: ["BOTTOM", "BOT"],
        SUP: ["UTILITY", "SUP", "SUPPORT"],
    };

    const targetPositions = validPositions[role];
    if (!targetPositions) {
        return res.status(400).json({ error: "Invalid role specified" });
    }

    try {
        let allMatches = [];
        let from = 0;
        const step = 1000;

        while (true) {
            const { data, error } = await supabase
                .from("player_matches")
                .select(
                    "puuid,team_position,win,raw_participant,match_id,champion_id,champion_name",
                )
                .in("queue_id", [RANKED_FLEX_QUEUE_ID, RANKED_FIVES_QUEUE_ID])
                .gte("game_creation", SEASON_2026_START * 1000)
                .range(from, from + step - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;

            allMatches.push(...data);
            if (data.length < step) break;
            from += step;
        }

        const statsByPuuid = new Map();
        for (const match of allMatches) {
            if (match.raw_participant?.gameEndedInEarlySurrender) continue;
            const pos = normalizePosition(match.team_position);
            const isMatch =
                (role === "TOP" && pos === "TOP") ||
                (role === "JGL" && pos === "JUNGLE") ||
                (role === "MID" && pos === "MIDDLE") ||
                (role === "BOT" && pos === "BOTTOM") ||
                (role === "SUP" && pos === "UTILITY");

            if (!isMatch) continue;

            const current = statsByPuuid.get(match.puuid) || {
                puuid: match.puuid,
                wins: 0,
                losses: 0,
                games: 0,
                kills: 0,
                deaths: 0,
                assists: 0,
                totalCs: 0,
                totalMinutes: 0,
                champMap: new Map(),
            };

            current.games += 1;
            if (match.win) current.wins += 1;
            else current.losses += 1;

            const p = match.raw_participant || {};
            current.kills += p.kills || 0;
            current.deaths += p.deaths || 0;
            current.assists += p.assists || 0;

            const minions = p.totalMinionsKilled || 0;
            const monsters = p.neutralMinionsKilled || 0;
            const cs = minions + monsters;
            const durationSec = p.timePlayed || 0;

            current.totalCs += cs;
            current.totalMinutes += durationSec > 0 ? durationSec / 60 : 0;

            if (match.champion_id) {
                const champStat = current.champMap.get(match.champion_id) || {
                    championId: match.champion_id,
                    championName: match.champion_name || "",
                    games: 0,
                    wins: 0,
                };
                champStat.games += 1;
                if (match.win) champStat.wins += 1;
                current.champMap.set(match.champion_id, champStat);
            }

            statsByPuuid.set(match.puuid, current);
        }

        const players = Array.from(statsByPuuid.values()).map((player) => {
            const avgKills = player.games > 0 ? player.kills / player.games : 0;
            const avgDeaths =
                player.games > 0 ? player.deaths / player.games : 0;
            const avgAssists =
                player.games > 0 ? player.assists / player.games : 0;
            const kdaRatio =
                player.deaths === 0
                    ? player.kills + player.assists
                    : (player.kills + player.assists) / player.deaths;
            const csPerMin =
                player.totalMinutes > 0
                    ? player.totalCs / player.totalMinutes
                    : 0;

            const topChamps = Array.from(player.champMap.values())
                .sort((a, b) => b.games - a.games || b.wins - a.wins)
                .slice(0, 3)
                .map((c) => ({
                    championId: c.championId,
                    championName: c.championName,
                    games: c.games,
                    wins: c.wins,
                    losses: c.games - c.wins,
                    winRate: c.games > 0 ? (c.wins / c.games) * 100 : 0,
                }));

            return {
                ...player,
                winRate:
                    player.games > 0 ? (player.wins / player.games) * 100 : 0,
                avgKills,
                avgDeaths,
                avgAssists,
                kdaRatio,
                csPerMin,
                topChamps,
            };
        });

        res.json({ role, players });
    } catch (error) {
        handleApiError(res, error, "Failed to aggregate role leaderboard");
    }
});

router.get("/duo-leaderboard", async (req, res) => {
    try {
        let allMatches = [];
        let from = 0;
        const step = 1000;

        while (true) {
            const { data, error } = await supabase
                .from("player_matches")
                .select("match_id,team_id,puuid,team_position,win")
                .in("queue_id", [RANKED_FLEX_QUEUE_ID, RANKED_FIVES_QUEUE_ID])
                .gte("game_creation", SEASON_2026_START * 1000)
                .range(from, from + step - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;

            allMatches.push(...data);
            if (data.length < step) break;
            from += step;
        }

        const teamsMap = new Map();
        for (const m of allMatches) {
            const key = `${m.match_id}_${m.team_id}`;
            if (!teamsMap.has(key)) teamsMap.set(key, []);
            teamsMap.get(key).push(m);
        }

        const duosMap = new Map();
        for (const participants of teamsMap.values()) {
            const bot = participants.find(
                (p) => normalizePosition(p.team_position) === "BOTTOM",
            );
            const sup = participants.find(
                (p) => normalizePosition(p.team_position) === "UTILITY",
            );

            if (bot && sup && bot.puuid !== sup.puuid) {
                const pairKey = `${bot.puuid}_${sup.puuid}`;
                if (!duosMap.has(pairKey)) {
                    duosMap.set(pairKey, {
                        botPuuid: bot.puuid,
                        supPuuid: sup.puuid,
                        wins: 0,
                        losses: 0,
                        games: 0,
                    });
                }

                const duo = duosMap.get(pairKey);
                duo.games += 1;
                if (bot.win) duo.wins += 1;
                else duo.losses += 1;
            }
        }

        const duos = Array.from(duosMap.values()).map((d) => ({
            ...d,
            winRate: d.games > 0 ? (d.wins / d.games) * 100 : 0,
        }));

        res.json({ duos });
    } catch (error) {
        handleApiError(res, error, "Failed to aggregate duo leaderboard");
    }
});

router.post("/player-peaks", async (req, res) => {
    const { puuid, soloEntry, flexEntry } = req.body;
    if (!puuid) return res.status(400).json({ error: "PUUID required" });

    try {
        const { data: player, error } = await supabase
            .from("players")
            .select("*")
            .eq("puuid", puuid)
            .maybeSingle();

        if (error) throw error;
        if (!player) return res.status(404).json({ error: "Player not found" });

        const peaks = await evaluateAndPersistPeaks(
            puuid,
            player,
            soloEntry,
            flexEntry,
        );
        res.json(peaks);
    } catch (error) {
        handleApiError(res, error, "Failed to update peaks");
    }
});

module.exports = router;
