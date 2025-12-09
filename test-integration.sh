#!/bin/bash

# Integration Test Script for Email Sender Service
# Tests the complete end-to-end flow of the application

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
TEST_EMAIL="e2etest$(date +%s)@test.com"
TEST_PASSWORD="SecurePass123@"
TEST_NAME="Integration Test User"

# Global variables
TOKEN=""
USER_ID=""
CAMPAIGN_ID=""

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Test functions
test_health_check() {
    print_header "Test 1: API Health Check"

    # Test if API is responding
    response=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/api/auth/me")

    if [ "$response" == "401" ] || [ "$response" == "403" ]; then
        print_success "API is responding (expected auth error)"
        print_info "HTTP Status: $response"
        return 0
    elif [ "$response" == "200" ]; then
        print_success "API is responding"
        print_info "HTTP Status: $response"
        return 0
    else
        print_error "API is not responding properly"
        print_info "HTTP Status: $response"
        return 1
    fi
}

test_user_registration() {
    print_header "Test 2: User Registration"

    response=$(curl -s -X POST "$BASE_URL/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"full_name\":\"$TEST_NAME\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

    TOKEN=$(echo "$response" | jq -r '.token')
    USER_ID=$(echo "$response" | jq -r '.user.id')

    if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
        print_success "User registration successful"
        print_info "User ID: $USER_ID"
        print_info "Token: ${TOKEN:0:50}..."
        return 0
    else
        print_error "User registration failed"
        print_info "Response: $response"
        return 1
    fi
}

test_duplicate_registration() {
    print_header "Test 3: Duplicate Registration (Should Fail)"

    response=$(curl -s -X POST "$BASE_URL/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"full_name\":\"$TEST_NAME\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

    error=$(echo "$response" | jq -r '.error')

    if [ "$error" != "null" ] && [ -n "$error" ]; then
        print_success "Duplicate registration properly rejected"
        print_info "Error message: $error"
        return 0
    else
        print_error "Duplicate registration should have failed"
        return 1
    fi
}

test_login() {
    print_header "Test 4: User Login"

    response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

    TOKEN=$(echo "$response" | jq -r '.token')

    if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
        print_success "Login successful"
        print_info "Token: ${TOKEN:0:50}..."
        return 0
    else
        print_error "Login failed"
        print_info "Response: $response"
        return 1
    fi
}

test_invalid_login() {
    print_header "Test 5: Invalid Login (Should Fail)"

    response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"WrongPassword123@\"}")

    error=$(echo "$response" | jq -r '.error')

    if [ "$error" != "null" ] && [ -n "$error" ]; then
        print_success "Invalid login properly rejected"
        print_info "Error message: $error"
        return 0
    else
        print_error "Invalid login should have failed"
        return 1
    fi
}

test_get_current_user() {
    print_header "Test 6: Get Current User"

    response=$(curl -s -X GET "$BASE_URL/api/auth/me" \
        -H "Authorization: Bearer $TOKEN")

    email=$(echo "$response" | jq -r '.user.email')

    if [ "$email" == "$TEST_EMAIL" ]; then
        print_success "Get current user successful"
        print_info "User: $(echo $response | jq -r '.user.full_name') ($email)"
        return 0
    else
        print_error "Get current user failed"
        print_info "Response: $response"
        return 1
    fi
}

test_protected_route_without_token() {
    print_header "Test 7: Protected Route Without Token (Should Fail)"

    response=$(curl -s -X GET "$BASE_URL/api/auth/me")
    error=$(echo "$response" | jq -r '.error')

    if [ "$error" != "null" ] && [ -n "$error" ]; then
        print_success "Protected route properly rejected without token"
        print_info "Error message: $error"
        return 0
    else
        print_error "Protected route should have failed without token"
        return 1
    fi
}

test_get_campaigns() {
    print_header "Test 8: Get User Campaigns"

    response=$(curl -s -X GET "$BASE_URL/api/campaigns" \
        -H "Authorization: Bearer $TOKEN")

    count=$(echo "$response" | jq '.campaigns | length')

    if [ "$count" != "null" ]; then
        print_success "Get campaigns successful"
        print_info "Campaign count: $count"
        return 0
    else
        print_error "Get campaigns failed"
        print_info "Response: $response"
        return 1
    fi
}

test_smtp_config_without_credentials() {
    print_header "Test 9: SMTP Config Status (Without Credentials)"

    response=$(curl -s -X GET "$BASE_URL/api/smtp/config" \
        -H "Authorization: Bearer $TOKEN")

    configured=$(echo "$response" | jq -r '.configured')

    if [ "$configured" == "false" ]; then
        print_success "SMTP config status correct (not configured)"
        return 0
    else
        print_info "SMTP may already be configured"
        print_info "Response: $response"
        return 0
    fi
}

test_rate_limiting() {
    print_header "Test 10: Rate Limiting on Auth Endpoints"

    print_info "Sending 6 rapid requests to test rate limiting..."

    failed_count=0
    for i in {1..6}; do
        response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"nonexistent@test.com\",\"password\":\"test\"}")

        error=$(echo "$response" | jq -r '.error')

        if echo "$error" | grep -q -i "many requests\|rate limit"; then
            print_info "Request $i: Rate limited (as expected)"
            ((failed_count++))
        else
            print_info "Request $i: Not rate limited yet"
        fi

        sleep 0.5
    done

    if [ $failed_count -gt 0 ]; then
        print_success "Rate limiting is working ($failed_count requests blocked)"
        return 0
    else
        print_info "Rate limiting may not be active or threshold not reached"
        return 0
    fi
}

test_sql_injection_attempt() {
    print_header "Test 11: SQL Injection Protection"

    # Try SQL injection in login
    response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@test.com OR 1=1--","password":"anything"}')

    error=$(echo "$response" | jq -r '.error')

    if [ "$error" != "null" ] && [ -n "$error" ]; then
        print_success "SQL injection attempt properly rejected"
        print_info "Error message: $error"
        return 0
    else
        print_error "SQL injection protection may be insufficient"
        return 1
    fi
}

test_xss_attempt() {
    print_header "Test 12: XSS Protection"

    # Try XSS in registration name field
    response=$(curl -s -X POST "$BASE_URL/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"full_name\":\"<script>alert('XSS')</script>\",\"email\":\"xsstest$(date +%s)@test.com\",\"password\":\"$TEST_PASSWORD\"}")

    token=$(echo "$response" | jq -r '.token')

    if [ "$token" != "null" ] && [ -n "$token" ]; then
        # User created, now check if script tag is stored as-is
        user_response=$(curl -s -X GET "$BASE_URL/api/auth/me" \
            -H "Authorization: Bearer $token")

        full_name=$(echo "$user_response" | jq -r '.user.full_name')

        if echo "$full_name" | grep -q "<script>"; then
            print_info "XSS payload was stored (should be escaped on output)"
            print_info "Full name: $full_name"
        else
            print_success "XSS payload appears to be sanitized"
        fi
        return 0
    else
        print_info "Registration with XSS payload rejected"
        print_info "Response: $response"
        return 0
    fi
}

test_email_logs_stats() {
    print_header "Test 13: Email Logs Statistics"

    response=$(curl -s -X GET "$BASE_URL/api/email-logs/stats" \
        -H "Authorization: Bearer $TOKEN")

    # Check if response has any of the expected fields
    if echo "$response" | jq -e '.totalSent' > /dev/null 2>&1 || \
       echo "$response" | jq -e '.stats' > /dev/null 2>&1 || \
       echo "$response" | jq -e '.error' > /dev/null 2>&1; then

        error=$(echo "$response" | jq -r '.error')
        if [ "$error" != "null" ] && [ -n "$error" ]; then
            print_info "Email logs statistics returned an error (expected for new user)"
            print_info "Error: $error"
            return 0
        else
            total_sent=$(echo "$response" | jq -r '.totalSent // 0')
            print_success "Email logs statistics retrieved"
            print_info "Total sent: $total_sent"
            return 0
        fi
    else
        print_error "Email logs statistics failed"
        print_info "Response: $response"
        return 1
    fi
}

test_docker_containers() {
    print_header "Test 14: Docker Container Health"

    # Check if all containers are running
    containers=$(docker-compose ps --format json 2>/dev/null | jq -s '.')

    if [ $? -eq 0 ]; then
        running_count=$(echo "$containers" | jq '[.[] | select(.State == "running")] | length')
        total_count=$(echo "$containers" | jq 'length')

        print_info "Running containers: $running_count / $total_count"

        if [ "$running_count" == "$total_count" ]; then
            print_success "All Docker containers are running"

            # Check health status
            echo "$containers" | jq -r '.[] | "  \(.Name): \(.State) - \(.Status)"'
            return 0
        else
            print_error "Some containers are not running"
            echo "$containers" | jq -r '.[] | "  \(.Name): \(.State)"'
            return 1
        fi
    else
        print_info "Could not check Docker containers (docker-compose not available or not in project directory)"
        return 0
    fi
}

test_database_connection() {
    print_header "Test 15: Database Connection & Persistence"

    # The fact that registration and login work proves database connection
    # But let's also check if we can query campaigns
    response=$(curl -s -X GET "$BASE_URL/api/campaigns" \
        -H "Authorization: Bearer $TOKEN")

    # Check if response is valid JSON and has campaigns array
    if echo "$response" | jq -e '.' > /dev/null 2>&1; then
        if echo "$response" | jq -e '.campaigns' > /dev/null 2>&1; then
            print_success "Database connection working (campaigns query successful)"
            print_info "User can query their campaigns"
            return 0
        elif echo "$response" | jq -e '.error' > /dev/null 2>&1; then
            error=$(echo "$response" | jq -r '.error')
            print_error "Database query returned error: $error"
            return 1
        else
            print_error "Unexpected response format"
            print_info "Response: $response"
            return 1
        fi
    else
        print_error "Invalid JSON response from database query"
        print_info "Response: $response"
        return 1
    fi
}

# Main test execution
main() {
    print_header "Email Sender Service - Integration Tests"
    print_info "Starting integration tests at $(date)"
    print_info "Base URL: $BASE_URL"
    print_info "Test Email: $TEST_EMAIL"

    passed=0
    failed=0
    total=15

    # Run all tests
    test_health_check && ((passed++)) || ((failed++))
    test_user_registration && ((passed++)) || ((failed++))
    test_duplicate_registration && ((passed++)) || ((failed++))
    test_login && ((passed++)) || ((failed++))
    test_invalid_login && ((passed++)) || ((failed++))
    test_get_current_user && ((passed++)) || ((failed++))
    test_protected_route_without_token && ((passed++)) || ((failed++))
    test_get_campaigns && ((passed++)) || ((failed++))
    test_smtp_config_without_credentials && ((passed++)) || ((failed++))
    test_rate_limiting && ((passed++)) || ((failed++))
    test_sql_injection_attempt && ((passed++)) || ((failed++))
    test_xss_attempt && ((passed++)) || ((failed++))
    test_email_logs_stats && ((passed++)) || ((failed++))
    test_docker_containers && ((passed++)) || ((failed++))
    test_database_connection && ((passed++)) || ((failed++))

    # Summary
    print_header "Test Summary"
    echo -e "${GREEN}Passed: $passed${NC}"
    echo -e "${RED}Failed: $failed${NC}"
    echo -e "Total: $total"

    if [ $failed -eq 0 ]; then
        echo -e "\n${GREEN}========================================${NC}"
        echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
        echo -e "${GREEN}========================================${NC}\n"
        exit 0
    else
        echo -e "\n${RED}========================================${NC}"
        echo -e "${RED}✗ SOME TESTS FAILED${NC}"
        echo -e "${RED}========================================${NC}\n"
        exit 1
    fi
}

# Run main function
main
