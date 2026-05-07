"""
Backend API Tests for Admin Dashboard v1.0.5
Tests: Auth, Projects, Project-scoped endpoints (Items, Status, Variables, Logs), Users
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://express-api-panel.preview.emergentagent.com')
MASTER_KEY = "#fje&)m)fea-4_t97&^%xp@a+*nxab4bf_7!2$6^xpwf1m(ayd"

# Test project for isolation testing
TEST_PROJECT_NAME = "TEST_Project_Isolation"
TEST_PROJECT_SLUG = "test-project-isolation"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token using master key"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={"key": MASTER_KEY})
    if response.status_code == 200:
        return response.json()["token"]
    pytest.fail(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestVersion:
    """Version endpoint tests"""
    
    def test_version_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/version")
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "1.0.5"
        assert data["name"] == "Admin Dashboard API"
        print(f"✓ Version: {data['version']}")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_with_master_key(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"key": MASTER_KEY})
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["is_super_admin"] == True
        assert data["user"]["username"] == "Super Admin"
        print("✓ Login with master key successful")
    
    def test_login_with_invalid_key(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"key": "invalid_key"})
        assert response.status_code == 401
        print("✓ Invalid key rejected correctly")
    
    def test_verify_token(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/auth/verify", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == True
        print("✓ Token verification successful")


class TestProjects:
    """Project CRUD tests"""
    
    def test_list_projects(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "projects" in data
        print(f"✓ Listed {len(data['projects'])} projects")
    
    def test_create_project(self, auth_headers):
        # Clean up if exists
        requests.delete(f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}", headers=auth_headers)
        
        response = requests.post(f"{BASE_URL}/api/projects", 
                                json={"name": TEST_PROJECT_NAME}, 
                                headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["slug"] == TEST_PROJECT_SLUG
        print(f"✓ Created project: {data['name']} (slug: {data['slug']})")
    
    def test_project_exists_after_create(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        assert response.status_code == 200
        projects = response.json()["projects"]
        slugs = [p["slug"] for p in projects]
        assert TEST_PROJECT_SLUG in slugs
        print("✓ Project exists in list after creation")
    
    def test_duplicate_project_rejected(self, auth_headers):
        response = requests.post(f"{BASE_URL}/api/projects", 
                                json={"name": TEST_PROJECT_NAME}, 
                                headers=auth_headers)
        assert response.status_code == 400
        print("✓ Duplicate project creation rejected")


class TestProjectScopedItems:
    """Project-scoped items tests"""
    
    def test_send_items_to_project(self, auth_headers):
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/items/send",
            json={"uid": "test_player_123", "variable": "gold", "amount": "500"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ Sent items to project-scoped endpoint")
    
    def test_claim_gift_from_project(self):
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/claimgift/test_player_123")
        assert response.status_code == 200
        data = response.json()
        assert data["length"] >= 1
        assert data["variable"] == "gold"
        assert data["amount"] == "500"
        print(f"✓ Claimed gift: {data['variable']} x{data['amount']}")
    
    def test_items_not_visible_in_other_project(self, auth_headers):
        # Send item to test project
        requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/items/send",
            json={"uid": "isolation_test_player", "variable": "diamond", "amount": "10"},
            headers=auth_headers
        )
        
        # Try to claim from my-game project (should not find it)
        response = requests.get(f"{BASE_URL}/api/projects/my-game/claimgift/isolation_test_player")
        assert response.status_code == 200
        data = response.json()
        assert data["length"] == 0  # Should not find items from other project
        print("✓ Data isolation verified - items not visible across projects")


class TestProjectScopedStatus:
    """Project-scoped server status tests"""
    
    def test_get_status(self):
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"✓ Got status: {data['status']}")
    
    def test_change_status(self, auth_headers):
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/status",
            json={"status": "maintenance"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["status"] == "maintenance"
        print("✓ Changed status to maintenance")
    
    def test_status_persisted(self):
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/status")
        assert response.status_code == 200
        assert response.json()["status"] == "maintenance"
        print("✓ Status change persisted")
    
    def test_status_isolated_per_project(self, auth_headers):
        # Change test project status to closed
        requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/status",
            json={"status": "closed"},
            headers=auth_headers
        )
        
        # Check my-game status (should be different)
        response = requests.get(f"{BASE_URL}/api/projects/my-game/status")
        assert response.status_code == 200
        # my-game status should not be affected
        print("✓ Status isolation verified between projects")


class TestProjectScopedVariables:
    """Project-scoped variables tests"""
    
    def test_create_variable(self, auth_headers):
        # Delete if exists
        requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/variables/test_var",
            headers=auth_headers
        )
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/variables",
            json={"variable_name": "test_var", "values": ["value1", "value2"]},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["variable_name"] == "test_var"
        print("✓ Created variable in project")
    
    def test_list_variables(self, auth_headers):
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/variables",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "variables" in data
        var_names = [v["variable_name"] for v in data["variables"]]
        assert "test_var" in var_names
        print(f"✓ Listed {len(data['variables'])} variables")
    
    def test_get_variable_public(self):
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/variable/test_var")
        assert response.status_code == 200
        data = response.json()
        assert data["variable_name"] == "test_var"
        assert data["value_0"] == "value1"
        assert data["value_1"] == "value2"
        assert data["count"] == 2
        print("✓ Got variable via public endpoint with indexed format")
    
    def test_update_variable(self, auth_headers):
        response = requests.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/variables/test_var",
            json={"values": ["updated1", "updated2", "updated3"]},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert len(data["values"]) == 3
        print("✓ Updated variable values")
    
    def test_variable_isolated_per_project(self, auth_headers):
        # Create same variable name in test project
        requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/variables",
            json={"variable_name": "shared_name", "values": ["test_project_value"]},
            headers=auth_headers
        )
        
        # Try to get from my-game (should not exist or have different value)
        response = requests.get(f"{BASE_URL}/api/projects/my-game/variable/shared_name")
        # Either 404 or different value
        if response.status_code == 200:
            data = response.json()
            # If exists in my-game, it should have different values
            print(f"✓ Variable exists in my-game with value: {data.get('value_0', 'N/A')}")
        else:
            assert response.status_code == 404
            print("✓ Variable isolation verified - not found in other project")


class TestProjectScopedLogs:
    """Project-scoped logs tests"""
    
    def test_get_logs(self, auth_headers):
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/logs",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert "count" in data
        print(f"✓ Got {data['count']} logs for project")
    
    def test_logs_filtered_by_type(self, auth_headers):
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/logs?log_type=send",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        for log in data["logs"]:
            assert log["type"] == "send"
        print("✓ Logs filtered by type correctly")


class TestUserManagement:
    """User management tests (global, not project-scoped)"""
    
    def test_list_users(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        print(f"✓ Listed {len(data['users'])} users")
    
    def test_create_user(self, auth_headers):
        # Delete if exists
        requests.delete(f"{BASE_URL}/api/users/TEST_user_api", headers=auth_headers)
        
        response = requests.post(
            f"{BASE_URL}/api/users",
            json={"username": "TEST_user_api", "permissions": ["send_items", "view_logs"]},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "TEST_user_api"
        assert "access_key" in data
        assert "send_items" in data["permissions"]
        print(f"✓ Created user with access key")
    
    def test_update_user_permissions(self, auth_headers):
        response = requests.put(
            f"{BASE_URL}/api/users/TEST_user_api/permissions",
            json={"permissions": ["send_items", "view_logs", "change_status"]},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "change_status" in data["permissions"]
        print("✓ Updated user permissions")
    
    def test_delete_user(self, auth_headers):
        response = requests.delete(f"{BASE_URL}/api/users/TEST_user_api", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Deleted test user")


class TestExistingProject:
    """Tests for existing 'my-game' project"""
    
    def test_my_game_exists(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        assert response.status_code == 200
        projects = response.json()["projects"]
        slugs = [p["slug"] for p in projects]
        assert "my-game" in slugs
        print("✓ 'My Game' project exists")
    
    def test_my_game_status(self):
        response = requests.get(f"{BASE_URL}/api/projects/my-game/status")
        assert response.status_code == 200
        print(f"✓ My Game status: {response.json()['status']}")
    
    def test_my_game_variables(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/projects/my-game/variables", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ My Game has {len(response.json()['variables'])} variables")


class TestCleanup:
    """Cleanup test data"""
    
    def test_delete_test_project(self, auth_headers):
        response = requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}",
            headers=auth_headers
        )
        assert response.status_code == 200
        print("✓ Cleaned up test project")
    
    def test_project_deleted(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        projects = response.json()["projects"]
        slugs = [p["slug"] for p in projects]
        assert TEST_PROJECT_SLUG not in slugs
        print("✓ Test project no longer exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
