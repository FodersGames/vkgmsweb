"""
Backend API Tests for Admin Dashboard v1.2.0
Tests: Auth, Permissions (20 granular), Projects, Website (Games, Blog, Settings), File Upload, Users
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://express-api-panel.preview.emergentagent.com')
MASTER_KEY = "#fje&)m)fea-4_t97&^%xp@a+*nxab4bf_7!2$6^xpwf1m(ayd"

# Test data
TEST_PROJECT_NAME = "TEST_Project_v120"
TEST_PROJECT_SLUG = "test-project-v120"
TEST_GAME_NAME = "TEST_Game_v120"
TEST_GAME_SLUG = "test-game-v120"
TEST_BLOG_TITLE = "TEST_Blog_Post_v120"

# All 20 permissions in v1.2.0
ALL_PERMISSIONS_V120 = [
    "view_projects", "create_projects", "delete_projects",
    "send_items", "delete_items",
    "change_status",
    "view_variables", "create_variables", "edit_variables", "delete_variables",
    "view_logs", "view_api_docs",
    "manage_users",
    "manage_website",
    "create_games", "edit_games", "delete_games",
    "create_blog", "edit_blog", "delete_blog",
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
    """Version endpoint tests - v1.2.0"""
    
    def test_version_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/version")
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "1.2.0"
        assert data["name"] == "Vakar Games Admin API"
        print(f"✓ Version: {data['version']} - {data['name']}")


class TestPermissions:
    """Permissions endpoint tests - 20 granular permissions"""
    
    def test_permissions_endpoint_returns_20(self):
        response = requests.get(f"{BASE_URL}/api/permissions")
        assert response.status_code == 200
        data = response.json()
        assert "permissions" in data
        assert len(data["permissions"]) == 20, f"Expected 20 permissions, got {len(data['permissions'])}"
        for perm in ALL_PERMISSIONS_V120:
            assert perm in data["permissions"], f"Missing permission: {perm}"
        print(f"✓ All 20 permissions returned: {data['permissions']}")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_with_master_key_returns_all_20_permissions(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"key": MASTER_KEY})
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["is_super_admin"] == True
        assert data["user"]["username"] == "Super Admin"
        # Super Admin should have all 20 permissions
        assert len(data["user"]["permissions"]) == 20, f"Expected 20 permissions, got {len(data['user']['permissions'])}"
        for perm in ALL_PERMISSIONS_V120:
            assert perm in data["user"]["permissions"], f"Super Admin missing permission: {perm}"
        print("✓ Login with master key successful - Super Admin has all 20 permissions")
    
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


class TestWebsiteGames:
    """Website Games CRUD tests (create_games, edit_games, delete_games permissions)"""
    
    def test_create_game(self, auth_headers):
        # Clean up if exists
        requests.delete(f"{BASE_URL}/api/website/games/{TEST_GAME_SLUG}", headers=auth_headers)
        
        response = requests.post(
            f"{BASE_URL}/api/website/games",
            json={
                "name": TEST_GAME_NAME,
                "description": "A test game for v1.2.0",
                "logo_url": "",
                "screenshots": [],
                "platforms": [{"name": "steam", "url": "https://store.steampowered.com/test"}],
                "status": "draft"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["game"]["name"] == TEST_GAME_NAME
        assert data["game"]["slug"] == TEST_GAME_SLUG
        print(f"✓ Created game: {data['game']['name']} (slug: {data['game']['slug']})")
    
    def test_list_games_admin(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/website/games", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "games" in data
        slugs = [g["slug"] for g in data["games"]]
        assert TEST_GAME_SLUG in slugs
        print(f"✓ Listed {len(data['games'])} games (admin)")
    
    def test_update_game(self, auth_headers):
        response = requests.put(
            f"{BASE_URL}/api/website/games/{TEST_GAME_SLUG}",
            json={
                "description": "Updated description",
                "status": "published",
                "platforms": [
                    {"name": "steam", "url": "https://store.steampowered.com/test"},
                    {"name": "pc", "url": "https://example.com/download"}
                ]
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["game"]["status"] == "published"
        assert len(data["game"]["platforms"]) == 2
        print("✓ Updated game to published with 2 platforms")
    
    def test_list_games_public_shows_published(self):
        response = requests.get(f"{BASE_URL}/api/website/games/public")
        assert response.status_code == 200
        data = response.json()
        assert "games" in data
        # Should only show published games
        for game in data["games"]:
            assert game["status"] == "published"
        slugs = [g["slug"] for g in data["games"]]
        assert TEST_GAME_SLUG in slugs, "Published test game should be visible in public list"
        print(f"✓ Public games endpoint shows {len(data['games'])} published games")
    
    def test_delete_game(self, auth_headers):
        response = requests.delete(f"{BASE_URL}/api/website/games/{TEST_GAME_SLUG}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ Deleted test game")


class TestWebsiteBlog:
    """Website Blog CRUD tests (create_blog, edit_blog, delete_blog permissions)"""
    
    def test_create_blog_post(self, auth_headers):
        response = requests.post(
            f"{BASE_URL}/api/website/blog",
            json={
                "title": TEST_BLOG_TITLE,
                "content": "This is test content for v1.2.0 blog post.",
                "image_url": "",
                "published": False
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["post"]["title"] == TEST_BLOG_TITLE
        assert "slug" in data["post"]
        print(f"✓ Created blog post: {data['post']['title']} (slug: {data['post']['slug']})")
        return data["post"]["slug"]
    
    def test_list_blog_admin(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/website/blog", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "posts" in data
        print(f"✓ Listed {len(data['posts'])} blog posts (admin)")
    
    def test_update_blog_post(self, auth_headers):
        # First get the slug
        response = requests.get(f"{BASE_URL}/api/website/blog", headers=auth_headers)
        posts = response.json()["posts"]
        test_post = next((p for p in posts if p["title"] == TEST_BLOG_TITLE), None)
        if not test_post:
            pytest.skip("Test blog post not found")
        
        slug = test_post["slug"]
        response = requests.put(
            f"{BASE_URL}/api/website/blog/{slug}",
            json={"content": "Updated content", "published": True},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["post"]["published"] == True
        print("✓ Updated blog post to published")
    
    def test_list_blog_public_shows_published(self):
        response = requests.get(f"{BASE_URL}/api/website/blog/public")
        assert response.status_code == 200
        data = response.json()
        assert "posts" in data
        # Should only show published posts
        for post in data["posts"]:
            assert post["published"] == True
        print(f"✓ Public blog endpoint shows {len(data['posts'])} published posts")
    
    def test_get_blog_post_by_slug(self, auth_headers):
        # Get the test post slug
        response = requests.get(f"{BASE_URL}/api/website/blog", headers=auth_headers)
        posts = response.json()["posts"]
        test_post = next((p for p in posts if p["title"] == TEST_BLOG_TITLE), None)
        if not test_post:
            pytest.skip("Test blog post not found")
        
        slug = test_post["slug"]
        response = requests.get(f"{BASE_URL}/api/website/blog/{slug}")
        assert response.status_code == 200
        data = response.json()
        assert data["post"]["title"] == TEST_BLOG_TITLE
        print(f"✓ Got blog post by slug: {slug}")
    
    def test_delete_blog_post(self, auth_headers):
        # Get the test post slug
        response = requests.get(f"{BASE_URL}/api/website/blog", headers=auth_headers)
        posts = response.json()["posts"]
        test_post = next((p for p in posts if p["title"] == TEST_BLOG_TITLE), None)
        if not test_post:
            pytest.skip("Test blog post not found")
        
        slug = test_post["slug"]
        response = requests.delete(f"{BASE_URL}/api/website/blog/{slug}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ Deleted test blog post")


class TestWebsiteSettings:
    """Website Settings tests (manage_website permission)"""
    
    def test_get_website_settings(self):
        response = requests.get(f"{BASE_URL}/api/website/settings")
        assert response.status_code == 200
        data = response.json()
        assert "maintenance_mode" in data
        print(f"✓ Got website settings: maintenance_mode={data['maintenance_mode']}")
    
    def test_toggle_maintenance_mode(self, auth_headers):
        # Get current state
        response = requests.get(f"{BASE_URL}/api/website/settings")
        current = response.json()["maintenance_mode"]
        
        # Toggle
        response = requests.put(
            f"{BASE_URL}/api/website/settings",
            json={"maintenance_mode": not current},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["maintenance_mode"] == (not current)
        print(f"✓ Toggled maintenance mode to {data['maintenance_mode']}")
        
        # Toggle back
        response = requests.put(
            f"{BASE_URL}/api/website/settings",
            json={"maintenance_mode": current},
            headers=auth_headers
        )
        assert response.status_code == 200
        print(f"✓ Restored maintenance mode to {current}")


class TestProjects:
    """Project CRUD tests (existing functionality)"""
    
    def test_list_projects(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "projects" in data
        print(f"✓ Listed {len(data['projects'])} projects")
    
    def test_create_project(self, auth_headers):
        # Clean up if exists
        requests.delete(f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}", headers=auth_headers)
        
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": TEST_PROJECT_NAME},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["slug"] == TEST_PROJECT_SLUG
        print(f"✓ Created project: {data['name']} (slug: {data['slug']})")


class TestProjectScopedEndpoints:
    """Project-scoped endpoints tests (send_items, status, variables, logs)"""
    
    def test_send_items(self, auth_headers):
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/items/send",
            json={"uid": "test_player", "variable": "gold", "amount": "100"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ Sent items to project")
    
    def test_get_status(self):
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"✓ Got project status: {data['status']}")
    
    def test_change_status(self, auth_headers):
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/status",
            json={"status": "maintenance"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ Changed project status")
    
    def test_create_variable(self, auth_headers):
        requests.delete(f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/variables/test_var", headers=auth_headers)
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/variables",
            json={"variable_name": "test_var", "values": ["val1", "val2"]},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ Created variable")
    
    def test_list_variables(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/variables", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "variables" in data
        print(f"✓ Listed {len(data['variables'])} variables")
    
    def test_get_logs(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}/logs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        print(f"✓ Got {data['count']} logs")


class TestUserManagement:
    """User management tests with 7 permission groups (20 permissions)"""
    
    def test_list_users(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        print(f"✓ Listed {len(data['users'])} users")
    
    def test_create_user_with_website_permissions(self, auth_headers):
        # Delete if exists
        requests.delete(f"{BASE_URL}/api/users/TEST_user_v120", headers=auth_headers)
        
        # Create user with website permissions (7 new permissions)
        test_permissions = [
            "view_projects", "manage_website",
            "create_games", "edit_games", "delete_games",
            "create_blog", "edit_blog", "delete_blog"
        ]
        response = requests.post(
            f"{BASE_URL}/api/users",
            json={"username": "TEST_user_v120", "permissions": test_permissions},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "TEST_user_v120"
        assert "access_key" in data
        for perm in test_permissions:
            assert perm in data["permissions"]
        print(f"✓ Created user with {len(test_permissions)} permissions including website permissions")
    
    def test_delete_user(self, auth_headers):
        response = requests.delete(f"{BASE_URL}/api/users/TEST_user_v120", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Deleted test user")


class TestExistingData:
    """Test existing data from previous iterations"""
    
    def test_existing_game_last_stand(self):
        response = requests.get(f"{BASE_URL}/api/website/games/public")
        assert response.status_code == 200
        data = response.json()
        slugs = [g["slug"] for g in data["games"]]
        # Check if 'last-stand' exists (from agent context)
        if "last-stand" in slugs:
            print("✓ Existing game 'Last Stand' found in public games")
        else:
            print("⚠ Game 'last-stand' not found - may need to be created")
    
    def test_existing_blog_post(self):
        response = requests.get(f"{BASE_URL}/api/website/blog/public")
        assert response.status_code == 200
        data = response.json()
        if len(data["posts"]) > 0:
            print(f"✓ Found {len(data['posts'])} published blog posts")
        else:
            print("⚠ No published blog posts found")
    
    def test_existing_project_my_city(self, auth_headers):
        response = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        assert response.status_code == 200
        projects = response.json()["projects"]
        slugs = [p["slug"] for p in projects]
        if "my-city" in slugs:
            print("✓ Existing project 'My City' found")
        else:
            print("⚠ Project 'my-city' not found")


class TestCleanup:
    """Cleanup test data"""
    
    def test_delete_test_project(self, auth_headers):
        response = requests.delete(f"{BASE_URL}/api/projects/{TEST_PROJECT_SLUG}", headers=auth_headers)
        if response.status_code == 200:
            print("✓ Cleaned up test project")
        else:
            print("⚠ Test project already cleaned up or not found")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
