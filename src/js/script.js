let puuid = "";

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("collect-riot-id").addEventListener("submit", async (event) => {
        event.preventDefault();
        const username = document.getElementById("username-input").value.trim();
        const tag = document.getElementById("tag-input").value.trim();

        if (!username || !tag) {
            alert("Please enter your Riot ID.")
            return;
        }

        try {
            const response = await fetch(`/api/account-by-riot-id?username=${encodeURIComponent(username)}&tag=${encodeURIComponent(tag)}`);
            const data = await response.json();

            if (data.error) {
                alert("Error: " + data.error);
                return;
            }
            
            puuid = data.puuid;

            document.getElementById("display-username").textContent = data.gameName;
            document.getElementById("display-tag").textContent = `#${data.tagLine}`;
            document.getElementById("display-puuid").textContent = data.puuid;

            fetchMasteryInfo(puuid);

        } catch (err) {
            console.error("Error fetching Riot account: ", err);
            alert("Error fetching Riot account.");
        }
    });
});

async function fetchMasteryInfo(puuid) {
    try {
        const response = await fetch(`/api/champion-mastery?puuid=${puuid}`)
        const masteryData = await response.json();

        if (masteryData.error) {
            alert("Error: " + masteryData.error);
            return;
        }

        let masteryInfo = "<h2>Champion Mastery</h2>";

        masteryData.forEach(champion => {
            const championId = champion.championId;
            const championLevel = champion.championLevel;
            const championPoints = champion.championPoints;
            const championPointsSinceLastLevel = champion.championPointsSinceLastLevel;
            const markRequiredForNextLevel = champion.markRequiredForNextLevel;
            const tokensEarned = champion.tokensEarned;
            const sMinusRequired = champion.nextSeasonMilestone?.requireGradeCounts?.["S-"] || "N/A";
            const aMinusRequired = champion.nextSeasonMilestone?.requireGradeCounts?.["A-"] || "N/A";

            masteryInfo += `
                <div>
                    <p>Champion ID: ${championId}</p>
                    <p>Level: ${championLevel}</p>
                    <p>Points: ${championPoints}</p>
                    <p>Points since last level: ${championPointsSinceLastLevel}</p>
                    <p>Marks required for next level: ${markRequiredForNextLevel}</p>
                    <p>Marks earned: ${tokensEarned}</p>
                    <p>S- Required: ${sMinusRequired}</p>
                    <p>A- Required: ${aMinusRequired}</p>
                </div>
                <hr>
            `;
        });

        document.getElementById("mastery-info").innerHTML = masteryInfo;
    } catch (err) {
        console.error("Error fetching mastery data:", err);
        alert("Error fetching mastery data.");
    }
}