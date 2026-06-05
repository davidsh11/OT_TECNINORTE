require("dotenv").config();

const admin = require("firebase-admin");

const OT_COLLECTION = process.env.FIRESTORE_OT_COLLECTION || "OT_Ordenes";
let firebaseProjectId = process.env.FIREBASE_PROJECT_ID || "";

function getFirebaseCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    serviceAccount.private_key = serviceAccount.private_key?.replace(/\\n/g, "\n");
    firebaseProjectId = firebaseProjectId || serviceAccount.project_id;
    return admin.credential.cert(serviceAccount);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const serviceAccountPath =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const serviceAccount = require(serviceAccountPath);
    firebaseProjectId = firebaseProjectId || serviceAccount.project_id;
    return admin.credential.cert(serviceAccount);
  }

  return admin.credential.applicationDefault();
}

function initFirebase() {
  if (admin.apps.length) return;

  admin.initializeApp({
    credential: getFirebaseCredential(),
    projectId: firebaseProjectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

function getFirebase() {
  initFirebase();

  return {
    admin,
    db: admin.firestore(),
    bucket: process.env.FIREBASE_STORAGE_BUCKET ? admin.storage().bucket() : null,
    collection: OT_COLLECTION
  };
}

module.exports = {
  admin,
  getFirebase,
  initFirebase,
  OT_COLLECTION
};
