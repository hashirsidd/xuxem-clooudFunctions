const admin = require('firebase-admin');
const { onRequest } = require("firebase-functions/v2/https");
const functions = require('firebase-functions');
// The Firebase Admin SDK to access Firestore.
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

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
            functions.logger.log("Successfully sent messageNotification", response);
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

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////                    /////////////////////////////////////////////   
///////////////////////////////////////////////  STRIPE FUNCTIONS  /////////////////////////////////////////////
//////////////////////////////////////////////                    /////////////////////////////////////////////   
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////                       //////////////////////////////////////// 
////////////////////////////////////////////        TODO           ////////////////////////////////////////   
///////////////////////////////////////////      UPDATE KEY       ////////////////////////////////////////
//////////////////////////////////////////  SWTICH TO LIVE MODE  ////////////////////////////////////////
/////////////////////////////////////////                       ////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////

const stripe = require('stripe')('sk_test_51NAUUYIwXLBQ5coy2wenOb1SzXnyHxpwBQNbxpfqQLN93S3pDOVFamiDlowelNUJQp0mVYsabBArds2Gy6RbOHFZ00jzzg39ZX');

exports.createCustomer = functions.https.onRequest(async (req, res) => {
    try {
        const { description, name, address, email } = req.body;

        const customer = await stripe.customers.create({
            description: description,
            name: name,
            email: email,
            address: {
                line1: address,
            },
            // livemode:true
        });
        // add customer data to firebase
        try {

            await admin.firestore().collection('stripeCustomer').doc(customer.id)
                .set({ 'customer': customer, 'clinicId': email }, { merge: true });
            await admin.firestore().collection('partners').doc(email)
                .set({ 'stripeCustomerId': customer.id }, { merge: true });
            functions.logger.log("Successfully added customer");
        } catch (error) {
            functions.logger.log("Error adding customer", error);
        }
        res.json({ customer });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

exports.createStripeToken = functions.https.onRequest(async (req, res) => {
    try {
        const { cardNumber, expMonth, expYear, cvc, email } = req.body;

        const token = await stripe.tokens.create({
            card: {
                number: cardNumber,
                exp_month: expMonth,
                exp_year: expYear,
                cvc: cvc,
            },
        });

        try {
            await admin.firestore().collection('partners').doc(email)
                .set({ 'stripeCardToken': token.id }, { merge: true });
            functions.logger.log("Successfully added token");
        } catch (error) {
            functions.logger.log("Error adding token", error);
        }

        res.json({ stripeToken: token.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


exports.createCard = functions.https.onRequest(async (req, res) => {
    try {
        const customerId = req.body.customerId;
        const stripeToken = req.body.stripeToken;

        const source = await stripe.customers.createSource(customerId, {
            source: stripeToken
        });

        try {
            await admin.firestore().collection('stripeCustomer').doc(customerId)
                .set({ 'card': source }, { merge: true });
            functions.logger.log("Successfully added card");
        } catch (error) {
            functions.logger.log("Error adding card", error);
        }

        res.json({ source });
    } catch (error) {
        res.status(500).json({ "Error": error.message });
    }
});


exports.createPlan = functions.https.onRequest(async (req, res) => {
    try {
        const { id, planName } = req.body;
        const product = await stripe.products.create({
            id: id,
            name: planName,
            active: true,
            // livemode:true
        });

        try {
            await admin.firestore().collection('plans').doc(String(id))
                .set({ 'plan': product });
            functions.logger.log("Successfully added plan");
        } catch (error) {
            functions.logger.log("Error adding plan", error);
        }

        res.json({ product });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

exports.createPrice = functions.https.onRequest(async (req, res) => {
    try {
        const { unit_amount, currency, interval, product } = req.body;

        const price = await stripe.prices.create({
            unit_amount: unit_amount,
            currency: currency,
            recurring: { interval },
            product: product,
            // livemode: true
        });

        try {
            await admin.firestore().collection('plans').doc(String(product))
                .set({ 'price': price }, { merge: true });
            functions.logger.log("Successfully added price");
        } catch (error) {
            functions.logger.log("Error adding price", error);
        }

        res.json({ price });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


exports.createSubscription = functions.https.onRequest(async (req, res) => {
    try {
        const { customer, price } = req.body;

        const subscription = await stripe.subscriptions.create({
            customer: customer,
            items: [
                { price: price },
            ],
            // livemode: true
        });

        try {
            await admin.firestore().collection('stripeCustomer').doc(customer)
                .set({ 'subscription': subscription }, { merge: true });
            functions.logger.log("Successfully added subscription");


            var planId = subscription.plan.product;
            const planSnapshot = await admin.firestore().collection('plans').doc(planId).get();
            const planData = planSnapshot.data();
            const planName = planData.plan.name;

            functions.logger.log("Plan name", planName);

            const stripeCustomerSnapshot = await admin.firestore().collection('stripeCustomer').doc(customer).get();
            const stripeCustomer = stripeCustomerSnapshot.data();
            var customerEmail = stripeCustomer.customer.email;

            functions.logger.log("Customer email", customerEmail);

            await admin.firestore().collection('notifications').doc(customerEmail).collection('allNotifications').add({
                "type": 'subscriptionCreated',
                'timestamp': admin.firestore.FieldValue.serverTimestamp(),
                "data": {
                    'notification': `${planName} has been subscribed successfully!`
                }
            });

            functions.logger.log("notification added");


            customerEmail = customerEmail.replace('@', '');

            const payload = {
                notification: {
                    title: `Subscription notification`,
                    body: `${planName} has been subscribed successfully!`,
                },
                topic: customerEmail,
            }
            try {
                const response = await admin.messaging().send(payload);
                console.log("Successfully sent Subscription notification", response);
            } catch (error) {
                console.log("Error sending Subscription notification", error);
            }
        } catch (error) {
            functions.logger.log("Error adding subscription", error);
        }

        res.json({ subscription });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    try {
        try {
            var data = req.body;
            var customerEmail = data.data.object.customer_email;
            var amount_due = data.data.object.amount_due
            const status = data.data.object.status;
            const hostedInvoiceUrl = data.data.object.hosted_invoice_url;
            const currency = data.data.object.currency;
            notification = '';
            
            if (data.type == "invoice.payment_succeeded" && status == 'paid') {

                notification = `${String(currency).toUpperCase()} ${amount_due / 100} has been charged successfully!`;
                
                await admin.firestore().collection('notifications').doc(customerEmail).collection('allNotifications').add({
                    "type": 'paymentSuccessful',
                    'timestamp': admin.firestore.FieldValue.serverTimestamp(),
                    "data": {
                        'notification': notification,
                        'invoiceUrl': hostedInvoiceUrl
                    }
                });

            } else {
                
                notification = `Failed to charge ${String(currency).toUpperCase()} ${amount_due / 100} for Xuxem.`;

                await admin.firestore().collection('notifications').doc(customerEmail).collection('allNotifications').add({
                    "type": 'paymentFailed',
                    'timestamp': admin.firestore.FieldValue.serverTimestamp(),
                    "data": {
                        'notification': notification
                    }
                });
            
            }

            functions.logger.log("notification added successfully");

            customerEmail = customerEmail.replace('@', '');

            const payload = {
                notification: {
                    title: `Payment notification`,
                    body: notification,
                },
                topic: customerEmail,
            }
            try {
                const response = await admin.messaging().send(payload);
                console.log("Successfully sent Payment notification", response);
            } catch (error) {
                console.log("Error sending Payment notification", error);
            }

            functions.logger.log("Successfull stripeWebhook");
        } catch (error) {
            functions.logger.log("Error stripeWebhook", error);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// // Start the server
// app.listen(port, () => {
//     console.log(`API server listening at http://localhost:${port}`);
// });