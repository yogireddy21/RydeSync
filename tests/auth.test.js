const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDatabase, getRedisClient } = require('../src/config/database');
const { cleanup } = require('./setup');

let accessToken;
let refreshToken;

beforeAll(async () => {
    await connectDatabase();
    await cleanup();
});

afterAll(async () => {
    await cleanup();
    await mongoose.disconnect();
    try {
        const redis = getRedisClient();
        await redis.quit();
    } catch (err) { }
});

describe('Auth System', () => {
    test('POST /register — should create a rider', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({
                name: 'Test Rider',
                email: 'rider@test.com',
                phone: '9876543210',
                password: 'Test@1234',
                role: 'rider',
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.email).toBe('rider@test.com');
        expect(res.body.data.user.role).toBe('rider');
        expect(res.body.data.user.password).toBeUndefined();
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();
    });

    test('POST /register — should reject duplicate email', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({
                name: 'Duplicate',
                email: 'rider@test.com',
                phone: '9876543211',
                password: 'Test@1234',
                role: 'rider',
            });

        expect(res.statusCode).toBe(409);
        expect(res.body.success).toBe(false);
    });

    test('POST /register — should create a driver', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({
                name: 'Test Driver',
                email: 'driver@test.com',
                phone: '9876543212',
                password: 'Test@1234',
                role: 'driver',
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.data.user.role).toBe('driver');
    });

    test('POST /login — should login with correct credentials', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'rider@test.com',
                password: 'Test@1234',
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();

        accessToken = res.body.data.accessToken;
        refreshToken = res.body.data.refreshToken;
    });

    test('POST /login — should reject wrong password', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'rider@test.com',
                password: 'WrongPassword',
            });

        expect(res.statusCode).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('GET /profile — should return user with valid token', async () => {
        const res = await request(app)
            .get('/api/v1/auth/profile')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.user.email).toBe('rider@test.com');
        expect(res.body.data.user.password).toBeUndefined();
    });

    test('GET /profile — should reject without token', async () => {
        const res = await request(app)
            .get('/api/v1/auth/profile');

        expect(res.statusCode).toBe(401);
    });

    test('GET /profile — should reject invalid token', async () => {
        const res = await request(app)
            .get('/api/v1/auth/profile')
            .set('Authorization', 'Bearer invalidtoken123');

        expect(res.statusCode).toBe(401);
    });

    test('POST /refresh — should return new token pair', async () => {
        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();

        accessToken = res.body.data.accessToken;
        refreshToken = res.body.data.refreshToken;
    });

    test('POST /refresh — should reject old refresh token', async () => {
        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: 'old_invalid_token' });

        expect(res.statusCode).toBe(401);
    });

    test('POST /logout — should blacklist token', async () => {
        const res = await request(app)
            .post('/api/v1/auth/logout')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.statusCode).toBe(200);
    });

    test('GET /profile — should reject blacklisted token', async () => {
        const res = await request(app)
            .get('/api/v1/auth/profile')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.statusCode).toBe(401);
    });
});