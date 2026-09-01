require("dotenv").config();
const express = require("express");
const path = require("path");

const riotRoutes = require("./server/routes/riotRoutes");
const statsRoutes = require("./server/routes/statsRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/js", express.static(path.join(__dirname, "src/js")));
app.use("/css", express.static(path.join(__dirname, "src/css")));

app.use("/api", riotRoutes);
app.use("/api", statsRoutes);

app.get("/MasteryMaxxer", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "MasteryMaxxer.html"));
});

app.get("/Johnsons", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Johnsons.html"));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/Johnsons`);
});
