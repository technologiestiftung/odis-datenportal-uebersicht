const axios = require("axios");
const fs = require("fs");
const { format } = require("fast-csv");
// const { rawAll } = require("../data/rawAll");

const baseUrl = "https://datenregister.berlin.de/api/3/action/package_search";
const rowsPerPage = 1000;
let start = 0;
let allEntries = [];

const fetchAllEntries = async () => {
  while (true) {
    const url = `${baseUrl}?start=${start}&rows=${rowsPerPage}`;

    console.log("fetching", start, " ");

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        const packages = data.result.results;
        if (packages.length === 0) {
          // No more results, break the loop
          break;
        }

        // Add the current page of results to the allEntries array
        allEntries = allEntries.concat(packages);
        start += rowsPerPage;
      } else {
        console.error("API request failed:", data.error);
        break;
      }
    } catch (error) {
      console.error("Error making API request:", error);
      break;
    }
  }

  return allEntries;
};

const dates = {};

const getJSON = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(txt);
  }
  const json = await response.json();
  return json; // get JSON from the response
};

function sortByDate(obj) {
  const sortedKeys = Object.keys(obj).sort((a, b) => new Date(a) - new Date(b));

  const sortedObj = {};
  sortedKeys.forEach((key) => {
    sortedObj[key] = obj[key];
  });

  return sortedObj;
}

async function sumFileFormats() {
  fetchAllEntries()
    .then((data) => {
      data.forEach((res) => {
        const yearMonthUpdate = res.date_updated?.slice(0, 4);
        const yearMonthRelease = res.date_released?.slice(0, 4);

        const currentDate = new Date();
        const lastYear = currentDate.getFullYear() - 1;

        if (
          yearMonthUpdate < 2011 ||
          yearMonthRelease < 2011 ||
          yearMonthUpdate > lastYear ||
          yearMonthRelease > lastYear
        ) {
          return;
        }

        if (
          // release
          res.date_updated === res.date_released ||
          res.date_updated === undefined
        ) {
          if (!dates[yearMonthRelease]) {
            dates[yearMonthRelease] = { update: 0, release: 0 };
          }
          dates[yearMonthRelease].release = dates[yearMonthRelease].release + 1;
        } else {
          // update
          if (!dates[yearMonthUpdate]) {
            dates[yearMonthUpdate] = { update: 0, release: 0 };
          }
          dates[yearMonthUpdate].update = dates[yearMonthUpdate].update + 1;
        }
      });

      const sortedData = sortByDate(dates);

      const header = ["date"];
      const update = ["Updates"];
      const release = ["Neuerscheinungen"];

      for (const key in sortedData) {
        header.push(key);
        update.push(sortedData[key].update);
        release.push(sortedData[key].release);
      }

      let csv = header.toString() + "\n";
      csv += update.toString() + "\n";
      csv += release.toString() + "\n";

      fs.writeFile(
        "./data/overviewYears.csv",
        csv,
        {
          encoding: "utf8",
        },
        (err) => {}
      );
    })
    .catch((error) => {
      console.error("Error fetching entries:", error);
    });
}

sumFileFormats();
