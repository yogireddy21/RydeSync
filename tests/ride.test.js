const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDatabase, getRedisClient } = require('../src/config/database');
const { cleanup } = require('./setup');

let riderToken;
let driverToken;
let rideId;

beforeAll(async () => {
    await connectDatabase();
    await cleanup();

    const riderRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
            name: 'Rider',
            email: 'rider3@test.com',
            phone: '9876543230',
            password: 'Test@1234',
            role: 'rider',
        });
    riderToken = riderRes.body.data.accessToken;

    const driverRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
            name: 'Driver',
            email: 'driver3@test.com',
            phone: '9876543231',
            password: 'Test@1234',
            role: 'driver',
        });
    driverToken = driverRes.body.data.accessToken;

    await request(app)
        .post('/api/v1/driver/online')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ longitude: 78.4867, latitude: 17.3850 });
});

afterAll(async () => {
    await cleanup();
    await mongoose.disconnect();
    try {
        const redis = getRedisClient();
        await redis.quit();
    } catch (err) { }
});

describe('Ride Matching & Lifecycle', () => {
    test('POST /request — rider requests a ride', async () => {
        const res = await request(app)
            .post('/api/v1/rides/request')
            .set('Authorization', `Bearer ${riderToken}`)
            .send({
                pickupCoords: [78.4867, 17.3850],
                destinationCoords: [78.5100, 17.4100],
                pickupAddress: 'Koramangala',
                destinationAddress: 'Indiranagar',
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.data.status).toBe('MATCHED');
        expect(res.body.data.driver).toBeDefined();
        expect(res.body.data.fare.surgeMultiplier).toBeDefined();

        rideId = res.body.data._id;
    });

    test('POST /request — should reject duplicate active ride', async () => {
        const res = await request(app)
            .post('/api/v1/rides/request')
            .set('Authorization', `Bearer ${riderToken}`)
            .send({
                pickupCoords: [78.49, 17.39],
                destinationCoords: [78.52, 17.42],
                pickupAddress: 'X',
                destinationAddress: 'Y',
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain('active ride');
    });

    test('POST /respond — rider cannot accept (RBAC)', async () => {
        const res = await request(app)
            .post(`/api/v1/rides/${rideId}/respond`)
            .set('Authorization', `Bearer ${riderToken}`)
            .send({ accept: true });

        expect(res.statusCode).toBe(403);
    });

    test('POST /respond — driver accepts ride', async () => {
        const res = await request(app)
            .post(`/api/v1/rides/${rideId}/respond`)
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ accept: true });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.status).toBe('ACCEPTED');
    });

    test('PATCH /status — driver arrived', async () => {
        const res = await request(app)
            .patch(`/api/v1/rides/${rideId}/status`)
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ status: 'DRIVER_ARRIVED' });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.status).toBe('DRIVER_ARRIVED');
    });

    test('PATCH /status — start ride', async () => {
        const res = await request(app)
            .patch(`/api/v1/rides/${rideId}/status`)
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ status: 'IN_PROGRESS' });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.status).toBe('IN_PROGRESS');
        expect(res.body.data.startedAt).toBeDefined();
    });

    test('PATCH /status — complete ride', async () => {
        const res = await request(app)
            .patch(`/api/v1/rides/${rideId}/status`)
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ status: 'COMPLETED' });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.status).toBe('COMPLETED');
        expect(res.body.data.completedAt).toBeDefined();
    });

    test('PATCH /status — invalid transition from COMPLETED', async () => {
        const res = await request(app)
            .patch(`/api/v1/rides/${rideId}/status`)
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ status: 'REQUESTED' });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain('Invalid transition');
    });

    test('GET /:rideId — get ride details', async () => {
        const res = await request(app)
            .get(`/api/v1/rides/${rideId}`)
            .set('Authorization', `Bearer ${riderToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.status).toBe('COMPLETED');
    });
});

describe('Ride Cancel Flow', () => {
    let cancelRideId;

    beforeAll(async () => {
        await request(app)
            .post('/api/v1/driver/online')
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ longitude: 78.4867, latitude: 17.3850 });
    });

    test('Request + Cancel ride', async () => {
        const reqRes = await request(app)
            .post('/api/v1/rides/request')
            .set('Authorization', `Bearer ${riderToken}`)
            .send({
                pickupCoords: [78.4867, 17.3850],
                destinationCoords: [78.5100, 17.4100],
                pickupAddress: 'A',
                destinationAddress: 'B',
            });

        cancelRideId = reqRes.body.data._id;

        const cancelRes = await request(app)
            .post(`/api/v1/rides/${cancelRideId}/cancel`)
            .set('Authorization', `Bearer ${riderToken}`)
            .send({ reason: 'Changed my mind' });

        expect(cancelRes.statusCode).toBe(200);
        expect(cancelRes.body.data.status).toBe('CANCELLED');
        expect(cancelRes.body.data.cancelledBy).toBe('rider');
        expect(cancelRes.body.data.cancelReason).toBe('Changed my mind');
    });
});