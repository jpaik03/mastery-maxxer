require("dotenv").config();
const axios = require("axios");

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

const SEASON_2026_START = 1767873600;
const RANKED_FLEX_QUEUE_ID = 440;
const RANKED_FIVES_QUEUE_ID = 710;

const TRACKED_PUUIDS = new Set([
    "wUX2hh9YBwf66OZjsn6SauURG6dyrYsBklTqHvMv6f-EMlcKH87g_lds17PEVnbEd26gsJOwQQB1kg",
    "VTe2huNS57BFU3WuCefKyC_cqGjkExvB4enPSS4R5YXKXru5jFCdMPz_3HtirYPs8AqFjnalrQO95w",
    "G6MhoNnrm8HYJ87lfJTEIoggCPb2_3Mr68Eh2OJGJeio972UwKnbzkDZUDxHcQZOoJz5rJbtWUMRlQ",
    "81RQTX37Hxdj7i9V4UTljdySmsyj82OuiExAEOze3XohGnyUGR9etyTnjLohw87p9U-QjxMmONbEcg",
    "fSOoEFLuNqQlp7gY8RFUTQ2LnJpV3LcnapcRp1RDtn_CrLbaTM2bPsCzcic74Kk_QfeDjfwKHVtVsg",
    "TV09seitjrdYEiKToxrCA7rh_GN_wir_j_yZ3fmRS4Al1zpERQ6pvHzIy5dqqdDsRGyuk4DfoIDpsg",
    "6cwqYAckOFIdB4qJoFEvKohj9zIG_HveDYMSaOJx4oNndYnbygmKvbZSbMfrPww6xYbTYUrFNy4zkQ",
    "9pLcWyTNsCHIA6GtYarC4ZKV02JDXyWPGY8fTzQKQ06oqgAMJ17_C2CAGrM5HvGiWBFqiH5U1GYyqg",
    "5-1YXAqBrJ9JtM311w5RQRBDwyr0AWf2k-m9OouPheTZNuAPbB6MsKN-EncpjlWm2G98mX-WDdrOBA",
    "S3-ROibvQqYney-A0xvuYXH4J8mO1_-ZWU0I20ZKNw452ioyJlrg5ZLrcf2tNWLPFAkQsPsvIMbRUw",
]);

const handleApiError = (res, error, defaultMsg) => {
    const status = error.response?.status || 500;
    const message =
        error.response?.data?.status?.message || error.message || defaultMsg;
    console.error(`API Error [${status}]:`, error.message);
    return res.status(status).json({ error: message });
};

async function fetchWithRetry(requestFn) {
    try {
        return await requestFn();
    } catch (error) {
        if (error.response?.status === 429) {
            const retryAfter = parseInt(
                error.response.headers["retry-after"] || "5",
                10,
            );
            console.log(
                `Rate limit reached. Waiting ${retryAfter}s before retrying...`,
            );
            await new Promise((resolve) =>
                setTimeout(resolve, (retryAfter + 1) * 1000),
            );
            return await fetchWithRetry(requestFn);
        }
        throw error;
    }
}

module.exports = {
    regionalClient,
    platformClient,
    SEASON_2026_START,
    RANKED_FLEX_QUEUE_ID,
    RANKED_FIVES_QUEUE_ID,
    TRACKED_PUUIDS,
    handleApiError,
    fetchWithRetry,
};
