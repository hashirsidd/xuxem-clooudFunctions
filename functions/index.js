const admin = require('firebase-admin');
const { onRequest } = require("firebase-functions/v2/https");
const functions = require('firebase-functions');
// The Firebase Admin SDK to access Firestore.
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

exports.newMessageNotification = functions.firestore
    .document("/messages/{documentId}").onCreate(async (event, context) => {
        const data = event.data();
        admin.firestore().collection('notifications').doc(data.clinicId).collection('allNotifications').add({
            "type": 'message',
            'timestamp': admin.firestore.FieldValue.serverTimestamp(),
            "data": {
                'text': data.messageText,
                'offerId': data.offerId,
                'userId': data.userId,
            }
        });
        var clinicId = data.clinicId;
        clinicId = clinicId.replace('@', '');
        const payload = {
            notification: {
                title: `New message`,
                body: `${data.messageText}`,
            },
            topic: clinicId,
        }
        try {
            const response = await admin.messaging().send(payload);
            functions.logger.log("Successfully sent messageNotification",response);
        } catch (error) {
            functions.logger.log("Error sending newMessageNotification", error);
        }
    });


exports.offerUpdateNotification = functions.firestore
    .document("/offers/{documentId}").onUpdate(async (event, context) => {
        // Grab the current value of what was written to Firestore.
        const data = event.after.data();
        admin.firestore().collection('notifications').doc(data.clinicID).collection('allNotifications').add({
            "type": 'offerUpdate',
            'timestamp': admin.firestore.FieldValue.serverTimestamp(),
            "data": {
                'offerTitle': data.offerTitle,
                'status': data.status,
                'offerId': context.params.documentId,
            }
        });
        var clinicId = data.clinicID;
        clinicId = clinicId.replace('@', '');
        const payload = {
            notification: {
                title: `Offer updated`,
                body: `Your offer has been updated!`,
            },
            topic: clinicId,
        }
        try {
            const response = await admin.messaging().send(payload);
            functions.logger.log("Successfully sent offerUpdateNotification", response);
        } catch (error) {
            functions.logger.log("Error sending offerUpdateNotification", error, data.clinicID);
        }
        return 0;
    });

exports.offerCreateNotification = functions.firestore
    .document("/offers/{documentId}").onCreate(async (event, context) => {
        // Grab the current value of what was written to Firestore.
        const data = event.data();
        admin.firestore().collection('notifications').doc(data.clinicID).collection('allNotifications').add({
            "type": 'offerCreate',
            'timestamp': admin.firestore.FieldValue.serverTimestamp(),
            "data": {
                'offerTitle': data.offerTitle,
                'status': data.status,
                'offerId': context.params.documentId,
            }
        });
        var clinicId = data.clinicID;
        clinicId = clinicId.replace('@', '');
        const payload = {
            notification: {
                title: `Offer created`,
                body: `Your new offer has been created!`,
            },
            topic: clinicId,
        }
        try {
            const response = await admin.messaging().send(payload);
            console.log("Successfully sent offerCreateNotification", response);
        } catch (error) {
            console.log("Error sending offerCreateNotification", error);
        }
    });

exports.partnersUpdateNotification = functions.firestore
    .document("/partners/{documentId}").onUpdate(async (event, context) => {
        const data = event.after.data();
        admin.firestore().collection('notifications').doc(context.params.documentId).collection('allNotifications').add({
            "type": 'partnersUpdate',
            'timestamp': admin.firestore.FieldValue.serverTimestamp(),
            "data": {
                'notification': 'partners data updated!'
            }
        });
        var clinicId = context.params.documentId;
        clinicId = clinicId.replace('@', '');

        const payload = {
            notification: {
                title: `Partners updated`,
                body: `Partners profile has been updated!`,
            },
            topic: clinicId,
        }
        try {
            const response = await admin.messaging().send(payload);
            console.log("Successfully sent partnersUpdateNotification", response);
        } catch (error) {
            console.log("Error sending partnersUpdateNotification", error);
        }
    });