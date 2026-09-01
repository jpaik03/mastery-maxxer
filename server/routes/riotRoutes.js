const express = require("express");
const router = express.Router();
const {
    regionalClient,
    platformClient,
    handleApiError,
} = require("../config/riot");

router.get("/account-by-riot-id", async (req, res) => {
    const { gameName, tagLine } = req.query;
    if (!gameName || !tagLine)
        return res.status(400).json({ error: "Missing gameName or tagLine" });

    try {
        const response = await regionalClient.get(
            `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(res, error, "Failed to fetch Riot account by Riot ID");
    }
});

router.get("/account-by-puuid", async (req, res) => {
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

router.get("/summoner-by-puuid", async (req, res) => {
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

router.get("/ranked-by-puuid", async (req, res) => {
    const { puuid } = req.query;
    if (!puuid) return res.status(400).json({ error: "PUUID required" });

    try {
        const response = await platformClient.get(
            `/lol/league/v4/entries/by-puuid/${puuid}`,
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(res, error, "Failed to fetch ranked entries");
    }
});

router.get("/champion-mastery", async (req, res) => {
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

router.get("/a-champion-mastery", async (req, res) => {
    const { puuid, championId } = req.query;
    if (!puuid || !championId)
        return res.status(400).json({ error: "PUUID and championId required" });

    try {
        const response = await platformClient.get(
            `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/by-champion/${championId}`,
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(res, error, "Failed to fetch specific champion mastery");
    }
});

router.get("/match-history", async (req, res) => {
    const { puuid, count = 20, queue, start = 0 } = req.query;
    if (!puuid) return res.status(400).json({ error: "PUUID required" });

    try {
        const params = { start: Number(start), count: Number(count) };
        if (queue) params.queue = Number(queue);

        const response = await regionalClient.get(
            `/lol/match/v5/matches/by-puuid/${puuid}/ids`,
            { params },
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(res, error, "Failed to fetch match history");
    }
});

router.get("/match-info", async (req, res) => {
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

module.exports = router;
