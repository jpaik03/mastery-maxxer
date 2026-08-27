/*
 *  riotApi.js
 *  Justin Paik, Owen Jin
 *  Created: 27 May 2025
 *  Last Updated: 27 August 2026
 *  Riot API helper functions
 *
 *  This module provides asynchronous functions to interact with Riot's API
 *  endpoints. It includes methods for fetching account information by Riot ID,
 *  champion mastery data, specific champion mastery, match history, and
 *  detailed match information. These functions return parsed JSON responses
 *  from the server API routes.
 */

/*
 * Name:        fetchRiotAccount()
 * Arguments:   Two strings representing the player's gamename and tagline.
 * Returns:     A promise resolving to an object containing Riot ID information.
 * Description: Calls the Riot API to fetch account details using gamename and
 *              tagline.
 * Effects:     None.
 */
export async function fetchRiotAccount(gameName, tagLine) {
    const response = await fetch(
        `/api/account-by-riot-id?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`,
    );
    return await response.json();
}

/*
 * Name:        fetchRiotAccountByPuuid()
 * Arguments:   A string representing the player's PUUID.
 * Returns:     A promise resolving to an object containing Riot ID information.
 * Description: Calls the Riot API to fetch account details using gamename and
 *              tagline.
 * Effects:     None.
 */
export async function fetchRiotAccountByPuuid(puuid) {
    const response = await fetch(`/api/account-by-puuid?puuid=${puuid}`);
    return response.json();
}

/*
 * Name:        fetchSummonerData()
 * Arguments:   A string representing the player's PUUID.
 * Returns:     A promise resolving to summoner level, icon, and summonerId.
 */
export async function fetchSummonerData(puuid) {
    const response = await fetch(`/api/summoner-by-puuid?puuid=${puuid}`);
    return await response.json();
}

/*
 * Name:        fetchRankedData()
 * Arguments:   A string representing the player's PUUID.
 * Returns:     Array of ranked queue objects (Solo/Duo, Flex).
 */
export async function fetchRankedData(puuid) {
    const response = await fetch(`/api/ranked-by-puuid?puuid=${puuid}`);
    return await response.json();
}

/*
 * Name:        syncAndFetchPlayerPeaks()
 * Arguments:   A string representing the player's PUUID, and their current
 *              Solo/Duo and Flex queue ranks.
 * Returns:     A promise resolving to an object containing the player's peak
 *              ranks and game counts (peakSolo, peakFlex).
 */
export async function syncAndFetchPlayerPeaks(puuid, soloEntry, flexEntry) {
    const response = await fetch("/api/player-peaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puuid, soloEntry, flexEntry }),
    });
    return await response.json();
}

/*
 * Name:        fetchMasteryData()
 * Arguments:   A string representing the player's PUUID.
 * Returns:     A promise resolving to an object containing player mastery
 *              information.
 * Description: Calls the Riot API to fetch mastery details.
 * Effects:     None.
 */
export async function fetchMasteryData(puuid) {
    const response = await fetch(`/api/champion-mastery?puuid=${puuid}`);
    return await response.json();
}

/*
 * Name:        fetchAChampMastery()
 * Arguments:   A string representing the player's PUUID and an integer for the
 *              champion ID.
 * Returns:     Mastery data for the given champion.
 * Description: Calls the Riot API to retrieve the mastery data for the
 *              specified champion.
 * Effects:     None.
 */
export async function fetchAChampMastery(puuid, champId) {
    const response = await fetch(
        `/api/a-champion-mastery?puuid=${puuid}&championId=${champId}`,
    );
    return await response.json();
}

/*
 * Name:        syncRankedQueues()
 * Arguments:   None.
 * Returns:     A promise resolving to an object containing match sync results.
 * Description: Triggers a bulk incremental sync of Flex and Ranked 5v5 matches
 *              for all tracked roster members from the Riot API into Supabase.
 * Effects:     Updates stored matches and sync timestamps on the server/DB.
 */
export async function syncRankedQueues() {
    const response = await fetch("/api/sync-roster-ranked", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || "Failed to synchronize ranked queues");
    }

    return result;
}

/*
 * Name:        fetchRosterRankedStats()
 * Arguments:   None.
 * Returns:     A promise resolving to aggregated Flex and Ranked 5v5 stats for
 *              all tracked roster players.
 * Description: Calls the server API to bulk-fetch and aggregate stored ranked
 *              match stats for the entire roster.
 * Effects:     None.
 */
export async function fetchRosterRankedStats() {
    const res = await fetch("/api/roster-ranked-stats");
    return await res.json();
}

/*
 * Name:        fetchRankedFivesStats()
 * Arguments:   A string representing the player's PUUID.
 * Returns:     An object containing the player's Ranked 5v5 queue stats.
 * Description: Calls the server API to fetch aggregated Ranked 5v5 stats for
 *              a specific player.
 * Effects:     None.
 */
export async function fetchRankedFivesStats(puuid) {
    const response = await fetch(
        `/api/player-ranked-fives-stats?puuid=${encodeURIComponent(puuid)}`,
    );

    return await response.json();
}

/*
 * Name:        fetchFlexStats()
 * Arguments:   A string representing the a player's PUUID.
 * Returns:     An object containing player's Flex queue stats.
 * Description: Calls the Riot API to fetch data for a specific match.
 * Effects:     None.
 */
export async function fetchFlexStats(puuid, name, gameName, tagLine) {
    const params = new URLSearchParams({
        puuid,
        name: name || "",
        gameName: gameName || "",
        tagLine: tagLine || "",
    });
    const res = await fetch(`/api/player-flex-stats?${params.toString()}`);
    return await res.json();
}

/*
 * Name:        fetchChampionLeaderboard()
 * Arguments:   An integer or string representing the champion ID.
 * Returns:     A promise resolving to leaderboard rankings and winrate stats
 *              for the specified champion.
 * Description: Calls the server API to aggregate combined Flex and Ranked 5v5
 *              match data across all players for a given champion.
 * Effects:     None.
 */
export async function fetchChampionLeaderboard(championId) {
    const response = await fetch(
        `/api/champion-leaderboard?championId=${encodeURIComponent(
            championId,
        )}`,
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || "Failed to load champion leaderboard");
    }

    return result;
}

/*
 * Name:        fetchDuoLeaderboard()
 * Arguments:   None.
 * Returns:     A promise resolving to aggregate stats and win rates for all
 *              bot lane and support player pairings.
 * Description: Calls the server API to aggregate combined Flex and Ranked 5v5
 *              match records by bottom lane duo pairings.
 * Effects:     None.
 */
export async function fetchDuoLeaderboard() {
    const response = await fetch("/api/duo-leaderboard");
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || "Failed to load duo leaderboard");
    }

    return result;
}

/*
 * Name:        fetchMatchHistory()
 * Arguments:   A string representing the a player's PUUID.
 * Returns:     An array of match IDs.
 * Description: Retrieves the last 20 match IDs for the given PUUID.
 * Effects:     Calls the Riot API.
 */
export async function fetchMatchHistory(puuid) {
    const response = await fetch(`/api/match-history?puuid=${puuid}&count=20`);
    return await response.json();
}

/*
 * Name:        fetchMatchDetails()
 * Arguments:   A string representing the match ID.
 * Returns:     An object containing match details.
 * Description: Calls the Riot API to fetch data for a specific match.
 * Effects:     None.
 */
export async function fetchMatchDetails(matchId) {
    const response = await fetch(`/api/match-info?matchId=${matchId}`);
    return await response.json();
}
