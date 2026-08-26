/*
 *  server.js
 *  Justin Paik
 *  Created: 16 March 2025
 *  Last Updated: 26 August 2026
 *  Express server and Riot API proxy endpoints
 *
 *  This module initializes the Express web server, configures the Riot API and
 *  Supabase clients, and exposes API endpoints.
 */

/* SET UP DEPENDENCIES */

// Load environment variables
require("dotenv").config();

// Module imports
const express = require("express");
const axios = require("axios");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Server configuration and instantiation
const app = express();
const PORT = process.env.PORT || 3000;

// Riot API configuration
const API_KEY = process.env.API_KEY;
const REGION = process.env.REGION || "americas";
const PLATFORM = process.env.PLATFORM || "na1";

// Axios clients for Riot API endpoints
const regionalClient = axios.create({
    baseURL: `https://${REGION}.api.riotgames.com`,
    headers: { "X-Riot-Token": API_KEY },
});

const platformClient = axios.create({
    baseURL: `https://${PLATFORM}.api.riotgames.com`,
    headers: { "X-Riot-Token": API_KEY },
});

// Supabase client configuration
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
);

// Season 2026 start timestamp (Jan 8, 2026 00:00:00 UTC in seconds)
const SEASON_2026_START = 1767830400;

// Configure Express to parse JSON and serve static assets
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/js", express.static(path.join(__dirname, "src/js")));
app.use("/css", express.static(path.join(__dirname, "src/css")));

/* GENERAL HELPER FUNCTIONS */

// API error handler helper
const handleApiError = (res, error, defaultMsg) => {
    const status = error.response?.status || 500;
    const message = error.response?.data?.status?.message || defaultMsg;
    console.error(`API Error [${status}]:`, error.message);
    return res.status(status).json({ error: message });
};

// Execute an API request function and automatically retry if rate-limited (HTTP 429)
async function fetchWithRetry(requestFn) {
    try {
        return await requestFn();
    } catch (error) {
        if (error.response && error.response.status === 429) {
            const retryAfter = parseInt(
                error.response.headers["retry-after"] || "5",
                10,
            );
            console.log(
                `Rate limit reached. Waiting ${retryAfter}s before retrying...`,
            );
            await new Promise((res) =>
                setTimeout(res, (retryAfter + 1) * 1000),
            );
            return await fetchWithRetry(requestFn);
        }
        throw error;
    }
}

/* RIOT API ROUTES */

// Get Riot account info by PUUID
app.get("/api/account-by-puuid", async (req, res) => {
    const { puuid } = req.query;
    if (!puuid) return res.status(400).json({ error: "PUUID required" });

    try {
        const response = await regionalClient.get(
            `/riot/account/v1/accounts/by-puuid/${puuid}`,
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(res, error, "Failed to fetch Riot account by PUUID");
    }
});

// Get Riot account info by Riot ID (gameName + tagLine)
app.get("/api/account-by-riot-id", async (req, res) => {
    const { gameName, tagLine } = req.query;
    if (!gameName || !tagLine) {
        return res.status(400).json({ error: "Missing gameName or tagLine" });
    }

    try {
        const response = await regionalClient.get(
            `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(res, error, "Failed to fetch Riot account by Riot ID");
    }
});

// Get summoner info (level, icon, summonerId) by PUUID
app.get("/api/summoner-by-puuid", async (req, res) => {
    const { puuid } = req.query;
    if (!puuid) return res.status(400).json({ error: "PUUID required" });

    try {
        const response = await platformClient.get(
            `/lol/summoner/v4/summoners/by-puuid/${puuid}`,
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(res, error, "Failed to fetch summoner info");
    }
});

// Get ranked stats (Solo/Duo, Flex) by PUUID
app.get("/api/ranked-by-puuid", async (req, res) => {
    const { puuid } = req.query;
    if (!puuid) return res.status(400).json({ error: "PUUID required" });

    try {
        const leagueRes = await platformClient.get(
            `/lol/league/v4/entries/by-puuid/${puuid}`,
        );
        res.json(leagueRes.data);
    } catch (error) {
        handleApiError(res, error, "Failed to fetch ranked entries");
    }
});

// Get all or top champion masteries by PUUID
app.get("/api/champion-mastery", async (req, res) => {
    const { puuid, count } = req.query;
    if (!puuid) return res.status(400).json({ error: "PUUID required" });

    try {
        const endpoint = count
            ? `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`
            : `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`;

        const response = await platformClient.get(endpoint);
        res.json(response.data);
    } catch (error) {
        handleApiError(res, error, "Failed to fetch mastery data");
    }
});

// Get a specific champion's mastery by PUUID and championId
app.get("/api/a-champion-mastery", async (req, res) => {
    const { puuid, championId } = req.query;
    if (!puuid || !championId) {
        return res.status(400).json({ error: "PUUID and championId required" });
    }

    try {
        const response = await platformClient.get(
            `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/by-champion/${championId}`,
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(res, error, "Failed to fetch specific champion mastery");
    }
});

// Get match history IDs by PUUID
app.get("/api/match-history", async (req, res) => {
    const { puuid, count = 20, queue } = req.query;
    if (!puuid) return res.status(400).json({ error: "PUUID required" });

    try {
        const params = { start: 0, count };
        if (queue) params.queue = queue;

        const response = await regionalClient.get(
            `/lol/match/v5/matches/by-puuid/${puuid}/ids`,
            { params },
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(res, error, "Failed to fetch match history");
    }
});

// Get specific match details by matchId
app.get("/api/match-info", async (req, res) => {
    const { matchId } = req.query;
    if (!matchId) return res.status(400).json({ error: "Match ID required" });

    try {
        const response = await regionalClient.get(
            `/lol/match/v5/matches/${matchId}`,
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(res, error, "Failed to fetch match details");
    }
});

/* FLEX STATS HELPERS */

// Extract ping counts from participant data
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

// Build the match record object for Supabase insertion
function formatPlayerMatchRecord(matchId, puuid, match, participant) {
    return {
        match_id: matchId,
        puuid: puuid,
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
    };
}

// Fetch all match IDs for a player from Riot API starting from a given timestamp
async function fetchFlexMatchIds(puuid, startTime) {
    let matchIds = [];
    let startIdx = 0;

    while (true) {
        const response = await fetchWithRetry(() =>
            regionalClient.get(`/lol/match/v5/matches/by-puuid/${puuid}/ids`, {
                params: {
                    queue: 440,
                    startTime,
                    start: startIdx,
                    count: 100,
                },
            }),
        );
        const page = response.data || [];
        matchIds.push(...page);
        if (page.length < 100) break;
        startIdx += 100;
    }

    return matchIds;
}

// Ingest match details into Supabase if not already present
async function ingestPlayerMatches(puuid, matchIds) {
    for (const matchId of matchIds) {
        const { data: exists } = await supabase
            .from("player_matches")
            .select("id")
            .eq("match_id", matchId)
            .eq("puuid", puuid)
            .maybeSingle();

        if (exists) continue;

        const matchRes = await fetchWithRetry(() =>
            regionalClient.get(`/lol/match/v5/matches/${matchId}`),
        );
        const match = matchRes.data;
        const participant = match?.info?.participants?.find(
            (p) => p.puuid === puuid,
        );

        if (participant) {
            const isRemake =
                participant.gameEndedInEarlySurrender ||
                match.info.gameDuration < 300;

            if (!isRemake) {
                const record = formatPlayerMatchRecord(
                    matchId,
                    puuid,
                    match,
                    participant,
                );
                await supabase
                    .from("player_matches")
                    .upsert(record, { onConflict: "match_id, puuid" });
            }
        }

        // Pace requests (100 calls per 2 minutes)
        await new Promise((resolve) => setTimeout(resolve, 1200));
    }
}

// Aggregate role wins and total games played
function aggregateRoleStats(matches) {
    const roles = {
        TOP: { wins: 0, total: 0 },
        JUNGLE: { wins: 0, total: 0 },
        MIDDLE: { wins: 0, total: 0 },
        BOTTOM: { wins: 0, total: 0 },
        UTILITY: { wins: 0, total: 0 },
    };

    let totalWins = 0;

    (matches || []).forEach((m) => {
        const pos = m.team_position?.toUpperCase();
        if (roles[pos]) {
            roles[pos].total++;
            if (m.win) {
                roles[pos].wins++;
                totalWins++;
            }
        }
    });

    const formatWR = (w, t) =>
        t > 0 ? `${t} (${((w / t) * 100).toFixed(1)}%)` : "0";

    return {
        TOP: formatWR(roles.TOP.wins, roles.TOP.total),
        JGL: formatWR(roles.JUNGLE.wins, roles.JUNGLE.total),
        MID: formatWR(roles.MIDDLE.wins, roles.MIDDLE.total),
        BOT: formatWR(roles.BOTTOM.wins, roles.BOTTOM.total),
        SUP: formatWR(roles.UTILITY.wins, roles.UTILITY.total),
        TOTAL: formatWR(totalWins, matches?.length || 0),
    };
}

// Aggregate total and average ping counts across matches
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

    (matches || []).forEach((m) => {
        const p = m.pings || {};
        let matchSum = 0;

        pingKeys.forEach((key) => {
            const count = p[key] || 0;
            totals[key] += count;
            matchSum += count;
        });

        totals.total += matchSum;
    });

    const totalGames = matches?.length || 0;
    const avg = (val) =>
        totalGames > 0 ? (val / totalGames).toFixed(1) : "0.0";

    const averages = {};
    [...pingKeys, "total"].forEach((key) => {
        averages[key] = avg(totals[key]);
    });

    return { averages, totals };
}

// Compute role winrates and per-game ping averages from stored match records
function computeFlexAggregations(flexMatches) {
    const totalGamesCount = flexMatches?.length || 0;
    const roleStats = aggregateRoleStats(flexMatches);
    const { averages: pingsAvg, totals: rawPings } =
        aggregatePingStats(flexMatches);

    return {
        ...roleStats,
        pings: pingsAvg,
        rawPings,
        storedMatchCount: totalGamesCount,
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
const DIV_WEIGHTS = { IV: 0, III: 1, II: 2, I: 3 };

function calculateRankScore(tier, rank, lp) {
    if (!tier) return -1;
    const tVal = (TIER_WEIGHTS[tier.toUpperCase()] ?? 0) * 10000;
    const dVal = (DIV_WEIGHTS[rank] ?? 0) * 100;
    return tVal + dVal + (lp || 0);
}

// Evaluate live rank against historical peak and return updated peak data and DB fields
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

    if (liveEntry && liveEntry.tier) {
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

/* COMPLEX / DATABASE ROUTES */

// Sync & Fetch Flex Role Breakdown for a player
app.get("/api/player-flex-stats", async (req, res) => {
    const { puuid, name, gameName, tagLine } = req.query;
    if (!puuid) return res.status(400).json({ error: "PUUID required" });

    try {
        // Upsert player record first to satisfy foreign key constraints
        await supabase.from("players").upsert(
            {
                puuid,
                name: name || "Unknown",
                game_name: gameName || "Unknown",
                tag_line: tagLine || "Unknown",
            },
            { onConflict: "puuid" },
        );

        // Determine incremental sync start timestamp
        const { data: playerData } = await supabase
            .from("players")
            .select("last_synced_at")
            .eq("puuid", puuid)
            .maybeSingle();

        const startTime = playerData?.last_synced_at
            ? Math.floor(playerData.last_synced_at / 1000)
            : SEASON_2026_START;

        // Fetch new matches & ingest
        const allNewMatchIds = await fetchFlexMatchIds(puuid, startTime);
        await ingestPlayerMatches(puuid, allNewMatchIds);

        // Update last synced timestamp
        await supabase
            .from("players")
            .update({ last_synced_at: Date.now() })
            .eq("puuid", puuid);

        // Query stored matches and calculate stats
        const { data: flexMatches } = await supabase
            .from("player_matches")
            .select("team_position, win, pings")
            .eq("puuid", puuid)
            .eq("queue_id", 440)
            .gte("game_creation", SEASON_2026_START * 1000);

        const aggregations = computeFlexAggregations(flexMatches);

        res.json({
            ...aggregations,
            syncedMatchCount: allNewMatchIds.length,
        });
    } catch (error) {
        handleApiError(res, error, "Failed to aggregate Flex stats");
    }
});

// Get and dynamically evaluate peaks stored in Supabase
app.post("/api/player-peaks", async (req, res) => {
    const { puuid, soloEntry, flexEntry } = req.body;
    if (!puuid) return res.status(400).json({ error: "PUUID required" });

    try {
        const { data: player, error } = await supabase
            .from("players")
            .select("*")
            .eq("puuid", puuid)
            .maybeSingle();

        if (error || !player) {
            return res.status(404).json({ error: "Player not found" });
        }

        const currentYear = new Date().getFullYear();

        const storedSolo = {
            tier: player.peak_solo_tier,
            rank: player.peak_solo_rank,
            lp: player.peak_solo_lp,
            year: player.peak_solo_year,
            games: player.peak_solo_games,
            wins: player.peak_solo_wins,
            losses: player.peak_solo_losses,
        };

        const storedFlex = {
            tier: player.peak_flex_tier,
            rank: player.peak_flex_rank,
            lp: player.peak_flex_lp,
            year: player.peak_flex_year,
            games: player.peak_flex_games,
            wins: player.peak_flex_wins,
            losses: player.peak_flex_losses,
        };

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
            await supabase.from("players").update(updates).eq("puuid", puuid);
        }

        res.json({ peakSolo, peakFlex });
    } catch (error) {
        handleApiError(res, error, "Failed to update peaks");
    }
});

/* STATIC HTML ROUTES */

app.get("/MasteryMaxxer", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "MasteryMaxxer.html"));
});

app.get("/Comparer", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Comparer.html"));
});

app.get("/Johnsons", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Johnsons.html"));
});

/* SERVER INITIALIZATION */

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/Johnsons`);
});
