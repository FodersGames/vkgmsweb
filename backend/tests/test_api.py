"""
Backend API Tests for Admin Dashboard v1.1.0
Tests: Auth, Permissions (13 granular), Projects, Project-scoped endpoints (Items, Status, Variables, Logs), Users
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://express-api-panel.preview.emergentagent.com')
MASTER_KEY = "#fje&)m)fea-4_t97&^%xp@a+*nxab4bf_7!2$6^xpwf1m(ayd"

# Test project for isolation testing
TEST_PROJECT_NAME = "TEST_Project_v110"
TEST_PROJECT_SLUG = "test-project-v110"

# All 13 permissions in v1.1.0
ALL_PERMISSIONS = [
    "view_projects", "create_projects", "delete_projects",
    "send_items", "delete_items",
    "change_status",
    "view_variables", "create_variables", "edit_variables", "delete_variables",
    "view_logs", "view_api_docs",
    "manage_users"
]


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
    """Version endpoint tests - v1.1.0"""
    
    def test_version_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/version")
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "1.1.0"
        assert data["name"] == "Vakar Games Admin API"
        print(f"✓ Version: {data['version']} - {data['name']}")


class TestPermissions:
    """Permissions endpoint tests - 13 granular permissions"""
    
    def test_permissions_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/permissions")
        assert response.status_code == 200
        data = response.json()
        assert "permissions" in data
        assert len(data["permissions"]) == 13
        for perm in ALL_PERMISSIONS:
            assert perm in data["permissions"], f"Missing permission: {perm}"
        print(f"✓ All 13 permissions returned: {data['permissions']}")


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
        # Super Admin should have all 13 permissions
        assert len(data["user"]["permissions"]) == 13
        for perm in ALL_PERMISSIONS:
            assert perm in data["user"]["permissions"], f"Super Admin missing permission: {perm}"
        print("✓ Login with master key successful - Super Admin has all 13 permissions")
    
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
    """Project CRUD tests with new permissions (create_projects, view_projects, delete_projects)"""
    
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
    """Project-scoped items tests (send_items, delete_items permissions)"""
    
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
    
    def test_delete_items_for_uid(self, auth_headers):
        # First send an item
        requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/items/send",
            json={"uid": "delete_test_player", "variable": "diamond", "amount": "10"},
            headers=auth_headers
        )
        
        # Delete items for that UID
        response = requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/items/delete_test_player",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["deleted_count"] >= 1
        print(f"✓ Deleted {data['deleted_count']} item(s) for UID")
    
    def test_items_not_visible_in_other_project(self, auth_headers):
        # Send item to test project
        requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/items/send",
            json={"uid": "isolation_test_player", "variable": "diamond", "amount": "10"},
            headers=auth_headers
        )
        
        # Try to claim from my-game project (should not find it)
        response = requests.get(f"{BASE_URL}/api/projects/my-game/claimgift/isolation_test_player")
        if response.status_code == 200:
            data = response.json()
            assert data["length"] == 0  # Should not find items from other project
            print("✓ Data isolation verified - items not visible across projects")
        elif response.status_code == 404:
            print("✓ Data isolation verified - project not found (expected if my-game doesn't exist)")


class TestProjectScopedStatus:
    """Project-scoped server status tests (change_status permission)"""
    
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


class TestProjectScopedVariables:
    """Project-scoped variables tests (view_variables, create_variables, edit_variables, delete_variables)"""
    
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
        print("✓ Created variable in project (create_variables permission)")
    
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
        print(f"✓ Listed {len(data['variables'])} variables (view_variables permission)")
    
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
        print("✓ Updated variable values (edit_variables permission)")
    
    def test_delete_variable(self, auth_headers):
        # Create a variable to delete
        requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/variables",
            json={"variable_name": "to_delete_var", "values": ["temp"]},
            headers=auth_headers
        )
        
        response = requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/variables/to_delete_var",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ Deleted variable (delete_variables permission)")


class TestProjectScopedLogs:
    """Project-scoped logs tests (view_logs permission)"""
    
    def test_get_logs(self, auth_headers):
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/logs",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert "count" in data
        print(f"✓ Got {data['count']} logs for project (view_logs permission)")
    
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
    """User management tests with granular permissions (manage_users permission)"""
    
    def test_list_users(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        print(f"✓ Listed {len(data['users'])} users")
    
    def test_create_user_with_granular_permissions(self, auth_headers):
        # Delete if exists
        requests.delete(f"{BASE_URL}/api/users/TEST_user_v110", headers=auth_headers)
        
        # Create user with subset of 13 permissions
        test_permissions = ["view_projects", "send_items", "view_variables", "view_logs"]
        response = requests.post(
            f"{BASE_URL}/api/users",
            json={"username": "TEST_user_v110", "permissions": test_permissions},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "TEST_user_v110"
        assert "access_key" in data
        for perm in test_permissions:
            assert perm in data["permissions"]
        print(f"✓ Created user with {len(test_permissions)} granular permissions")
    
    def test_update_user_permissions_granular(self, auth_headers):
        # Update with different set of permissions
        new_permissions = ["view_projects", "create_projects", "send_items", "delete_items", "change_status"]
        response = requests.put(
            f"{BASE_URL}/api/users/TEST_user_v110/permissions",
            json={"permissions": new_permissions},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        for perm in new_permissions:
            assert perm in data["permissions"]
        print(f"✓ Updated user to {len(new_permissions)} permissions")
    
    def test_delete_user(self, auth_headers):
        response = requests.delete(f"{BASE_URL}/api/users/TEST_user_v110", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Deleted test user")


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
