#!/bin/bash

echo "============================================"
echo "  RydeSync Load Test Suite"
echo "  $(date)"
echo "============================================"
echo ""

echo "📋 Test 1/5: Health Endpoint Baseline"
echo "────────────────────────────────────"
k6 run load-tests/health.js 2>&1 | tail -20
echo ""

echo "🔐 Test 2/5: Auth System Under Load"
echo "────────────────────────────────────"
k6 run load-tests/auth-stress.js 2>&1 | tail -25
echo ""

echo "📍 Test 3/5: Geosearch Stress (KEY METRIC)"
echo "────────────────────────────────────"
k6 run load-tests/geosearch-stress.js 2>&1 | tail -25
echo ""

echo "⚡ Test 4/5: Surge Pricing Throughput"
echo "────────────────────────────────────"
k6 run load-tests/surge-stress.js 2>&1 | tail -25
echo ""

echo "🚗 Test 5/5: Full Ride Lifecycle"
echo "────────────────────────────────────"
k6 run load-tests/ride-lifecycle.js 2>&1 | tail -25
echo ""

echo "🔀 Bonus: Mixed Realistic Workload"
echo "────────────────────────────────────"
k6 run load-tests/mixed-workload.js 2>&1 | tail -25
echo ""

echo "============================================"
echo "  All Load Tests Complete!"
echo "  $(date)"
echo "============================================"
echo ""
echo "📊 Key metrics to look for:"
echo "  - geosearch_duration p(95)"
echo "  - surge_check_duration p(95)"
echo "  - login_duration avg"
echo "  - ride_request_duration avg"
echo "  - http_reqs (total requests/sec)"
echo "  - rides_completed (total)"
echo "  - overall_success rate"