const axios = require("axios");
const fs = require("fs");
const { format } = require("fast-csv");

function removeDuplicatesFromArray(array) {
  const uniqueObjects = [];

  // Helper function to check if an object is a duplicate
  function isDuplicate(obj) {
    return uniqueObjects.some(
      (uniqueObj) =>
        obj.date_released === uniqueObj.date_released &&
        obj.date_updated === uniqueObj.date_updated &&
        obj.title === uniqueObj.title
    );
  }

  for (const obj of array) {
    if (!isDuplicate(obj)) {
      uniqueObjects.push(obj);
    }
  }

  return uniqueObjects;
}

const getJSON = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(txt);
  }
  const json = await response.json();
  return json; // get JSON from the response
};

function findNewest(data, days) {
  var today = new Date();
  let newestArray = [];
  for (const obj in data) {
    // console.log("data[obj].date_released", data[obj].date_released);

    let dateUpdated = new Date(data[obj].date_updated);
    let dateReleased = new Date(data[obj].date_released);
    let dateToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - days
    );

    if (dateToday <= dateReleased) {
      data[obj].activityType = "Neu";
      newestArray.push(data[obj]);
    } else if (dateToday <= dateUpdated) {
      data[obj].activityType = "Update";
      newestArray.push(data[obj]);
    }
  }
  return newestArray;
}

function convertTimestamp(timestamp) {
  // Create a new Date object using the timestamp
  const date = new Date(timestamp);

  // Extract day, month, and year
  const day = date.getDate(); // Day of the month
  let month = date.getMonth() + 1; // Month is 0-indexed in JavaScript, so add 1
  month = month.toString().length === 1 ? "0" + month : month;
  const year = date.getFullYear(); // Year

  // Format the date in "day month year" format
  return `${day}.${month}.${year}`;
}

async function filterSavetoCSV(data) {
  // Extract the 'result' property
  let results = data.result;
  let filteredData = [];

  data.forEach((d) => {
    const oneEntry = {};
    const title = d?.title ? d?.title : "";
    oneEntry.Datum =
      d.activityType === "Neu"
        ? convertTimestamp(d.date_released)
        : convertTimestamp(d.date_updated);
    // const link =
    //   "https://daten.berlin.de/datensaetze/"
    const link =
      "https://daten.berlin.de/search/node/" +
      title.toString().replace(/\s/g, "%20");
    title.replaceAll(",", "").replaceAll(" - ", "-").replaceAll(" ", "-");
    oneEntry.Titel = `<a style='text-decoration: underline; line-height: 1.4;color: #222' href='${link}' target='_blank'>${title}</a>`;
    oneEntry.Art = d.activityType;
    filteredData.push(oneEntry);
  });

  filteredData.sort((a, b) => {
    const dateA = new Date(a.Datum.split(".").reverse().join("-"));
    const dateB = new Date(b.Datum.split(".").reverse().join("-"));

    return dateB - dateA;
  });

  // Create a writable stream for the CSV file
  const csvStream = format({ headers: true });
  const writableStream = fs.createWriteStream("./data/overviewDays.csv");
  writableStream.on("finish", () => {
    console.log(`Saved CSV`);
  });

  // Pipe the results to the CSV stream and then to the file
  csvStream.pipe(writableStream);
  filteredData.forEach((result) => csvStream.write(result));
  csvStream.end();

  const metaData = {
    annotate: {
      notes: "Zuletzt aktualisiert: " + convertTimestamp(new Date()),
    },
  };
  console.log(metaData);

  fs.writeFile(
    "./data/metaData.json",
    JSON.stringify(metaData),
    {
      encoding: "utf8",
    },
    (err) => {}
  );
}

async function runScript() {
  const days = 14;
  const dataUpdated = await getJSON(
    "https://datenregister.berlin.de/api/3/action/package_search?start=0&rows=100&sort=date_updated%20desc"
  );
  const dataReleased = await getJSON(
    "https://datenregister.berlin.de/api/3/action/package_search?start=0&rows=100&sort=date_released%20desc"
  );

  let resultsArray = [];
  for (const id in dataUpdated.result.results) {
    resultsArray = resultsArray.concat(dataUpdated.result.results[id]);
  }
  for (const id in dataReleased.result.results) {
    resultsArray = resultsArray.concat(dataReleased.result.results[id]);
  }

  const uniqueArray = removeDuplicatesFromArray(resultsArray);

  const newestData = findNewest(uniqueArray, days);

  filterSavetoCSV(newestData);

  console.log("newestData");
}

runScript();
