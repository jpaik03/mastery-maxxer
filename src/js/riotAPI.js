/*
 *  riotApi.js
 *  Justin Paik
 *  Created: 27 May 2025
 *  Last Updated: 27 May 2025
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
    const response = await fetch(`/api/account-by-riot-id?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`);
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
 * Name:        fetchMasteryData()
 * Arguments:   A string representing the player's PUUID.
 * Returns:     A promise resolving to an object containing player mastery
 *              information.
 * Description: Calls the Riot API to fetch mastery details.
 * Effects:     None.
 */
export async function fetchMasteryData(puuid) {
    const response = await fetch(`/api/champion-mastery?puuid=${puuid}`);
    return response.json();
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
    const response = await fetch(`/api/a-champion-mastery?puuid=${puuid}&championId=${champId}`);
    return await response.json();
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

