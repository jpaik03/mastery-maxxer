require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

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

// Error handler helper
const handleApiError = (res, error, defaultMsg) => {
    const status = error.response?.status || 500;
    const message = error.response?.data?.status?.message || defaultMsg;
    console.error(`API Error [${status}]:`, error.message);
    return res.status(status).json({ error: message });
};

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/js", express.static(path.join(__dirname, "src/js")));
app.use("/css", express.static(path.join(__dirname, "src/css")));

// API ROUTES

// Get Riot Account info by PUUID
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

// Get PUUID by Riot ID (gameName + tagLine)
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

// Get summoner info (Level, icon, summonerId)
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

// Get ranked stats (Solo/Duo, Flex)
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

// Get all or top champion masteries
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

// Get a specific champion's mastery
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

// Get match history IDs
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

// Get specific match details
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

// SUPABASE LOGIC

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
);

// S26 Start (Jan 8, 2026 00:00:00 UTC)
const SEASON_2026_START = 1767830400;

// Adhere to Riot API rate limit
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

// Sync & Fetch Flex Role Breakdown for a player
app.get("/api/player-flex-stats", async (req, res) => {
    const { puuid, name, gameName, tagLine } = req.query;
    if (!puuid) return res.status(400).json({ error: "PUUID required" });

    try {
        // Upsert player record first to satisfy foreign key constraints
        await supabase.from("players").upsert(
            {
                puuid: puuid,
                name: name || "Unknown",
                game_name: gameName || "Unknown",
                tag_line: tagLine || "Unknown",
            },
            { onConflict: "puuid" },
        );

        // Determine start timestamp for incremental sync
        const { data: playerData } = await supabase
            .from("players")
            .select("last_synced_at")
            .eq("puuid", puuid)
            .maybeSingle();

        const startTime = playerData?.last_synced_at
            ? Math.floor(playerData.last_synced_at / 1000)
            : SEASON_2026_START;

        // Fetch all match IDs across pages
        let allNewMatchIds = [];
        let startIdx = 0;
        while (true) {
            const matchIdsRes = await fetchWithRetry(() =>
                regionalClient.get(
                    `/lol/match/v5/matches/by-puuid/${puuid}/ids`,
                    {
                        params: {
                            queue: 440,
                            startTime,
                            start: startIdx,
                            count: 100,
                        },
                    },
                ),
            );
            const page = matchIdsRes.data || [];
            allNewMatchIds.push(...page);
            if (page.length < 100) break;
            startIdx += 100;
        }

        // Ingest match details sequentially with pacing
        for (const matchId of allNewMatchIds) {
            const { data: exists } = await supabase
                .from("player_matches")
                .select("id")
                .eq("match_id", matchId)
                .eq("puuid", puuid)
                .maybeSingle();

            if (!exists) {
                const matchRes = await fetchWithRetry(() =>
                    regionalClient.get(`/lol/match/v5/matches/${matchId}`),
                );
                const match = matchRes.data;
                const participant = match?.info?.participants?.find(
                    (p) => p.puuid === puuid,
                );

                if (participant) {
                    const isRemake =
                        participant.gameEndedInEarlySurrender === true ||
                        (match.info.gameDuration &&
                            match.info.gameDuration < 300);

                    if (!isRemake) {
                        const pingData = {
                            allIn: participant.allInPings || 0,
                            assistMe: participant.assistMePings || 0,
                            basic: participant.basicPings || 0,
                            command: participant.commandPings || 0,
                            danger: participant.dangerPings || 0,
                            enemyMissing: participant.enemyMissingPings || 0,
                            enemyVision: participant.enemyVisionPings || 0,
                            getBack: participant.getBackPings || 0,
                            hold: participant.holdPings || 0,
                            needVision: participant.needVisionPings || 0,
                            onMyWay: participant.onMyWayPings || 0,
                            push: participant.pushPings || 0,
                            visionCleared: participant.visionClearedPings || 0,
                        };

                        const { error: matchInsertError } = await supabase
                            .from("player_matches")
                            .upsert(
                                {
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
                                    pings: pingData,
                                },
                                { onConflict: "match_id, puuid" },
                            );

                        if (matchInsertError) {
                            console.error(
                                `Failed to insert match ${matchId} for ${puuid}:`,
                                matchInsertError,
                            );
                        }
                    }
                }

                // Pace requests (100 calls per 2 minutes)
                await new Promise((resolve) => setTimeout(resolve, 1200));
            }
        }

        // Update last synced time
        await supabase
            .from("players")
            .update({
                last_synced_at: Date.now(),
            })
            .eq("puuid", puuid);

        // Aggregate stored stats from database
        const { data: flexMatches } = await supabase
            .from("player_matches")
            .select("team_position, win, pings")
            .eq("puuid", puuid)
            .eq("queue_id", 440)
            .gte("game_creation", SEASON_2026_START * 1000);

        const roles = {
            TOP: { wins: 0, total: 0 },
            JUNGLE: { wins: 0, total: 0 },
            MIDDLE: { wins: 0, total: 0 },
            BOTTOM: { wins: 0, total: 0 },
            UTILITY: { wins: 0, total: 0 },
        };

        const pingTotals = {
            allIn: 0,
            assistMe: 0,
            basic: 0,
            command: 0,
            danger: 0,
            enemyMissing: 0,
            enemyVision: 0,
            getBack: 0,
            hold: 0,
            needVision: 0,
            onMyWay: 0,
            push: 0,
            visionCleared: 0,
            total: 0,
        };

        let totalWins = 0;
        (flexMatches || []).forEach((m) => {
            const pos = m.team_position?.toUpperCase();
            if (roles[pos]) {
                roles[pos].total++;
                if (m.win) {
                    roles[pos].wins++;
                    totalWins++;
                }
            }

            const p = m.pings || {};
            const allIn = p.allIn || 0;
            const assistMe = p.assistMe || 0;
            const basic = p.basic || 0;
            const command = p.command || 0;
            const danger = p.danger || 0;
            const enemyMissing = p.enemyMissing || 0;
            const enemyVision = p.enemyVision || 0;
            const getBack = p.getBack || 0;
            const hold = p.hold || 0;
            const needVision = p.needVision || 0;
            const onMyWay = p.onMyWay || 0;
            const push = p.push || 0;
            const visionCleared = p.visionCleared || 0;

            const matchTotal =
                allIn +
                assistMe +
                basic +
                command +
                danger +
                enemyMissing +
                enemyVision +
                getBack +
                hold +
                needVision +
                onMyWay +
                push +
                visionCleared;

            pingTotals.allIn += allIn;
            pingTotals.assistMe += assistMe;
            pingTotals.basic += basic;
            pingTotals.command += command;
            pingTotals.danger += danger;
            pingTotals.enemyMissing += enemyMissing;
            pingTotals.enemyVision += enemyVision;
            pingTotals.getBack += getBack;
            pingTotals.hold += hold;
            pingTotals.needVision += needVision;
            pingTotals.onMyWay += onMyWay;
            pingTotals.push += push;
            pingTotals.visionCleared += visionCleared;
            pingTotals.total += matchTotal;
        });

        const totalGamesCount = flexMatches?.length || 0;
        const avg = (val) =>
            totalGamesCount > 0 ? (val / totalGamesCount).toFixed(1) : "0.0";

        const pingsAvg = {
            allIn: avg(pingTotals.allIn),
            assistMe: avg(pingTotals.assistMe),
            basic: avg(pingTotals.basic),
            command: avg(pingTotals.command),
            danger: avg(pingTotals.danger),
            enemyMissing: avg(pingTotals.enemyMissing),
            enemyVision: avg(pingTotals.enemyVision),
            getBack: avg(pingTotals.getBack),
            hold: avg(pingTotals.hold),
            needVision: avg(pingTotals.needVision),
            onMyWay: avg(pingTotals.onMyWay),
            push: avg(pingTotals.push),
            visionCleared: avg(pingTotals.visionCleared),
            total: avg(pingTotals.total),
        };

        const formatWR = (w, t) =>
            t > 0 ? `${t} (${((w / t) * 100).toFixed(1)}%)` : "0";

        res.json({
            TOP: formatWR(roles.TOP.wins, roles.TOP.total),
            JGL: formatWR(roles.JUNGLE.wins, roles.JUNGLE.total),
            MID: formatWR(roles.MIDDLE.wins, roles.MIDDLE.total),
            BOT: formatWR(roles.BOTTOM.wins, roles.BOTTOM.total),
            SUP: formatWR(roles.UTILITY.wins, roles.UTILITY.total),
            TOTAL: formatWR(totalWins, totalGamesCount),
            pings: pingsAvg,
        });
    } catch (error) {
        handleApiError(res, error, "Failed to aggregate Flex stats");
    }
});

// PEAK RANK LOGIC

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

        if (error || !player)
            return res.status(404).json({ error: "Player not found" });

        const currentYear = new Date().getFullYear();
        const updates = {};

        // Evaluate Solo/Duo Peak
        let peakSolo = {
            tier: player.peak_solo_tier,
            rank: player.peak_solo_rank,
            lp: player.peak_solo_lp,
            year: player.peak_solo_year,
            games: player.peak_solo_games,
            wins: player.peak_solo_wins,
            losses: player.peak_solo_losses,
        };

        if (soloEntry && soloEntry.tier) {
            const currentScore = calculateRankScore(
                soloEntry.tier,
                soloEntry.rank,
                soloEntry.leaguePoints,
            );
            const storedScore = calculateRankScore(
                player.peak_solo_tier,
                player.peak_solo_rank,
                player.peak_solo_lp,
            );
            const liveGames = (soloEntry.wins || 0) + (soloEntry.losses || 0);

            if (currentScore > storedScore) {
                peakSolo = {
                    tier: soloEntry.tier,
                    rank: soloEntry.rank,
                    lp: soloEntry.leaguePoints,
                    year: currentYear,
                    games: liveGames,
                    wins: soloEntry.wins,
                    losses: soloEntry.losses,
                };
                updates.peak_solo_tier = soloEntry.tier;
                updates.peak_solo_rank = soloEntry.rank;
                updates.peak_solo_lp = soloEntry.leaguePoints;
                updates.peak_solo_year = currentYear;
                updates.peak_solo_games = liveGames;
                updates.peak_solo_wins = soloEntry.wins;
                updates.peak_solo_losses = soloEntry.losses;
            } else if (player.peak_solo_year === currentYear) {
                peakSolo.games = liveGames;
                peakSolo.wins = soloEntry.wins;
                peakSolo.losses = soloEntry.losses;
                updates.peak_solo_games = liveGames;
                updates.peak_solo_wins = soloEntry.wins;
                updates.peak_solo_losses = soloEntry.losses;
            }
        }

        // Evaluate Flex Peak
        let peakFlex = {
            tier: player.peak_flex_tier,
            rank: player.peak_flex_rank,
            lp: player.peak_flex_lp,
            year: player.peak_flex_year,
            games: player.peak_flex_games,
            wins: player.peak_flex_wins,
            losses: player.peak_flex_losses,
        };

        if (flexEntry && flexEntry.tier) {
            const currentScore = calculateRankScore(
                flexEntry.tier,
                flexEntry.rank,
                flexEntry.leaguePoints,
            );
            const storedScore = calculateRankScore(
                player.peak_flex_tier,
                player.peak_flex_rank,
                player.peak_flex_lp,
            );
            const liveGames = (flexEntry.wins || 0) + (flexEntry.losses || 0);

            if (currentScore > storedScore) {
                peakFlex = {
                    tier: flexEntry.tier,
                    rank: flexEntry.rank,
                    lp: flexEntry.leaguePoints,
                    year: currentYear,
                    games: liveGames,
                    wins: flexEntry.wins,
                    losses: flexEntry.losses,
                };
                updates.peak_flex_tier = flexEntry.tier;
                updates.peak_flex_rank = flexEntry.rank;
                updates.peak_flex_lp = flexEntry.leaguePoints;
                updates.peak_flex_year = currentYear;
                updates.peak_flex_games = liveGames;
                updates.peak_flex_wins = flexEntry.wins;
                updates.peak_flex_losses = flexEntry.losses;
            } else if (player.peak_flex_year === currentYear) {
                peakFlex.games = liveGames;
                peakFlex.wins = flexEntry.wins;
                peakFlex.losses = flexEntry.losses;
                updates.peak_flex_games = liveGames;
                updates.peak_flex_wins = flexEntry.wins;
                updates.peak_flex_losses = flexEntry.losses;
            }
        }

        if (Object.keys(updates).length > 0) {
            await supabase.from("players").update(updates).eq("puuid", puuid);
        }

        res.json({ peakSolo, peakFlex });
    } catch (error) {
        handleApiError(res, error, "Failed to update peaks");
    }
});

// Route for HTML pages
app.get("/MasteryMaxxer", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "MasteryMaxxer.html"));
});

app.get("/Comparer", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Comparer.html"));
});

app.get("/Johnsons", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Johnsons.html"));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/Johnsons`);
});
