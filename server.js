require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();
const PORT = 3000;

const API_KEY = process.env.API_KEY;

app.use(express.static("src"));

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

// Get Mastery Info
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

// Route for homepage
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/templates/index.html");
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});