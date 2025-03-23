require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");
const app = express();
const PORT = 3000;

const API_KEY = process.env.API_KEY;

app.use(express.static(path.join(__dirname, "public")));
app.use("/js", express.static(path.join(__dirname, "src/js")));
app.use("/css", express.static(path.join(__dirname, "src/css")));

// Get PUUID
app.get("/api/account-by-riot-id", async (req, res) => {
    try {
        const { username, tag } = req.query;

        if (!username || !tag ) {
            return res.status(400).json({ error: "Required fields not filled in"});
        }

        const encodedTag = encodeURIComponent(tag);
        const url = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${username}/${encodedTag}?api_key=${API_KEY}`;
        
        const response = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Charset": "application/x-www-form-urlencoded; charset=UTF-8",
                "Origin": "https://developer.riotgames.com"
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error("Error fetching Riot ID data: ", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch Riot account data" });
    }
});

// Get all mastery info by PUUID
app.get("/api/champion-mastery", async (req, res) => {
    try {
        const { puuid } = req.query;

        if (!puuid) {
            return res.status(400).json({ error: "PUUID not found"});
        }

        const url = `https://na1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}?api_key=${API_KEY}`;
        
        const response = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Charset": "application/x-www-form-urlencoded; charset=UTF-8",
                "Origin": "https://developer.riotgames.com"
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error("Error fetching mastery data: ", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch mastery data" });
    }
});

// Get a particular champion's mastery info by PUUID
app.get("/api/a-champion-mastery", async (req, res) => {
    try {
        const { puuid, championId } = req.query;

        if (!puuid) {
            return res.status(400).json({ error: "PUUID not found"});
        } else if (!championId) {
            return res.status(400).json({ error: "Champion ID not found"});
        }

        const url = `https://na1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/by-champion/${championId}?api_key=${API_KEY}`;
        
        const response = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Charset": "application/x-www-form-urlencoded; charset=UTF-8",
                "Origin": "https://developer.riotgames.com"
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error("Error fetching mastery data: ", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch mastery data" });
    }
});

// Get match IDs by PUUID
app.get("/api/match-history", async (req, res) => {
    try {
        const { puuid, count = 20 } = req.query;
        const url = `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}&api_key=${API_KEY}`;
        
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching match history for PUUID ${puuid}:`, error);
        res.status(500).json({ error: "Failed to fetch match history" });
    }
});

// Get a match info by match ID
app.get("/api/match-info", async (req, res) => {
    try {
        const { matchId } = req.query;
        const url = `https://americas.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${API_KEY}`;
        
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching match details for ${matchId}:`, error);
        res.status(500).json({ error: "Failed to fetch match details" });
    }
});

// Route for homepage
app.get("/MasteryOverflow", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "MasteryOverflow.html"));
});

app.get("/Comparer", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Comparer.html"));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/MasteryOverflow`);
});