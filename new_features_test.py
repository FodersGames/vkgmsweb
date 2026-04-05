#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class VariablesAndItemsTester:
    def __init__(self, base_url="https://express-api-panel.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.master_key = "#fje&)m)fea-4_t97&^%xp@a+*nxab4bf_7!2$6^xpwf1m(ayd"

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.json()}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_login(self):
        """Test login with master key"""
        print("=== AUTHENTICATION ===")
        success, response = self.run_test(
            "Super Admin Login",
            "POST",
            "auth/login",
            200,
            data={"key": self.master_key}
        )
        if success and 'token' in response:
            self.token = response['token']
            return True
        return False

    def test_variables_crud(self):
        """Test complete variables CRUD operations"""
        print("\n=== VARIABLES CRUD TESTS ===")
        
        test_var_name = f"test_var_{datetime.now().strftime('%H%M%S')}"
        
        # 1. Create variable
        success, response = self.run_test(
            "Create Variable",
            "POST",
            "variables",
            200,
            data={
                "variable_name": test_var_name,
                "values": ["gold", "silver", "bronze"]
            }
        )
        
        if not success:
            return False
            
        # 2. List variables (authenticated)
        success, response = self.run_test(
            "List Variables (Authenticated)",
            "GET",
            "variables",
            200
        )
        
        if not success:
            return False
            
        variables = response.get('variables', [])
        found_var = any(v['variable_name'] == test_var_name for v in variables)
        if not found_var:
            print(f"❌ Created variable {test_var_name} not found in list")
            return False
        print(f"✅ Variable {test_var_name} found in variables list")
        
        # 3. Get variable (public endpoint)
        success, response = self.run_test(
            "Get Variable (Public)",
            "GET",
            f"variable/{test_var_name}",
            200
        )
        
        if not success:
            return False
            
        if response.get('variable_name') != test_var_name:
            print(f"❌ Variable name mismatch")
            return False
        print(f"✅ Public variable endpoint returned correct data")
        
        # 4. Update variable
        success, response = self.run_test(
            "Update Variable",
            "PUT",
            f"variables/{test_var_name}",
            200,
            data={"values": ["platinum", "diamond", "emerald"]}
        )
        
        if not success:
            return False
            
        # 5. Verify update
        success, response = self.run_test(
            "Verify Variable Update",
            "GET",
            f"variable/{test_var_name}",
            200
        )
        
        if not success:
            return False
            
        values = response.get('values', [])
        if "platinum" not in values:
            print(f"❌ Variable update not reflected")
            return False
        print(f"✅ Variable successfully updated")
        
        # 6. Delete variable
        success, response = self.run_test(
            "Delete Variable",
            "DELETE",
            f"variables/{test_var_name}",
            200
        )
        
        if not success:
            return False
            
        # 7. Verify deletion
        success, response = self.run_test(
            "Verify Variable Deletion",
            "GET",
            f"variable/{test_var_name}",
            404
        )
        
        if not success:
            print(f"❌ Variable should be deleted but still accessible")
            return False
        print(f"✅ Variable successfully deleted")
        
        return True

    def test_send_items_flexible_amount(self):
        """Test sending items with both text and number amounts"""
        print("\n=== SEND ITEMS FLEXIBLE AMOUNT TESTS ===")
        
        test_uid = f"player_{datetime.now().strftime('%H%M%S')}"
        
        # 1. Send items with string number
        success, response = self.run_test(
            "Send Items (String Number)",
            "POST",
            "items/send",
            200,
            data={
                "uid": test_uid,
                "variable": "gold",
                "amount": "100"  # String number
            }
        )
        
        if not success:
            return False
            
        # 2. Send items with text amount
        success, response = self.run_test(
            "Send Items (Text Amount)",
            "POST",
            "items/send",
            200,
            data={
                "uid": test_uid,
                "variable": "sword",
                "amount": "legendary enchanted blade"  # Text
            }
        )
        
        if not success:
            return False
            
        # 3. Send items with mixed text/number
        success, response = self.run_test(
            "Send Items (Mixed Text/Number)",
            "POST",
            "items/send",
            200,
            data={
                "uid": test_uid,
                "variable": "potion",
                "amount": "5x health potions"  # Mixed
            }
        )
        
        if not success:
            return False
            
        # 4. Claim all items
        success, response = self.run_test(
            "Claim All Items",
            "GET",
            f"claimgift/{test_uid}",
            200
        )
        
        if not success:
            return False
            
        items = response.get('items', [])
        if len(items) != 3:
            print(f"❌ Expected 3 items, got {len(items)}")
            return False
            
        # Verify different amount types
        amounts = [item['amount'] for item in items]
        print(f"✅ Claimed items with amounts: {amounts}")
        
        return True

    def test_user_management_new_endpoints(self):
        """Test new user management endpoints"""
        print("\n=== USER MANAGEMENT NEW ENDPOINTS ===")
        
        test_username = f"test_user_{datetime.now().strftime('%H%M%S')}"
        
        # 1. Create user
        success, response = self.run_test(
            "Create User for Testing",
            "POST",
            "users",
            200,
            data={
                "username": test_username,
                "permissions": ["send_items", "view_logs"]
            }
        )
        
        if not success:
            return False
            
        # 2. Update user permissions
        success, response = self.run_test(
            "Update User Permissions",
            "PUT",
            f"users/{test_username}/permissions",
            200,
            data={"permissions": ["send_items", "view_logs", "manage_variables"]}
        )
        
        if not success:
            return False
            
        # 3. Verify permission update
        success, response = self.run_test(
            "List Users to Verify Update",
            "GET",
            "users",
            200
        )
        
        if not success:
            return False
            
        users = response.get('users', [])
        test_user = next((u for u in users if u['username'] == test_username), None)
        if not test_user:
            print(f"❌ Test user not found")
            return False
            
        if "manage_variables" not in test_user['permissions']:
            print(f"❌ Permission update not reflected")
            return False
        print(f"✅ User permissions successfully updated")
        
        # 4. Delete user
        success, response = self.run_test(
            "Delete User",
            "DELETE",
            f"users/{test_username}",
            200
        )
        
        if not success:
            return False
            
        # 5. Verify deletion
        success, response = self.run_test(
            "Verify User Deletion",
            "GET",
            "users",
            200
        )
        
        if not success:
            return False
            
        users = response.get('users', [])
        test_user = next((u for u in users if u['username'] == test_username), None)
        if test_user:
            print(f"❌ User should be deleted but still exists")
            return False
        print(f"✅ User successfully deleted")
        
        return True

def main():
    print("🚀 Testing New Variables and Items Features")
    print("=" * 60)
    
    tester = VariablesAndItemsTester()
    
    # Run all tests
    if not tester.test_login():
        print("❌ Authentication failed, stopping tests")
        return 1
    
    if not tester.test_variables_crud():
        print("❌ Variables CRUD tests failed")
        return 1
        
    if not tester.test_send_items_flexible_amount():
        print("❌ Send items flexible amount tests failed")
        return 1
        
    if not tester.test_user_management_new_endpoints():
        print("❌ User management new endpoints tests failed")
        return 1
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 Tests completed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All new features tests passed!")
        return 0
    else:
        print(f"❌ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())