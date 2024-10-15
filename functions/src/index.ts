import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as fs from "fs";

interface Nasa {
  title: string;
  explanation: string;
  date: string;
}

interface SpaceXLaunch {
  name: string;
  details: string;
  date_utc: string;
}

interface SpaceXHistory {
  event_date_utc: string;
  title: string;
  details: string;
}

interface EonetEvent {
  id: string;
  title: string;
  description: string;
  link: string;
  categories: { id: string; title: string }[];
}

interface SpaceNews {
  nasa: Nasa;
  spacex: SpaceXLaunch;
  spacexHistory: SpaceXHistory[];
  eonet: EonetEvent[];
}


const NASA_API_KEY = functions.config().nasa.api_key;
const serviceAccountKeyPath = functions.config().service_account.key_path;

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  if (serviceAccountKeyPath) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountKeyPath, "utf8")
    );
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    logger.info("Firebase Admin SDK initialized with service account key.");
  } else {
    admin.initializeApp();
    logger.warn("No service account key provided. Using default credentials.");
  }
}

const firestore = admin.firestore();

// API URLs
const SPACEX_LAUNCH_URL = "https://api.spacexdata.com/v3/missions";
const NASA_APOD_URL = `https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}`;
const SPACEX_HIST_URL = "https://api.spacexdata.com/v4/history";
const NASA_EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/categories/severeStorms";
// const ADS_API_URL =
//   "https://api.adsabs.harvard.edu/v1/search/query?q=space&fl=title,author,abstract&rows=5";
// const ADS_API_TOKEN = ADS_API_KEY;

// Utility function to clear Firestore
const clearFirestore = async (): Promise<void> => {
  const collections = await firestore.listCollections();
  for (const collection of collections) {
    const snapshot = await collection.get();
    const batch = firestore.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    logger.info(`Cleared collection: ${collection.id}`);
  }
};

// Enhanced fetch function with logging and timing
const fetchWithLogging = async (
  url: string,
  apiName: string,
  headers: Record<string, string> = {}
) => {
  const startTime = Date.now();
  logger.info(`Starting to fetch data from ${apiName}: ${url}`);
  try {
    const response = await fetch(url, { headers });
    const elapsedTime = Date.now() - startTime;
    if (!response.ok) {
      throw new Error(`Failed to fetch ${apiName}, status: ${response.status}`);
    }
    const jsonData = await response.json();
    logger.info(`${apiName} fetched successfully in ${elapsedTime}ms`);
    logger.debug(
      `${apiName} returned data: ${JSON.stringify(jsonData).slice(0, 100)}...`
    );
    return jsonData;
  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    logger.error(`Error fetching ${apiName} after ${elapsedTime}ms: ${error}`);
    throw error;
  }
};

// Fetch Space-related Data from APIs
const fetchSpaceNews = async (): Promise<SpaceNews | null> => {
  try {
    logger.info("Starting to fetch all space-related data...");

    const nasaData = await fetchWithLogging(NASA_APOD_URL, "NASA APOD");
    logger.info(`NASA data fetched: ${JSON.stringify(nasaData).slice(0, 100)}`);

    const spacexData = await fetchWithLogging(
      SPACEX_LAUNCH_URL,
      "SpaceX Launch"
    );
    logger.info(
      `SpaceX Launch data fetched: ${JSON.stringify(spacexData).slice(0, 100)}`
    );

    const spacexHistoryData = await fetchWithLogging(
      SPACEX_HIST_URL,
      "SpaceX History"
    );
    logger.info(
      `SpaceX History data fetched: ${JSON.stringify(spacexHistoryData).slice(
        0,
        100
      )}`
    );

    const eonetData = await fetchWithLogging(NASA_EONET_URL, "NASA EONET");
    logger.info(
      `NASA EONET data fetched: ${JSON.stringify(eonetData).slice(0, 100)}`
    );

    // const adsPapers = await fetchWithLogging(ADS_API_URL, "Ads Papers", {
    //   Authorization: `Bearer ${ADS_API_TOKEN}`,
    // });
    // logger.info(
    //   `ADS Papers fetched: ${JSON.stringify(adsPapers.response.docs).slice(
    //     0,
    //     100
    //   )}`
    // );

    return {
      nasa: nasaData as Nasa,
      spacex: spacexData as SpaceXLaunch,
      spacexHistory: spacexHistoryData as SpaceXHistory[],
      eonet: eonetData as EonetEvent[],
    //   adsPapers: (adsPapers as { response: { docs: AdsPaper[] } }).response
    //     .docs,
    };
  } catch (error) {
    logger.error("Error fetching space news:", error);
    return null;
  }
};

// Store data in Firestore
const fetchAndStoreSpaceNews = async (): Promise<void> => {
  try {
    await clearFirestore(); // Clear Firestore before fetching new data
    const spaceNews = await fetchSpaceNews();
    if (spaceNews) {
      await firestore.collection("spaceNews").doc("latest").set(spaceNews);
      logger.info("Space news successfully stored in Firestore.");
    }
  } catch (error) {
    logger.error("Error storing space news:", error);
  }
};

// HTTP request handler for testing or manual invocation
export const fetchNewsHandler = onRequest(
  { timeoutSeconds: 3000 }, // Increase timeout to 5 minutes
  async (req, res) => {
    try {
      await fetchAndStoreSpaceNews();
      res.status(200).send("Space news fetched and stored.");
    } catch (error) {
      res.status(500).send("Error fetching space news.");
    }
  }
);

// Scheduled function to run every 2 days
export const scheduledApiFetch = onSchedule("every 48 hours", async () => {
  try {
    await fetchAndStoreSpaceNews();
    logger.info("Space news scheduled fetch completed.");
  } catch (error) {
    logger.error("Error fetching space news on schedule:", error);
  }
});
