#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class AdminDashboardAPITester:
    def __init__(self, base_url="https://express-api-panel.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.master_key = "#fje&)m)fea-4_t97&^%xp@a+*nxab4bf_7!2$6^xpwf1m(ayd"
        self.created_users = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            return success, response.json() if response.text else {}

        except requests.exceptions.RequestException as e:
            print(f"❌ Failed - Network Error: {str(e)}")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_public_endpoints(self):
        """Test public endpoints that don't require authentication"""
        print("\n" + "="*50)
        print("TESTING PUBLIC ENDPOINTS")
        print("="*50)
        
        # Test server status endpoint
        success, response = self.run_test(
            "Get Server Status",
            "GET",
            "api/status",
            200
        )
        
        if success and 'status' in response:
            print(f"   Current server status: {response['status']}")
        
        # Test claim gift endpoint with dummy UID
        success, response = self.run_test(
            "Claim Gift (Empty)",
            "GET", 
            "api/claimgift/test_player_123",
            200
        )
        
        if success and 'items' in response:
            print(f"   Items claimed: {len(response['items'])}")

    def test_authentication(self):
        """Test authentication with master key"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION")
        print("="*50)
        
        # Test login with master key
        success, response = self.run_test(
            "Login with Master Key",
            "POST",
            "api/auth/login",
            200,
            data={"key": self.master_key}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Token received: {self.token[:50]}...")
            print(f"   User: {response.get('user', {}).get('username', 'Unknown')}")
            print(f"   Is Super Admin: {response.get('user', {}).get('is_super_admin', False)}")
            return True
        
        return False

    def test_token_verification(self):
        """Test token verification endpoint"""
        if not self.token:
            print("❌ No token available for verification test")
            return False
            
        success, response = self.run_test(
            "Verify Token",
            "GET",
            "api/auth/verify",
            200
        )
        
        return success

    def test_user_management(self):
        """Test user management endpoints"""
        print("\n" + "="*50)
        print("TESTING USER MANAGEMENT")
        print("="*50)
        
        if not self.token:
            print("❌ No token available for user management tests")
            return False
        
        # Test creating a user
        test_username = f"test_user_{datetime.now().strftime('%H%M%S')}"
        success, response = self.run_test(
            "Create User",
            "POST",
            "api/users",
            200,
            data={
                "username": test_username,
                "permissions": ["send_items", "view_logs"]
            }
        )
        
        if success and 'access_key' in response:
            self.created_users.append({
                "username": test_username,
                "access_key": response['access_key'],
                "permissions": response['permissions']
            })
            print(f"   Created user: {test_username}")
            print(f"   Access key: {response['access_key'][:20]}...")
        
        # Test listing users
        success, response = self.run_test(
            "List Users",
            "GET",
            "api/users",
            200
        )
        
        if success and 'users' in response:
            print(f"   Total users: {len(response['users'])}")
        
        return success

    def test_send_items(self):
        """Test send items functionality"""
        print("\n" + "="*50)
        print("TESTING SEND ITEMS")
        print("="*50)
        
        if not self.token:
            print("❌ No token available for send items test")
            return False
        
        # Test sending items
        test_uid = f"player_{datetime.now().strftime('%H%M%S')}"
        success, response = self.run_test(
            "Send Items",
            "POST",
            "api/items/send",
            200,
            data={
                "uid": test_uid,
                "variable": "wood",
                "amount": 10
            }
        )
        
        if success:
            print(f"   Sent 10x wood to {test_uid}")
            
            # Test claiming the items
            success_claim, response_claim = self.run_test(
                "Claim Sent Items",
                "GET",
                f"api/claimgift/{test_uid}",
                200
            )
            
            if success_claim and 'items' in response_claim:
                print(f"   Items claimed: {len(response_claim['items'])}")
                for item in response_claim['items']:
                    print(f"     - {item.get('amount', 0)}x {item.get('variable', 'unknown')}")
        
        return success

    def test_server_status_management(self):
        """Test server status management"""
        print("\n" + "="*50)
        print("TESTING SERVER STATUS MANAGEMENT")
        print("="*50)
        
        if not self.token:
            print("❌ No token available for server status test")
            return False
        
        # Test changing server status to maintenance
        success, response = self.run_test(
            "Change Status to Maintenance",
            "POST",
            "api/status",
            200,
            data={"status": "maintenance"}
        )
        
        if success:
            # Verify status change
            success_verify, response_verify = self.run_test(
                "Verify Status Change",
                "GET",
                "api/status",
                200
            )
            
            if success_verify and response_verify.get('status') == 'maintenance':
                print("   Status successfully changed to maintenance")
                
                # Change back to open
                self.run_test(
                    "Change Status Back to Open",
                    "POST",
                    "api/status",
                    200,
                    data={"status": "open"}
                )
        
        return success

    def test_logs_system(self):
        """Test logs system"""
        print("\n" + "="*50)
        print("TESTING LOGS SYSTEM")
        print("="*50)
        
        if not self.token:
            print("❌ No token available for logs test")
            return False
        
        # Test getting logs
        success, response = self.run_test(
            "Get All Logs",
            "GET",
            "api/logs?limit=10",
            200
        )
        
        if success and 'logs' in response:
            print(f"   Total logs retrieved: {len(response['logs'])}")
            if response['logs']:
                latest_log = response['logs'][0]
                print(f"   Latest log type: {latest_log.get('type', 'unknown')}")
                print(f"   Latest log message: {latest_log.get('message', 'no message')[:50]}...")
        
        # Test filtering logs by type
        success_filter, response_filter = self.run_test(
            "Get Auth Logs",
            "GET",
            "api/logs?log_type=auth&limit=5",
            200
        )
        
        if success_filter and 'logs' in response_filter:
            print(f"   Auth logs retrieved: {len(response_filter['logs'])}")
        
        return success

    def test_created_user_login(self):
        """Test login with created user access key"""
        print("\n" + "="*50)
        print("TESTING CREATED USER LOGIN")
        print("="*50)
        
        if not self.created_users:
            print("❌ No users created to test login")
            return False
        
        user = self.created_users[0]
        success, response = self.run_test(
            f"Login with User Access Key ({user['username']})",
            "POST",
            "api/auth/login",
            200,
            data={"key": user['access_key']}
        )
        
        if success and 'token' in response:
            user_token = response['token']
            print(f"   User token received: {user_token[:50]}...")
            print(f"   User permissions: {response.get('user', {}).get('permissions', [])}")
            
            # Test user can send items (if they have permission)
            if 'send_items' in user['permissions']:
                # Temporarily use user token
                original_token = self.token
                self.token = user_token
                
                test_uid = f"user_test_{datetime.now().strftime('%H%M%S')}"
                success_send, _ = self.run_test(
                    "User Send Items Test",
                    "POST",
                    "api/items/send",
                    200,
                    data={
                        "uid": test_uid,
                        "variable": "stone",
                        "amount": 5
                    }
                )
                
                # Restore original token
                self.token = original_token
                
                if success_send:
                    print("   User successfully sent items with their permissions")
        
        return success

    def test_invalid_authentication(self):
        """Test invalid authentication scenarios"""
        print("\n" + "="*50)
        print("TESTING INVALID AUTHENTICATION")
        print("="*50)
        
        # Test with invalid key
        success, response = self.run_test(
            "Login with Invalid Key",
            "POST",
            "api/auth/login",
            401,
            data={"key": "invalid_key_12345"}
        )
        
        # Test accessing protected endpoint without token
        original_token = self.token
        self.token = None
        
        success_no_auth, response_no_auth = self.run_test(
            "Access Protected Endpoint Without Auth",
            "GET",
            "api/users",
            401
        )
        
        # Test with invalid token
        self.token = "invalid_token_12345"
        success_invalid_token, response_invalid_token = self.run_test(
            "Access Protected Endpoint With Invalid Token",
            "GET",
            "api/users",
            401
        )
        
        # Restore original token
        self.token = original_token
        
        return success and success_no_auth and success_invalid_token

def main():
    """Main test execution"""
    print("🚀 Starting Admin Dashboard API Tests")
    print("="*60)
    
    tester = AdminDashboardAPITester()
    
    # Run all tests
    test_results = []
    
    # Public endpoints
    tester.test_public_endpoints()
    
    # Authentication
    auth_success = tester.test_authentication()
    if not auth_success:
        print("\n❌ Authentication failed - stopping tests")
        return 1
    
    # Token verification
    tester.test_token_verification()
    
    # User management
    tester.test_user_management()
    
    # Send items
    tester.test_send_items()
    
    # Server status
    tester.test_server_status_management()
    
    # Logs system
    tester.test_logs_system()
    
    # Created user login
    tester.test_created_user_login()
    
    # Invalid authentication
    tester.test_invalid_authentication()
    
    # Print final results
    print("\n" + "="*60)
    print("📊 FINAL TEST RESULTS")
    print("="*60)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    if tester.created_users:
        print(f"\nCreated Test Users: {len(tester.created_users)}")
        for user in tester.created_users:
            print(f"  - {user['username']}: {user['permissions']}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())