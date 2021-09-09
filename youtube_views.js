let settings = input.config({
    title: "Import YouTube analytics",
    description: `This script queries the YouTube Data API for video metadata (e.g. number of likes & views), then
stores that data in the specified field.

To use this script, you will need a YouTube API key. You can [create a new API key here]
(https://developers.google.com/youtube/v3/getting-started). To learn more about the different properties you can query,
see [YouTube's documentation](https://developers.google.com/youtube/v3/docs/videos#resource-representation).`,
    items: [
        input.config.text("youtubeKey", {
            label: "YouTube Data API v3 key",
            description: "The API key will be visible to everyone who can view this base.",
        }),
        input.config.table("table", { label: "Table" }),
        input.config.field("videoField", {
            parentTable: "table",
            label: "Field containing YouTube video links",
        }),
        input.config.field("destinationField", {
            parentTable: "table",
            label: "Field in which to store the statistic",
        }),
        input.config.text("statistic", {
            label: "Video statistic",
            description:
                '(e.g. "snippet.thumbnails.default.url"). Learn more here: https://developers.google.com/youtube/v3/docs/videos#resource-representation',
        }),
    ],
});

let description = `
# Capture YouTube Analytics

For each record in a given table which contains a link to a video on YouTube.com, fetch some metadata describing the video and store the information in another field.

- [YouTube Data API
    Overview](https://developers.google.com/youtube/v3/getting-started) - for
    details on configuring a YouTube account and retrieving an API key
- [YouTube Video Resource
    Representation](https://developers.google.com/youtube/v3/docs/videos#resource-representation) -
    for details on the available data, including the valid options for "statistic
    name"
`;

/**
 * The maximum number of videos which can be queried in a single request to the
 * YouTube Data API.
 */
let maxYoutubeResults = 50;
/**
 * The maximum number of records that can be updated in a single invocation of
 * `table.updateRecordsAsync`.
 */
let maxAirtableWrites = 50;

/**
 * Extract the YouTube video identifier from a YouTube video URL
 *
 * @params {string} url
 *
 * @returns {string|null} - a YouTube video ID if one can be found; `null`
 *                          otherwise
 */
function parseId(url) {
    let host, searchParams;

    try {
        ({ host, searchParams } = new URL(url));
    } catch (_) {
        return null;
    }

    if (!/(^|.)youtube.com$/i.test(host)) {
        return null;
    }

    return searchParams.get("v") || null;
}

/**
 * Get a property value of an object, potentially nested within one or more
 * additional objects.
 *
 * @param {object} object - the value containing properties
 * @param {string} path - one or more property names separated by the period
 *                        character
 *
 * @returns {any} the value of the specified property
 */
function getPath(object, path) {
    let value = object;

    for (let propertyName of path.split(".")) {
        if (!(propertyName in value)) {
            throw new Error(`The property "${propertyName}" is not defined.`);
        }
        value = value[propertyName];
    }
    return value;
}

/**
 * Retrieve YouTube video metadata for one or more videos.
 *
 * @param {string} key - access key for the YouTube Data API
 * @param {object[]} items - one or more objects bearing a property named
 *                           `videoId`
 * @param {string} name - the name of a metadata statistic; statistics nested
 *                        within objects can be accessed using a period
 *                        character to separate property names
 *
 * @returns {Promise<object[]>} a copy of the input `items` array where each
 *                              element has been extended with a property named
 *                              `statistic`
 */
async function fetchVideoData(key, items, name) {
    let [part] = name.split(".", 1);
    let ids = items.map((item) => item.videoId);
    let urlString =
        "https://www.googleapis.com/youtube/v3/videos" +
        `?key=${key}&id=${ids.join(",")}&part=${part}`;
    let response = await fetch(urlString);

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return (await response.json()).items.map((item, index) => ({
        ...items[index],
        statistic: JSON.stringify(getPath(item, name)),
    }));
}

output.markdown(description);

let { youtubeKey, table, videoField, destinationField, statistic } = settings;

let query = await table.selectRecordsAsync({ fields: [videoField.id] });
let bareItems = query.records
    .map((record) => ({
        record: record,
        videoId: parseId(record.getCellValueAsString(videoField.id)),
    }))
    .filter((item) => item.videoId);
let annotatedItems = [];

output.text(`Total number of records: ${query.records.length}`);
output.text(`Number of records with valid URLs: ${bareItems.length}`);

while (bareItems.length) {
    let workingSet = bareItems.splice(0, maxYoutubeResults);

    output.text(`Fetching statistics for ${workingSet.length} videos...`);

    annotatedItems.push(
        ...(await fetchVideoData(youtubeKey, workingSet, statistic))
    );
}

while (annotatedItems.length) {
    let workingSet = annotatedItems.splice(0, maxAirtableWrites);

    output.text(`Updating ${workingSet.length} records...`);

    let records = workingSet.map((item) => ({
        id: item.record.id,
        fields: {
            [destinationField.id]:
                // If the destination field is an attachment, assume the
                // statistic is a URL (e.g. a video preview image) and set the
                // value accordingly.
                destinationField.type === "multipleAttachments"
                    ? [{ url: item.statistic }]
                    : parseInt(item.statistic.replaceAll('"','')),
        },
    }));
    
    await table.updateRecordsAsync(records);
}

output.text("Operation complete.");