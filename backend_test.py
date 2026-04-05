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
        """Test send items functionality with text amounts"""
        print("\n" + "="*50)
        print("TESTING SEND ITEMS")
        print("="*50)
        
        if not self.token:
            print("❌ No token available for send items test")
            return False
        
        # Test sending items with numeric amount
        test_uid = f"player_{datetime.now().strftime('%H%M%S')}"
        success, response = self.run_test(
            "Send Items (Numeric Amount)",
            "POST",
            "api/items/send",
            200,
            data={
                "uid": test_uid,
                "variable": "wood",
                "amount": "10"
            }
        )
        
        # Test sending items with text amount
        success_text, response_text = self.run_test(
            "Send Items (Text Amount)",
            "POST",
            "api/items/send",
            200,
            data={
                "uid": test_uid,
                "variable": "gold",
                "amount": "legendary sword"
            }
        )
        
        # Test sending items with mixed text/number
        success_mixed, response_mixed = self.run_test(
            "Send Items (Mixed Text/Number)",
            "POST",
            "api/items/send",
            200,
            data={
                "uid": test_uid,
                "variable": "coins",
                "amount": "100 gold coins"
            }
        )
        
        if success:
            print(f"   Sent items to {test_uid}")
            
        return success and success_text and success_mixed

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
                        "amount": "5"  # Send as string
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

    def test_fifo_queue_system(self):
        """Test FIFO queue system for claimgift endpoint"""
        print("\n" + "="*50)
        print("TESTING FIFO QUEUE SYSTEM")
        print("="*50)
        
        if not self.token:
            print("❌ No token available for FIFO queue test")
            return False
        
        # Create a unique test UID
        test_uid = f"fifo_test_{datetime.now().strftime('%H%M%S')}"
        
        # Send multiple items to the same UID
        items_to_send = [
            {"variable": "wood", "amount": "10"},
            {"variable": "stone", "amount": "5"},
            {"variable": "gold", "amount": "legendary item"}
        ]
        
        print(f"   Sending {len(items_to_send)} items to {test_uid}...")
        for i, item in enumerate(items_to_send):
            success, response = self.run_test(
                f"Send Item {i+1}",
                "POST",
                "api/items/send",
                200,
                data={
                    "uid": test_uid,
                    "variable": item["variable"],
                    "amount": item["amount"]
                }
            )
            if not success:
                return False
        
        # Test FIFO behavior - first claim should return all items but delete only first
        success_claim1, response_claim1 = self.run_test(
            "First Claim (FIFO Test)",
            "GET",
            f"api/claimgift/{test_uid}",
            200
        )
        
        if success_claim1:
            print(f"   First claim - Length: {response_claim1.get('length', 0)}")
            print(f"   First claim - Variable: {response_claim1.get('variable', 'none')}")
            print(f"   First claim - Amount: {response_claim1.get('amount', 'none')}")
            
            # Should have length 3, return first item (wood, 10)
            if response_claim1.get('length') == 3 and response_claim1.get('variable') == 'wood':
                print("   ✅ FIFO working correctly - returned all items, first item is wood")
            else:
                print("   ❌ FIFO not working correctly")
                return False
        
        # Second claim should have length 2 (one item deleted)
        success_claim2, response_claim2 = self.run_test(
            "Second Claim (FIFO Test)",
            "GET",
            f"api/claimgift/{test_uid}",
            200
        )
        
        if success_claim2:
            print(f"   Second claim - Length: {response_claim2.get('length', 0)}")
            print(f"   Second claim - Variable: {response_claim2.get('variable', 'none')}")
            
            # Should have length 2, return second item (stone, 5)
            if response_claim2.get('length') == 2 and response_claim2.get('variable') == 'stone':
                print("   ✅ FIFO deletion working correctly - first item deleted, second item returned")
            else:
                print("   ❌ FIFO deletion not working correctly")
                return False
        
        return success_claim1 and success_claim2

    def test_variables_management(self):
        """Test variables CRUD operations"""
        print("\n" + "="*50)
        print("TESTING VARIABLES MANAGEMENT")
        print("="*50)
        
        if not self.token:
            print("❌ No token available for variables test")
            return False
        
        # Test creating a variable
        test_var_name = f"test_var_{datetime.now().strftime('%H%M%S')}"
        success_create, response_create = self.run_test(
            "Create Variable",
            "POST",
            "api/variables",
            200,
            data={
                "variable_name": test_var_name,
                "values": ["value1", "value2", "value3"]
            }
        )
        
        if not success_create:
            return False
        
        # Test listing variables
        success_list, response_list = self.run_test(
            "List Variables",
            "GET",
            "api/variables",
            200
        )
        
        if success_list and 'variables' in response_list:
            print(f"   Total variables: {len(response_list['variables'])}")
            # Check if our variable is in the list
            found_var = any(var['variable_name'] == test_var_name for var in response_list['variables'])
            if found_var:
                print(f"   ✅ Created variable found in list")
            else:
                print(f"   ❌ Created variable not found in list")
                return False
        
        # Test getting single variable (public endpoint)
        success_get, response_get = self.run_test(
            "Get Single Variable (Public)",
            "GET",
            f"api/variable/{test_var_name}",
            200
        )
        
        if success_get:
            print(f"   Variable values: {response_get.get('values', [])}")
        
        # Test updating variable
        success_update, response_update = self.run_test(
            "Update Variable",
            "PUT",
            f"api/variables/{test_var_name}",
            200,
            data={
                "values": ["updated_value1", "updated_value2"]
            }
        )
        
        # Test deleting variable
        success_delete, response_delete = self.run_test(
            "Delete Variable",
            "DELETE",
            f"api/variables/{test_var_name}",
            200
        )
        
        return success_create and success_list and success_get and success_update and success_delete

    def test_user_permissions_update(self):
        """Test updating user permissions"""
        print("\n" + "="*50)
        print("TESTING USER PERMISSIONS UPDATE")
        print("="*50)
        
        if not self.token:
            print("❌ No token available for user permissions test")
            return False
        
        if not self.created_users:
            print("❌ No users created to test permissions update")
            return False
        
        user = self.created_users[0]
        username = user['username']
        
        # Test updating user permissions
        new_permissions = ["send_items", "view_logs", "manage_variables"]
        success_update, response_update = self.run_test(
            f"Update User Permissions ({username})",
            "PUT",
            f"api/users/{username}/permissions",
            200,
            data={
                "permissions": new_permissions
            }
        )
        
        if success_update:
            print(f"   Updated permissions for {username}: {new_permissions}")
        
        # Test deleting user
        success_delete, response_delete = self.run_test(
            f"Delete User ({username})",
            "DELETE",
            f"api/users/{username}",
            200
        )
        
        if success_delete:
            print(f"   Successfully deleted user: {username}")
        
        return success_update and success_delete

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
    
    # FIFO queue system
    tester.test_fifo_queue_system()
    
    # Variables management
    tester.test_variables_management()
    
    # Server status
    tester.test_server_status_management()
    
    # Logs system
    tester.test_logs_system()
    
    # Created user login
    tester.test_created_user_login()
    
    # User permissions update and deletion
    tester.test_user_permissions_update()
    
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