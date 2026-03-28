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
            email: 'rider2@test.com',
            phone: '9876543220',
            password: 'Test@1234',
            role: 'rider',
        });
    riderToken = riderRes.body.data.accessToken;

    const driverRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
            name: 'Driver',
            email: 'driver2@test.com',
            phone: '9876543221',
            password: 'Test@1234',
            role: 'driver',
        });
    driverToken = driverRes.body.data.accessToken;
});

afterAll(async () => {
    await cleanup();
    await mongoose.disconnect();
    try {
        const redis = getRedisClient();
        await redis.quit();
    } catch (err) { }
});

describe('Driver Location System', () => {
    test('POST /online — driver goes online', async () => {
        const res = await request(app)
            .post('/api/v1/driver/online')
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ longitude: 78.4867, latitude: 17.3850 });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.message).toContain('online');
    });

    test('POST /online — rider cannot go online', async () => {
        const res = await request(app)
            .post('/api/v1/driver/online')
            .set('Authorization', `Bearer ${riderToken}`)
            .send({ longitude: 78.4867, latitude: 17.3850 });

        expect(res.statusCode).toBe(403);
    });

    test('PATCH /location — update driver location', async () => {
        const res = await request(app)
            .patch('/api/v1/driver/location')
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ longitude: 78.4900, latitude: 17.3870 });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.message).toContain('updated');
    });

    test('GET /nearby — rider finds nearby drivers', async () => {
        const res = await request(app)
            .get('/api/v1/driver/nearby?longitude=78.49&latitude=17.38')
            .set('Authorization', `Bearer ${riderToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data[0].driverId).toBeDefined();
        expect(res.body.data[0].distance).toBeDefined();
    });

    test('POST /offline — driver goes offline', async () => {
        const res = await request(app)
            .post('/api/v1/driver/offline')
            .set('Authorization', `Bearer ${driverToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.message).toContain('offline');
    });

    test('GET /nearby — no drivers after offline', async () => {
        const res = await request(app)
            .get('/api/v1/driver/nearby?longitude=78.49&latitude=17.38')
            .set('Authorization', `Bearer ${riderToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBe(0);
    });
});