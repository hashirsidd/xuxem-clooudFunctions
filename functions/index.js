const admin = require('firebase-admin');
const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Define your API routes here
app.get('/:id', (req, res) => res.send(Widgets.getById(req.params.id)));
app.post('/', (req, res) => res.send(Widgets.create()));
app.put('/:id', (req, res) => res.send(Widgets.update(req.params.id, req.body)));
app.delete('/:id', (req, res) => res.send(Widgets.delete(req.params.id)));
app.get('/', (req, res) => res.send(Widgets.list()));

// Expose Express API as a single Cloud Function:
exports.widgets = functions.https.onRequest(app);

admin.initializeApp();


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
            },
            'read': false
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
                'notification': 'You offer has been updated!'
            },
            'read': false
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
                'notification': 'You offer has been created!'
            },
            'read': false
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
                'notification': 'Partners profile has been updated!'
            },
            'read': false
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
        res.set('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
            // Send response to OPTIONS requests
            res.set('Access-Control-Allow-Methods', '*');
            res.set('Access-Control-Allow-Headers', '*');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
            return;
        }
        const { name, email, address } = req.body;
        functions.logger.log(`Request body:`, req.body);

        const customer = await stripe.customers.create({
            name: name,
            email: email,
            address: {
                line1: address,
            },
            // livemode:true
        });
        // add customer data to firebase
        functions.logger.log(` create customer ${name} ${email} ${customer.id}`);
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
        functions.logger.log(`Error in create customer ${error.message}`);
        res.status(500).json({ 'Error in create customer': error.message });
    }
});

exports.createStripeToken = functions.https.onRequest(async (req, res) => {
    try {
        res.set('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
            // Send response to OPTIONS requests
            res.set('Access-Control-Allow-Methods', '*');
            res.set('Access-Control-Allow-Headers', '*');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
            return;
        }
        const { cardNumber, expMonth, expYear, cvc, stripeCustomerId } = req.body;

        const token = await stripe.tokens.create({
            card: {
                number: cardNumber,
                exp_month: expMonth,
                exp_year: expYear,
                cvc: cvc,
            },
        });

        try {
            await admin.firestore().collection('stripeCustomer').doc(stripeCustomerId)
                .set({ 'stripeCardToken': token.id }, { merge: true });
            functions.logger.log("Successfully added token");
        } catch (error) {
            functions.logger.log("Error adding token", error);
        }

        res.json({ stripeToken: token.id });
    } catch (error) {
        functions.logger.log("Error creating token", error);
        res.status(500).json({ 'error': error });
    }
});


exports.createCard = functions.https.onRequest(async (req, res) => {
    try {
        res.set('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
            // Send response to OPTIONS requests
            res.set('Access-Control-Allow-Methods', '*');
            res.set('Access-Control-Allow-Headers', '*');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
            return;
        }
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
        functions.logger.log("Error adding card", error);
        res.status(500).json({ "Error": error.toString() });
    }
});


exports.createPlan = functions.https.onRequest(async (req, res) => {
    try {
        res.set('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
            // Send response to OPTIONS requests
            res.set('Access-Control-Allow-Methods', '*');
            res.set('Access-Control-Allow-Headers', '*');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
            return;
        }
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
        res.set('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
            // Send response to OPTIONS requests
            res.set('Access-Control-Allow-Methods', '*');
            res.set('Access-Control-Allow-Headers', '*');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
            return;
        }
        const { unit_amount, currency, interval, planId } = req.body;

        const price = await stripe.prices.create({
            unit_amount: unit_amount,
            currency: currency,
            recurring: { interval },
            product: planId,
            // livemode: true
        });

        try {
            await admin.firestore().collection('plans').doc(String(planId))
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
        res.set('Access-Control-Allow-Origin', '*');
        if (req.method === 'OPTIONS') {
            // Send response to OPTIONS requests
            res.set('Access-Control-Allow-Methods', '*');
            res.set('Access-Control-Allow-Headers', '*');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
            return;
        }
        const { customer, planId } = req.body;


        const planSnapshot = await admin.firestore().collection('plans').doc(planId).get();
        const planData = planSnapshot.data();
        const priceId = planData.price.id;
        const planName = planData.plan.name;

        functions.logger.log("Plan name", planName);

        const subscription = await stripe.subscriptions.create({
            customer: customer,
            items: [
                { price: priceId },
            ],
            // livemode: true
        });

        try {
            await admin.firestore().collection('stripeCustomer').doc(customer)
                .set({ 'subscription': subscription }, { merge: true });
            functions.logger.log("Successfully added subscription");


            const stripeCustomerSnapshot = await admin.firestore().collection('stripeCustomer').doc(customer).get();
            const stripeCustomer = stripeCustomerSnapshot.data();
            var customerEmail = stripeCustomer.customer.email;
            var allowedOffersCount = 0;
            if (planId == 'basic') {
                allowedOffersCount = 2;
            } else if (planId == 'silver') {
                allowedOffersCount = 5;
            } else {
                allowedOffersCount = 10;
            }
            await admin.firestore().collection('partners').doc(customerEmail)
                .set({ 'subscription': planName, 'paymentStatus': 'UNPAID', 'isPayPalCustomer': false, 'allowedOffersCount': allowedOffersCount }, { merge: true });
            functions.logger.log("Successfully added subscription to partners");

            await admin.firestore().collection('notifications').doc(customerEmail).collection('allNotifications').add({
                "type": 'subscriptionCreated',
                'timestamp': admin.firestore.FieldValue.serverTimestamp(),
                "data": {
                    'notification': `${planName} has been subscribed successfully!`
                },
                'read': false
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
                functions.logger.log("Successfully sent Subscription notification", response);
            } catch (error) {
                functions.logger.log("Error sending Subscription notification", error);
            }
        } catch (error) {
            functions.logger.log("Error adding subscription", error);
        }
        res.json({ subscription });
    } catch (error) {
        functions.logger.log("Error in create subscription", error);
        res.status(500).json({ error: error.message });
    }
});

exports.cancelStripeUserSubscription = functions.https.onRequest(async (req, res) => {
    try {
        res.set('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
            // Send response to OPTIONS requests
            res.set('Access-Control-Allow-Methods', '*');
            res.set('Access-Control-Allow-Headers', '*');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
            return;
        }
        const { stripeCustomerId } = req.body;

        const subscriptionSnapshot = await admin.firestore().collection('stripeCustomer').doc(stripeCustomerId).get();
        const subscriptionData = subscriptionSnapshot.data();
        var customerEmail = subscriptionData.clinicId;
        var subscriptionId = subscriptionData.subscription.id;

        await cancelStripeSubscription(subscriptionId, stripeCustomerId, customerEmail);

        await admin.firestore().collection('partners').doc(customerEmail)
            .set({ 'paymentStatus': 'UNPAID', 'isPayPalCustomer': false, }, { merge: true });
        functions.logger.log("Successfully updated payment to partners");

        await updateOfferStatus(customerEmail, 'UNPAID');
        functions.logger.log("Successfully updated offerstatus to unpaid");

        res.status(200).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function cancelStripeSubscription(subscriptionId, stripeCustomerId, customerEmail) {
    try {

        const deleted = await stripe.subscriptions.cancel(subscriptionId);

        await admin.firestore().collection('stripeCustomer').doc(stripeCustomerId)
            .set({ 'subscription': deleted }, { merge: true });
        functions.logger.log("Successfully cancelled subscription");

        await admin.firestore().collection('notifications').doc(customerEmail).collection('allNotifications').add({
            "type": 'subscriptionCancelled',
            'timestamp': admin.firestore.FieldValue.serverTimestamp(),
            "data": {
                'notification': `Your subscription has been cancelled!`
            },
            'read': false
        });

        functions.logger.log("notification added");


        customerEmail = customerEmail.replace('@', '');

        const payload = {
            notification: {
                title: `Subscription notification`,
                body: `Your subscription has been cancelled!`,
            },
            topic: customerEmail,
        }
        try {
            const response = await admin.messaging().send(payload);
            functions.logger.log("Successfully sent Subscription notification", response);
        } catch (error) {
            functions.logger.log("Error sending Subscription notification", error);
        }

        return deleted;
    } catch (error) {
        functions.logger.log('Error cancelStripeSubscription :', error);
        throw new functions.https.HttpsError('internal', 'Failed to cancel stripe subscription.');
    }
}


async function retriveSubsCription(id) {
    const subscription = await stripe.subscriptions.retrieve(id);
    return {
        'start': subscription.current_period_start,
        'end': subscription.current_period_end
    };
}

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    try {
        res.set('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
            // Send response to OPTIONS requests
            res.set('Access-Control-Allow-Methods', '*');
            res.set('Access-Control-Allow-Headers', '*');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
            return;
        }
        try {
            var data = req.body;
            var customerEmail = data.data.object.customer_email;
            var amount_due = data.data.object.amount_due
            const status = data.data.object.status;
            const hostedInvoiceUrl = data.data.object.hosted_invoice_url;
            const currency = data.data.object.currency;
            var notification = '';
            var paymentStatus = '';
            if (data.type == "invoice.payment_succeeded" && status == 'paid') {
                paymentStatus = 'PAID';
                notification = `${String(currency).toUpperCase()} ${amount_due / 100} has been charged successfully!`;
                await admin.firestore().collection('notifications').doc(customerEmail).collection('allNotifications').add({
                    "type": 'paymentSuccessful',
                    'timestamp': admin.firestore.FieldValue.serverTimestamp(),
                    "data": {
                        'notification': notification,
                        'invoiceUrl': hostedInvoiceUrl
                    },
                    'read': false
                });

                var subscriptionData = await retriveSubsCription(data.data.object.subscription)

                await admin.firestore().collection('invoices').doc(customerEmail).collection('allInvoices').add({
                    'status': 'PAID',
                    'amount': `${data.data.object.amount_paid / 100}`,
                    'start': subscriptionData.start,
                    'end': subscriptionData.end,
                    'timestamp': admin.firestore.FieldValue.serverTimestamp(),
                    'mode': 'Stripe'
                });

            } else {
                paymentStatus = 'UNPAID';
                notification = `Failed to charge ${String(currency).toUpperCase()} ${amount_due / 100} for Xuxem.`;

                await admin.firestore().collection('notifications').doc(customerEmail).collection('allNotifications').add({
                    "type": 'paymentFailed',
                    'timestamp': admin.firestore.FieldValue.serverTimestamp(),
                    "data": {
                        'notification': notification
                    },
                    'read': false
                });

                await admin.firestore().collection('invoices').doc(customerEmail).collection('allInvoices').add({
                    'status': 'UNPAID',
                    'amount': `${amount_due / 100}`,
                    'start': '',
                    'end': '',
                    'timestamp': admin.firestore.FieldValue.serverTimestamp(),
                    'mode': 'Stripe'
                });
                const partnersSnapshot = await admin.firestore().collection('partners').doc(customerEmail).get();
                const stripeCustomerId = partnersSnapshot.data().stripeCustomerId;

                const stripeCustomerSnapshot = await admin.firestore().collection('stripeCustomer').doc(stripeCustomerId).get();
                const subscriptionId = stripeCustomerSnapshot.data().subscription.id;

                await cancelStripeSubscription(subscriptionId, stripeCustomerId, customerEmail);

            }
            functions.logger.log("notification added successfully");

            await admin.firestore().collection('partners').doc(customerEmail)
                .set({ 'paymentStatus': paymentStatus }, { merge: true });
            functions.logger.log("Successfully updated payment status in partners");

            const collectionRef = admin.firestore().collection('offers');
            const querySnapshot = await collectionRef.where('clinicID', '==', customerEmail).get();

            const batch = admin.firestore().batch();
            querySnapshot.forEach((doc) => {
                const docRef = collectionRef.doc(doc.id);
                batch.set(docRef, { 'paymentStatus': paymentStatus }, { merge: true });
            });

            await batch.commit();
            functions.logger.log("offers updated successfully");

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

    res.status(200).end();
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////                    /////////////////////////////////////////////   
///////////////////////////////////////////////  PAYPAL FUNCTIONS  /////////////////////////////////////////////
//////////////////////////////////////////////                    /////////////////////////////////////////////   
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////


// Cloud Function to create a PayPal subscription
exports.createPayPalSubscriptionFromWeb = functions.https.onRequest(async (req, res) => {
    try {
        res.set('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
            // Send response to OPTIONS requests
            res.set('Access-Control-Allow-Methods', '*');
            res.set('Access-Control-Allow-Headers', '*');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
            return;
        }
        var paypalPlanId = '';
        if (req.body.planId == 'basic') {
            paypalPlanId = 'P-9UJ10753XJ220052RMR3P7WI';
        } else if (req.body.planId == 'silver') {
            paypalPlanId = 'P-11P16354YF360924MMR3P7MA';
        } else {
            paypalPlanId = 'P-8HM69091A9729273HMR3P7AY';
        }

        const returnUrl = 'https://www.google.com/search?q=successs';
        const cancelUrl = 'https://www.google.com/search?q=cancel';
        const accessToken = await getAccessToken();
        const subscription = await createSubscription(accessToken, paypalPlanId, returnUrl, cancelUrl, req.body.customerEmail);

        res.json({ success: true, subscriptionUrl: subscription.links[0].href, subscription: subscription });
    } catch (error) {
        functions.logger.log('Error creating PayPal subscription:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create PayPal subscription.');
    }
});

// Cloud Function to create a PayPal subscription
exports.createPayPalSubscription = functions.https.onRequest(async (req, res) => {
    try {
        res.set('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
            // Send response to OPTIONS requests
            res.set('Access-Control-Allow-Methods', '*');
            res.set('Access-Control-Allow-Headers', '*');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
            return;
        }
        var paypalPlanId = '';
        if (req.body.planId == 'basic') {
            paypalPlanId = 'P-9UJ10753XJ220052RMR3P7WI';
        } else if (req.body.planId == 'silver') {
            paypalPlanId = 'P-11P16354YF360924MMR3P7MA';
        } else {
            paypalPlanId = 'P-8HM69091A9729273HMR3P7AY';
        }

        const returnUrl = 'https://xuxem.page.link/VKHLNT867qz2UjCBA';
        const cancelUrl = 'https://xuxem.page.link/dqFsAKZ9Cm5dL22y8';
        const accessToken = await getAccessToken();
        const subscription = await createSubscription(accessToken, paypalPlanId, returnUrl, cancelUrl, req.body.customerEmail);

        res.json({ success: true, subscriptionUrl: subscription.links[0].href, subscription: subscription });
    } catch (error) {
        functions.logger.log('Error creating PayPal subscription:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create PayPal subscription.');
    }
});

// Helper function to retrieve PayPal access token
async function getAccessToken() {
    try {
        const clientId = 'AVPInFt4P71ZV60uDtgJnVrG3HaZ-XI3gbU1dvzLHQP7_OqvbY76tseuZv0cNOE3p5YCfP635-AY2j2a';
        const clientSecret = 'EDcQ2di1vKJWsA0ySWabpz9iOfCvNWLJfZsw544vwYqKD35UsV00lH6SLCtDVRMDxUZEYLvQbZWbEBSE';
        const authString = `${clientId}:${clientSecret}`;
        const base64Auth = Buffer.from(authString).toString('base64');
        const response = await axios.post('https://api.sandbox.paypal.com/v1/oauth2/token', 'grant_type=client_credentials', {
            headers: {
                'Authorization': `Basic ${base64Auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        return response.data.access_token;
    } catch (error) {
        functions.logger.log('Error getting PayPal access token:', error);
        throw new functions.https.HttpsError('internal', 'Failed to get PayPal access token.');
    }
}

// Helper function to create a PayPal subscription
async function createSubscription(accessToken, planId, returnUrl, cancelUrl, customerEmail) {
    try {
        const response = await axios.post('https://api.sandbox.paypal.com/v1/billing/subscriptions', {
            plan_id: planId,
            subscriber: {
                email_address: customerEmail,
            },
            application_context: {
                brand_name: "XUXEM",
                locale: "en-US",
                user_action: "SUBSCRIBE_NOW",
                payment_method: {
                    payer_selected: "PAYPAL",
                    payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED"
                },
                return_url: returnUrl,
                cancel_url: cancelUrl
            }
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        var planName = getPlanName(planId);
        var subscriptionId = response.data.id;

        var fPlanId = getPlanId(planId);
        var allowedOffersCount = 0;

        if (fPlanId == 'basic') {
            allowedOffersCount = 2;
        } else if (fPlanId == 'silver') {
            allowedOffersCount = 5;
        } else {
            allowedOffersCount = 10;
        }

        //add data to partners table
        await admin.firestore().collection('partners').doc(customerEmail)
            .set({ 'subscription': planName, 'paymentStatus': 'UNPAID', 'isPayPalCustomer': true, 'payPalSubscriptionId': subscriptionId, 'allowedOffersCount': allowedOffersCount }, { merge: true });
        functions.logger.log("Successfully added subscription to partners");

        await admin.firestore().collection('payPalSubscriptions').doc(subscriptionId)
            .set({
                'subscription': planName,
                'clinicId': customerEmail,
                'subscriptionStatus': response.data.status,
                'time': response.data.create_time,
                'payPalPlanId': planId,
                'subscriptionId': subscriptionId,
            }, { merge: true });

        functions.logger.log("Successfully added data to PayPalSubscription");

        return response.data;
    } catch (error) {
        functions.logger.log('Error creating PayPal subscription:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create PayPal subscription.');
    }
}

function getPlanName(payPalPlanId) {
    if (payPalPlanId == 'P-9UJ10753XJ220052RMR3P7WI') {
        return 'Basic plan';
    } else if (payPalPlanId == 'P-11P16354YF360924MMR3P7MA') {
        return 'Silver plan';
    } else {
        return 'Gold plan';
    }
}

function getPlanId(payPalPlanId) {
    if (payPalPlanId == 'P-9UJ10753XJ220052RMR3P7WI') {
        return 'basic';
    } else if (payPalPlanId == 'P-11P16354YF360924MMR3P7MA') {
        return 'silver';
    } else {
        return 'gold';
    }
}
// Cloud Function to create a PayPal subscription
exports.cancelPayPalSubscription = functions.https.onRequest(async (req, res) => {
    try {
        res.set('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
            // Send response to OPTIONS requests
            res.set('Access-Control-Allow-Methods', '*');
            res.set('Access-Control-Allow-Headers', '*');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
            return;
        }
        const subscriptionId = req.body.subscriptionId;
        const reason = req.body.reason;

        const result = await cancelPayPalUserSubscription(subscriptionId, reason);

        if (result == 204) {
            res.status(200).end();
        } else {
            functions.logger.log('Failed to create cancel subscription :');
            res.status(result).json({ error: 'Failed to cancel subscription' });
        }
    } catch (error) {
        functions.logger.log('Error cancel PayPal subscription from cancelPayPalSubscription:', error);
        throw new functions.https.HttpsError('internal', 'Failed to cancel PayPal subscription.');
    }
});

async function cancelPayPalUserSubscription(subscriptionId, reason) {
    try {
        const accessToken = await getAccessToken();

        const response = await axios.post(`https://api.sandbox.paypal.com/v1/billing/subscriptions/${subscriptionId}/cancel`, {
            "reason": reason
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        return response.status;
    } catch (error) {
        functions.logger.log('Error canceling PayPal subscription from cancelPayPalUserSubscription:', error);
        if (error.response) {
            return error.response.status;
        } else {
            throw new functions.https.HttpsError('internal', 'Failed to cancel PayPal subscription.');
        }
    }
}

exports.payPalWebhookHandler = functions.https.onRequest(async (req, res) => {
    try {
        res.set('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
            // Send response to OPTIONS requests
            res.set('Access-Control-Allow-Methods', '*');
            res.set('Access-Control-Allow-Headers', '*');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
            return;
        }
        // await admin.firestore().collection('paypalWebhooks').add({
        //     'data': req.body
        // });
        functions.logger.log("Successfull Webhook");

        if (req.body.event_type == 'BILLING.SUBSCRIPTION.CREATED') {
            // await subscriptionCreated(req.body);
        } else if (req.body.event_type == 'BILLING.SUBSCRIPTION.ACTIVATED') {
            await subscriptionActivated(req.body);
        } else if (req.body.event_type == 'BILLING.SUBSCRIPTION.CANCELLED') {
            await subscriptionCancelled(req.body);
        } else if (req.body.event_type == 'BILLING.SUBSCRIPTION.SUSPENDED') {
            await subscriptionSuspended(req.body);
        } else if (req.body.event_type == 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
            await subscriptionPaymentFailed(req.body);
        }

        res.status(200).end();
    } catch (error) {
        functions.logger.log("Error stripeWebhook", error);
        res.status(500).json({ error: error.message });
    }
});

async function subscriptionPaymentFailed(data) {
    try {
        const time = data.create_time;
        const subscriptionId = data.resource.id;
        const subscriptionStatus = 'PAYMENT_FAILED';

        var subscriptionData = await admin.firestore().collection('payPalSubscriptions').doc(subscriptionId).get();
        var customerEmail = subscriptionData.data().clinicId;
        var payPalPlanId = subscriptionData.data().payPalPlanId;

        var planName = getPlanName(payPalPlanId);


        await admin.firestore().collection('notifications').doc(customerEmail).collection('allNotifications').add({
            "type": 'subscriptionSuspended',
            'timestamp': admin.firestore.FieldValue.serverTimestamp(),
            "data": {
                'notification': `${planName} payment failed!`,
            },
            'read': false
        });

        functions.logger.log("Successfully added notification");

        customerEmail = customerEmail.replace('@', '');

        const payload = {
            notification: {
                title: `Subscription notification`,
                body: `${planName} payment failed!`,
            },
            topic: customerEmail,
        }
        try {
            const response = await admin.messaging().send(payload);
            functions.logger.log("Successfully sent subscriptionPaymentFailed notification", response);
        } catch (error) {
            functions.logger.log("Error sending subscriptionPaymentFailed notification", error);
        }

        const result = await cancelPayPalUserSubscription(subscriptionId, 'Subscription cancelled due to payment failed!');

        if (result == 204) {
            res.status(200).end();
        } else {
            functions.logger.log('Failed to create cancel subscription :');
            res.status(result).json({ error: 'Failed to cancel subscription' });
        }
    } catch (error) {
        functions.logger.log('Failed to add subscriptionPaymentFailed details : ', error);
        throw new functions.https.HttpsError('internal', 'Failed to add subscriptionPaymentFailed details.');
    }
}

async function subscriptionSuspended(data) {
    try {
        const time = data.create_time;
        const subscriptionId = data.resource.id;
        const subscriptionStatus = data.resource.state;


        var subscriptionData = await admin.firestore().collection('payPalSubscriptions').doc(subscriptionId).get();
        var customerEmail = subscriptionData.data().clinicId;
        var payPalPlanId = subscriptionData.data().payPalPlanId;

        var planName = getPlanName(payPalPlanId);

        //add data to partners table
        await admin.firestore().collection('partners').doc(customerEmail)
            .set({ 'paymentStatus': 'UNPAID' }, { merge: true });
        functions.logger.log("Successfully added subscription to partners");

        //update offer status
        await updateOfferStatus(customerEmail, 'UNPAID');

        // add data to payPalSubscriptions
        await admin.firestore().collection('payPalSubscriptions').doc(subscriptionId)
            .set({
                'subscriptionStatus': subscriptionStatus,
                'time': time,
            }, { merge: true });
        functions.logger.log("Successfully added subscription to payPalSubscriptions");

        await admin.firestore().collection('notifications').doc(customerEmail).collection('allNotifications').add({
            "type": 'subscriptionSuspended',
            'timestamp': admin.firestore.FieldValue.serverTimestamp(),
            "data": {
                'notification': `${planName} subscription has been suspended!`,
            },
            'read': false
        });

        functions.logger.log("Successfully added notification");

        customerEmail = customerEmail.replace('@', '');

        const payload = {
            notification: {
                title: `Subscription notification`,
                body: `${planName} subscription has been suspended!`,
            },
            topic: customerEmail,
        }
        try {
            const response = await admin.messaging().send(payload);
            functions.logger.log("Successfully sent suspended notification", response);
        } catch (error) {
            functions.logger.log("Error sending suspended notification", error);
        }

    } catch (error) {
        functions.logger.log('Failed to add subscriptionSuspended details : ', error);
        throw new functions.https.HttpsError('internal', 'Failed to add subscriptionSuspended details.');
    }
}

async function subscriptionCancelled(data) {
    try {
        const time = data.create_time;
        const subscriptionId = data.resource.id;
        const payPalPlanId = data.resource.plan_id;
        const subscriptionStatus = data.resource.status;
        const note = data.resource.status_change_note;

        var planName = getPlanName(payPalPlanId);

        var subscriptionData = await admin.firestore().collection('payPalSubscriptions').doc(subscriptionId).get();
        var customerEmail = subscriptionData.data().clinicId;

        //add data to partners table
        await admin.firestore().collection('partners').doc(customerEmail)
            .set({ 'paymentStatus': 'UNPAID' }, { merge: true });
        functions.logger.log("Successfully added subscription to partners");

        //update offer status
        await updateOfferStatus(customerEmail, 'UNPAID');

        // add data to payPalSubscriptions
        await admin.firestore().collection('payPalSubscriptions').doc(subscriptionId)
            .set({
                'subscriptionStatus': subscriptionStatus,
                'time': time,
                'note': note,
            }, { merge: true });

        functions.logger.log("Successfully added subscription to payPalSubscriptions");

        await admin.firestore().collection('notifications').doc(customerEmail).collection('allNotifications').add({
            "type": 'subscriptionCancelled',
            'timestamp': admin.firestore.FieldValue.serverTimestamp(),
            "data": {
                'notification': `${planName} subscription has been cancelled!`,
            },
            'read': false
        });

        functions.logger.log("Successfully added notification");

        customerEmail = customerEmail.replace('@', '');

        const payload = {
            notification: {
                title: `Subscription notification`,
                body: `${planName} subscription has been cancelled!`,
            },
            topic: customerEmail,
        }
        try {
            const response = await admin.messaging().send(payload);
            functions.logger.log("Successfully sent payment notification", response);
        } catch (error) {
            functions.logger.log("Error sending payment notification", error);
        }

    } catch (error) {
        functions.logger.log('Failed to add subscriptionCancelled details : ', error);
        throw new functions.https.HttpsError('internal', 'Failed to add subscriptionCancelled details.');
    }
}

async function subscriptionActivated(data) {
    try {
        const time = data.create_time;
        const subscriptionId = data.resource.id;
        const payPalPlanId = data.resource.plan_id;
        const subscriptionStatus = data.resource.status;
        const amount = data.resource.billing_info.last_payment.amount['value'];

        var planName = getPlanName(payPalPlanId);

        var subscriptionData = await admin.firestore().collection('payPalSubscriptions').doc(subscriptionId).get();
        var customerEmail = subscriptionData.data().clinicId;

        //add data to partners table
        await admin.firestore().collection('partners').doc(customerEmail)
            .set({ 'paymentStatus': 'PAID' }, { merge: true });
        functions.logger.log("Successfully added subscription to partners");

        //update offer status
        await updateOfferStatus(customerEmail, 'PAID');

        // add data to payPalSubscriptions
        await admin.firestore().collection('payPalSubscriptions').doc(subscriptionId)
            .set({
                'subscription': planName,
                'clinicId': customerEmail,
                'subscriptionStatus': subscriptionStatus,
                'time': time,
                'payPalPlanId': payPalPlanId,
                'subscriptionId': subscriptionId,
                'cancelUrl': `https://api.sandbox.paypal.com/v1/billing/subscriptions/${subscriptionId}/cancel`
            }, { merge: true });
        functions.logger.log("Successfully added subscription to payPalSubscriptions");

        await admin.firestore().collection('invoices').doc(customerEmail).collection('allInvoices').add({
            'status': 'PAID',
            'amount': amount,
            'start': '',
            'end': '',
            'timestamp': admin.firestore.FieldValue.serverTimestamp(),
            'mode': 'PayPal'
        });


        await admin.firestore().collection('notifications').doc(customerEmail).collection('allNotifications').add({
            "type": 'paymentCharged',
            'timestamp': admin.firestore.FieldValue.serverTimestamp(),
            "data": {
                'notification': `EUR ${amount} has been charged successfully!`
            },
            'read': false
        });

        await admin.firestore().collection('notifications').doc(customerEmail).collection('allNotifications').add({
            "type": 'subscriptionActivated',
            'timestamp': admin.firestore.FieldValue.serverTimestamp(),
            "data": {
                'notification': `${planName} has been subscribed successfully!`
            },
            'read': false
        });

        functions.logger.log("Successfully added notification");

        customerEmail = customerEmail.replace('@', '');


        const payload = {
            notification: {
                title: `Subscription notification`,
                body: `${planName} has been subscribed successfully!`,
            },
            topic: customerEmail,
        }

        const payload2 = {
            notification: {
                title: `Subscription notification`,
                body: `EUR ${amount} has been charged successfully!`,
            },
            topic: customerEmail,
        }
        try {
            const response2 = await admin.messaging().send(payload2);
            functions.logger.log("Successfully sent payment notification", response2);
            const response = await admin.messaging().send(payload);
            functions.logger.log("Successfully sent payment notification", response);
        } catch (error) {
            functions.logger.log("Error sending payment notification", error);
        }

    } catch (error) {
        functions.logger.log('Failed to add subscriptionActivated details : ', error);
        throw new functions.https.HttpsError('internal', 'Failed to add subscriptionActivated details.');
    }


}

async function subscriptionCreated(data) {
    const payPalPlanId = data.resource.plan_id;
    var customerEmail = data.resource.subscriber.email_address;
    try {
        var planName = getPlanName(payPalPlanId);

        await admin.firestore().collection('notifications').doc(customerEmail).collection('allNotifications').add({
            "type": 'subscriptionCreated',
            'timestamp': admin.firestore.FieldValue.serverTimestamp(),
            "data": {
                'notification': `${planName} has been subscribed successfully!`
            },
            'read': false
        });
        functions.logger.log("Successfully added notification");

    } catch (error) {
        functions.logger.log('Failed to add subscriptionCreated details : ', error);
        throw new functions.https.HttpsError('internal', 'Failed to add subscriptionCreated details.');
    }

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
        functions.logger.log("Successfully sent Subscription notification", response);
    } catch (error) {
        functions.logger.log("Error sending Subscription notification", error);
    }
}

async function updateOfferStatus(customerEmail, paymentStatus) {
    try {
        const collectionRef = admin.firestore().collection('offers');
        const querySnapshot = await collectionRef.where('clinicID', '==', customerEmail).get();

        const batch = admin.firestore().batch();
        querySnapshot.forEach((doc) => {
            const docRef = collectionRef.doc(doc.id);
            batch.set(docRef, { 'paymentStatus': paymentStatus }, { merge: true });
        });

        await batch.commit();
        functions.logger.log("offers updated successfully");
    } catch (error) {
        functions.logger.log("offers update error: ", error);
        throw new functions.https.HttpsError('internal', 'Failed to update offer Status');
    }
}
