//import airtable blocks to use in the app
import {
    Box,
    Button,
    FieldPickerSynced,
    FieldPicker,
    initializeBlock,
    useBase,
    useRecords,
    useGlobalConfig,
    expandRecord,
    Loader,
    TablePickerSynced,
    TextButton,
    ViewPickerSynced,
} from '@airtable/blocks/ui';
//import from React framework
import React, {Fragment, useState} from 'react';

//define variables here
const TABLE_NAME = 'Video';
const EXTRACT_FIELD_NAME = 'TW-V';
const URL_FIELD_NAME = 'TW';
const API_ENDPOINT = 'https://import-twitter-video-views.herokuapp.com/?tweet_url=';
const MAX_RECORDS_PER_UPDATE = 50;

//user defined function
/*function to gather list of urls in a 'url' field and make api calls to the
Twitter API to get view counts of videos embedded in the tweet
*/
function TwitterVideoCountGrabber() {
    //these are necessary settings to use airtable 'bases'
    //table name and the url column are set here based on the
    //variables declared near the top of the code
    const base = useBase();
    const table = base.getTableByName(TABLE_NAME);
    const titleField = table.getFieldByName(URL_FIELD_NAME);


    // load the records ready to be updated
    // Only load the the 'url' field since that's the only requirement for the twitter api.
    const records = useRecords(table, {fields: [titleField]});

    // keep track of whether we have up update currently in progress - if there is, we want to hide
    // the update button so you can't have two updates running at once.
    const [isUpdateInProgress, setIsUpdateInProgress] = useState(false);


    // check whether we have permission to update our records or not. Any time we do a permissions
    // check like this, we can pass in undefined for values we don't yet know. Here, as we want to
    // make sure we can update the summary and image fields, we make sure to include them even
    // though we don't know the values we want to use for them yet.
    const permissionCheck = table.checkPermissionsForUpdateRecord(undefined, {
        [EXTRACT_FIELD_NAME]: undefined,
    });

    //function that's associated with button below this function
    async function onButtonClick() {
        setIsUpdateInProgress(true);
        const recordUpdates = await getExtractAndImageUpdatesAsync(table, titleField, records);
        await updateRecordsInBatchesAsync(table, recordUpdates);
        setIsUpdateInProgress(false);
    }

    //this function returns a button that will execute the api functionality
    return (
        <Box
            // center the button/loading spinner horizontally and vertically.
            position="absolute"
            top="0"
            bottom="0"
            left="0"
            right="0"
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
        >
            {isUpdateInProgress ? (
                <Loader />
            ) : (
                <Fragment>
                    <Button
                        variant="primary"
                        onClick={onButtonClick}
                        disabled={!permissionCheck.hasPermission}
                        marginBottom={3}
                    >
                        Update summaries and images
                    </Button>
                    {!permissionCheck.hasPermission &&
                        // when we don't have permission to perform the update, we want to tell the
                        // user why. `reasonDisplayString` is a human-readable string that will
                        // explain why the button is disabled.
                        permissionCheck.reasonDisplayString}
                </Fragment>
            )}
        </Box>
    );
}

//This function does the fetching of the data via the Twitter API
async function getExtractAndImageUpdatesAsync(table, titleField, records) {
    const recordUpdates = [];
    for (const record of records) {
        // for each record, we take the article title and make an API request:
        const articleTitle = record.getCellValueAsString(titleField);
        const requestUrl = `${API_ENDPOINT}` + articleTitle;
        const response = await fetch(requestUrl, {cors: true});
        const pageSummary = await response.json();
        console.log(articleTitle);
        console.log(pageSummary);

        if(articleTitle === null || articleTitle === "") {
            continue;
        }
        if(!articleTitle.match("/status/")) {
            continue;
        }
        if(pageSummary == null) {
            continue;
        }

        // then, we can use the result of that API request to decide how we want to update our
        // record. To update an attachment, you need an array of objects with a `url` property.
        recordUpdates.push({
            id: record.id,
            fields: {
                [EXTRACT_FIELD_NAME]: pageSummary.view_count,
            },
        });

        //throttling the calls so we don't overload anything.
        await delayAsync(50);
    }
    return recordUpdates;
}

//updating in batches function
async function updateRecordsInBatchesAsync(table, recordUpdates) {
    // Fetches & saves the updates in batches of MAX_RECORDS_PER_UPDATE to stay under size limits.
    
    let i = 0;
    while (i < recordUpdates.length) {
        const updateBatch = recordUpdates.slice(i, i + MAX_RECORDS_PER_UPDATE);
        // await is used to wait for the update to finish saving to Airtable servers before
        // continuing. This means we'll stay under the rate limit for writes.
        console.log(updateBatch);
        await table.updateRecordsAsync(updateBatch);
        i += MAX_RECORDS_PER_UPDATE;
    }
    console.log("We are in batches, we don't need no batches");
}

//so we don't overload the system.
function delayAsync(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

initializeBlock(() => <TwitterVideoCountGrabber />);
