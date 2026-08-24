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
  headers: { "X-Riot-Token": API_KEY }
});

const platformClient = axios.create({
  baseURL: `https://${PLATFORM}.api.riotgames.com`,
  headers: { "X-Riot-Token": API_KEY }
});

// Error handler helper
const handleApiError = (res, error, defaultMsg) => {
  const status = error.response?.status || 500;
  const message = error.response?.data?.status?.message || defaultMsg;
  console.error(`API Error [${status}]:`, error.message);
  return res.status(status).json({ error: message });
};

app.use(express.static(path.join(__dirname, "public")));
app.use("/js", express.static(path.join(__dirname, "src/js")));
app.use("/css", express.static(path.join(__dirname, "src/css")));

// API ROUTES

// get PUUID by Riot ID
app.get("/api/account-by-riot-id", async (req, res) => {
  const { gameName, tagLine } = req.query;
  if (!gameName || !tagLine) {
    return res.status(400).json({ error: "Missing gameName or tagLine" });
  }

  try {
    const response = await regionalClient.get(
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
    res.json(response.data);
  } catch (error) {
    handleApiError(res, error, "Failed to fetch Riot account data");
  }
});

// Get summoner info (Level, icon, summonerId)
app.get("/api/summoner-by-puuid", async (req, res) => {
  const { puuid } = req.query;
  if (!puuid) return res.status(400).json({ error: "PUUID required" });

  try {
    const response = await platformClient.get(`/lol/summoner/v4/summoners/by-puuid/${puuid}`);
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
    const leagueRes = await platformClient.get(`/lol/league/v4/entries/by-puuid/${puuid}`);
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
      `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/by-champion/${championId}`
    );
    res.json(response.data);
  } catch (error) {
    handleApiError(res, error, "Failed to fetch specific champion mastery");
  }
});

// 6. Get match history IDs
app.get("/api/match-history", async (req, res) => {
  const { puuid, count = 20, queue } = req.query;
  if (!puuid) return res.status(400).json({ error: "PUUID required" });

  try {
    const params = { start: 0, count };
    if (queue) params.queue = queue;

    const response = await regionalClient.get(`/lol/match/v5/matches/by-puuid/${puuid}/ids`, { params });
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
    const response = await regionalClient.get(`/lol/match/v5/matches/${matchId}`);
    res.json(response.data);
  } catch (error) {
    handleApiError(res, error, "Failed to fetch match details");
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