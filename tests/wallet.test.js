const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDatabase, getRedisClient } = require('../src/config/database');
const { cleanup } = require('./setup');

let riderToken;
let driverToken;

beforeAll(async () => {
    await connectDatabase();
    await cleanup();

    const riderRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
            name: 'Rider',
            email: 'rider4@test.com',
            phone: '9876543240',
            password: 'Test@1234',
            role: 'rider',
        });
    riderToken = riderRes.body.data.accessToken;

    const driverRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
            name: 'Driver',
            email: 'driver4@test.com',
            phone: '9876543241',
            password: 'Test@1234',
            role: 'driver',
        });
    driverToken = driverRes.body.data.accessToken;

    // Complete a full ride to generate wallet/ledger/notification data
    await request(app)
        .post('/api/v1/driver/online')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ longitude: 78.4867, latitude: 17.3850 });

    const rideRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({
            pickupCoords: [78.4867, 17.3850],
            destinationCoords: [78.5100, 17.4100],
            pickupAddress: 'A',
            destinationAddress: 'B',
        });

    const rideId = rideRes.body.data._id;

    await request(app)
        .post(`/api/v1/rides/${rideId}/respond`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ accept: true });

    await request(app)
        .patch(`/api/v1/rides/${rideId}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'DRIVER_ARRIVED' });

    await request(app)
        .patch(`/api/v1/rides/${rideId}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'IN_PROGRESS' });

    await request(app)
        .patch(`/api/v1/rides/${rideId}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'COMPLETED' });

    // Wait for Bull queue to process
    await new Promise((resolve) => setTimeout(resolve, 3000));
});

afterAll(async () => {
    await cleanup();
    await mongoose.disconnect();
    try {
        const redis = getRedisClient();
        await redis.quit();
    } catch (err) { }
});

describe('Wallet & Ledger', () => {
    test('GET /balance — rider has negative balance', async () => {
        const res = await request(app)
            .get('/api/v1/wallet/balance')
            .set('Authorization', `Bearer ${riderToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.balance).toBeLessThan(0);
    });

    test('GET /balance — driver has positive balance', async () => {
        const res = await request(app)
            .get('/api/v1/wallet/balance')
            .set('Authorization', `Bearer ${driverToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.balance).toBeGreaterThan(0);
    });

    test('GET /ledger — rider has ledger entries', async () => {
        const res = await request(app)
            .get('/api/v1/wallet/ledger')
            .set('Authorization', `Bearer ${riderToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });

    test('Ledger math: driver payout + platform fee = total fare', async () => {
        const res = await request(app)
            .get('/api/v1/wallet/ledger')
            .set('Authorization', `Bearer ${riderToken}`);

        const entries = res.body.data;
        const payment = entries.find((e) => e.type === 'RIDE_PAYMENT');
        const payout = entries.find((e) => e.type === 'DRIVER_PAYOUT');
        const fee = entries.find((e) => e.type === 'PLATFORM_FEE');

        expect(payment).toBeDefined();
        expect(payout).toBeDefined();
        expect(fee).toBeDefined();
        expect(payout.amount + fee.amount).toBe(payment.amount);
    });
});

describe('Notifications', () => {
    test('GET /notifications — rider has notifications', async () => {
        const res = await request(app)
            .get('/api/v1/wallet/notifications')
            .set('Authorization', `Bearer ${riderToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
    });

    test('PATCH /notifications/:id/read — mark as read', async () => {
        const notifRes = await request(app)
            .get('/api/v1/wallet/notifications')
            .set('Authorization', `Bearer ${riderToken}`);

        const notifId = notifRes.body.data[0]._id;

        const res = await request(app)
            .patch(`/api/v1/wallet/notifications/${notifId}/read`)
            .set('Authorization', `Bearer ${riderToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.isRead).toBe(true);
    });

    test('GET /notifications — driver has payment notification', async () => {
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'driver4@test.com', password: 'Test@1234' });

        const freshDriverToken = loginRes.body.data.accessToken;

        const res = await request(app)
            .get('/api/v1/wallet/notifications')
            .set('Authorization', `Bearer ${freshDriverToken}`);

        expect(res.statusCode).toBe(200);
        const paymentNotif = res.body.data.find((n) => n.type === 'PAYMENT_RECEIVED');
        expect(paymentNotif).toBeDefined();
    });
});