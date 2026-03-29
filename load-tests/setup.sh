#!/bin/bash

BASE_URL="http://localhost:3000"

echo "============================================"
echo "  RydeSync Load Test — Data Seeding"
echo "============================================"
echo ""

# Clean old test data
echo "Cleaning old rides..."
mongosh --quiet --eval 'use ridesync; db.rides.deleteMany({}); db.wallets.deleteMany({}); db.ledgers.deleteMany({}); db.notifications.deleteMany({});' 2>/dev/null
echo ""

# Register test rider
echo "── Registering riders ──"
for i in $(seq 1 10); do
  curl -s -X POST "$BASE_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"LT Rider $i\",
      \"email\": \"lt_rider_${i}@test.com\",
      \"phone\": \"60000000${i}0\",
      \"password\": \"Test@1234\",
      \"role\": \"rider\"
    }" > /dev/null
  echo "  Rider $i registered"
done

# Register and online 50 drivers spread across Hyderabad
echo ""
echo "── Registering 50 drivers ──"

LNGS=(78.486 78.488 78.490 78.492 78.494 78.496 78.498 78.500 78.502 78.504
      78.382 78.384 78.386 78.388 78.390 78.407 78.409 78.411 78.413 78.415
      78.350 78.352 78.354 78.448 78.450 78.452 78.501 78.503 78.505 78.507
      78.487 78.489 78.491 78.493 78.495 78.497 78.499 78.501 78.503 78.505
      78.383 78.385 78.387 78.408 78.410 78.412 78.351 78.353 78.449 78.451)

LATS=(17.385 17.386 17.387 17.388 17.389 17.390 17.391 17.392 17.393 17.394
      17.443 17.444 17.445 17.446 17.447 17.432 17.433 17.434 17.435 17.436
      17.440 17.441 17.442 17.437 17.438 17.439 17.440 17.441 17.442 17.443
      17.386 17.387 17.388 17.389 17.390 17.391 17.392 17.393 17.394 17.395
      17.444 17.445 17.446 17.433 17.434 17.435 17.441 17.442 17.438 17.439)

for i in $(seq 1 50); do
  idx=$((i-1))
  DRIVER_RES=$(curl -s -X POST "$BASE_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"LT Driver $i\",
      \"email\": \"lt_driver_${i}@test.com\",
      \"phone\": \"70000000${i}0\",
      \"password\": \"Test@1234\",
      \"role\": \"driver\"
    }")

  TOKEN=$(echo "$DRIVER_RES" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

  if [ -n "$TOKEN" ]; then
    curl -s -X POST "$BASE_URL/api/v1/driver/online" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"longitude\": ${LNGS[$idx]}, \"latitude\": ${LATS[$idx]}}" > /dev/null
    echo "  Driver $i online at [${LNGS[$idx]}, ${LATS[$idx]}]"
  else
    # Driver might already exist, login instead
    LOGIN_RES=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"lt_driver_${i}@test.com\",\"password\":\"Test@1234\"}")
    TOKEN=$(echo "$LOGIN_RES" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
      curl -s -X POST "$BASE_URL/api/v1/driver/online" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"longitude\": ${LNGS[$idx]}, \"latitude\": ${LATS[$idx]}}" > /dev/null
      echo "  Driver $i online at [${LNGS[$idx]}, ${LATS[$idx]}]"
    fi
  fi
done

echo ""
echo "── Getting tokens ──"

# Get rider token
RIDER_LOGIN=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"lt_rider_1@test.com","password":"Test@1234"}')
RIDER_TOKEN=$(echo "$RIDER_LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# Get driver token
DRIVER_LOGIN=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"lt_driver_1@test.com","password":"Test@1234"}')
DRIVER_TOKEN=$(echo "$DRIVER_LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# Get admin token
ADMIN_RES=$(curl -s -X POST "$BASE_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "LT Admin",
    "email": "lt_admin@test.com",
    "phone": "8000000001",
    "password": "Test@1234",
    "role": "admin"
  }')
ADMIN_TOKEN=$(echo "$ADMIN_RES" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"lt_admin@test.com","password":"Test@1234"}')
  ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
fi

# Verify Redis
DRIVER_COUNT=$(redis-cli ZCARD active_drivers)

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "  Active drivers in Redis: $DRIVER_COUNT"
echo "============================================"
echo ""
echo "RIDER_TOKEN=$RIDER_TOKEN"
echo "DRIVER_TOKEN=$DRIVER_TOKEN"
echo "ADMIN_TOKEN=$ADMIN_TOKEN"
echo ""
echo "Paste these tokens in the k6 test files"
echo ""