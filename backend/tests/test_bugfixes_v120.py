"""
Test suite for Vakar Games v1.2.0 Bug Fixes
Tests: Featured game endpoint, maintenance mode, platforms (web/android)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
MASTER_KEY = "#fje&)m)fea-4_t97&^%xp@a+*nxab4bf_7!2$6^xpwf1m(ayd"

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token using master key"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={"key": MASTER_KEY})
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestFeaturedGameEndpoint:
    """Tests for GET /api/website/games/featured endpoint"""
    
    def test_featured_game_endpoint_exists(self):
        """Test that featured game endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/website/games/featured")
        assert response.status_code == 200, f"Featured endpoint failed: {response.text}"
        data = response.json()
        assert "game" in data, "Response should have 'game' key"
        print(f"✓ Featured game endpoint returns: {data}")
    
    def test_featured_game_returns_last_stand(self):
        """Test that 'Last Stand' is returned as featured game"""
        response = requests.get(f"{BASE_URL}/api/website/games/featured")
        assert response.status_code == 200
        data = response.json()
        if data["game"]:
            assert data["game"]["name"] == "Last Stand", f"Expected 'Last Stand', got {data['game']['name']}"
            assert data["game"]["featured"] == True, "Game should be marked as featured"
            assert data["game"]["status"] == "published", "Featured game should be published"
            print(f"✓ Featured game is 'Last Stand' with platforms: {data['game'].get('platforms', [])}")
        else:
            pytest.skip("No featured game set - may need to set one first")


class TestMaintenanceMode:
    """Tests for maintenance mode functionality"""
    
    def test_get_maintenance_status(self):
        """Test getting current maintenance status"""
        response = requests.get(f"{BASE_URL}/api/website/settings")
        assert response.status_code == 200, f"Settings endpoint failed: {response.text}"
        data = response.json()
        assert "maintenance_mode" in data, "Response should have 'maintenance_mode' key"
        print(f"✓ Current maintenance mode: {data['maintenance_mode']}")
    
    def test_enable_maintenance_mode(self, auth_headers):
        """Test enabling maintenance mode"""
        response = requests.put(
            f"{BASE_URL}/api/website/settings",
            json={"maintenance_mode": True},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Enable maintenance failed: {response.text}"
        data = response.json()
        assert data["maintenance_mode"] == True, "Maintenance mode should be enabled"
        print("✓ Maintenance mode enabled successfully")
    
    def test_verify_maintenance_enabled(self):
        """Verify maintenance mode is enabled"""
        response = requests.get(f"{BASE_URL}/api/website/settings")
        assert response.status_code == 200
        data = response.json()
        assert data["maintenance_mode"] == True, "Maintenance mode should be True"
        print("✓ Verified maintenance mode is enabled")
    
    def test_disable_maintenance_mode(self, auth_headers):
        """Test disabling maintenance mode"""
        response = requests.put(
            f"{BASE_URL}/api/website/settings",
            json={"maintenance_mode": False},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Disable maintenance failed: {response.text}"
        data = response.json()
        assert data["maintenance_mode"] == False, "Maintenance mode should be disabled"
        print("✓ Maintenance mode disabled successfully")
    
    def test_verify_maintenance_disabled(self):
        """Verify maintenance mode is disabled"""
        response = requests.get(f"{BASE_URL}/api/website/settings")
        assert response.status_code == 200
        data = response.json()
        assert data["maintenance_mode"] == False, "Maintenance mode should be False"
        print("✓ Verified maintenance mode is disabled")


class TestPlatformOptions:
    """Tests for web and android platform options in games"""
    
    def test_create_game_with_web_platform(self, auth_headers):
        """Test creating a game with 'web' platform"""
        game_data = {
            "name": "TEST_Web_Game",
            "description": "Test game with web platform",
            "platforms": [{"name": "web", "url": "https://example.com/play"}],
            "status": "draft",
            "featured": False
        }
        response = requests.post(
            f"{BASE_URL}/api/website/games",
            json=game_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create game failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert any(p["name"] == "web" for p in data["game"]["platforms"]), "Game should have 'web' platform"
        print("✓ Created game with 'web' platform")
    
    def test_create_game_with_android_platform(self, auth_headers):
        """Test creating a game with 'android' platform"""
        game_data = {
            "name": "TEST_Android_Game",
            "description": "Test game with android platform",
            "platforms": [{"name": "android", "url": "https://play.google.com/store/apps/details?id=test"}],
            "status": "draft",
            "featured": False
        }
        response = requests.post(
            f"{BASE_URL}/api/website/games",
            json=game_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create game failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert any(p["name"] == "android" for p in data["game"]["platforms"]), "Game should have 'android' platform"
        print("✓ Created game with 'android' platform")
    
    def test_create_game_with_multiple_platforms(self, auth_headers):
        """Test creating a game with multiple platforms including web and android"""
        game_data = {
            "name": "TEST_Multi_Platform_Game",
            "description": "Test game with multiple platforms",
            "platforms": [
                {"name": "steam", "url": "https://store.steampowered.com/app/test"},
                {"name": "web", "url": "https://example.com/play"},
                {"name": "android", "url": "https://play.google.com/store/apps/details?id=test"},
                {"name": "pc", "url": "https://example.com/download"}
            ],
            "status": "draft",
            "featured": False
        }
        response = requests.post(
            f"{BASE_URL}/api/website/games",
            json=game_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create game failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        platforms = [p["name"] for p in data["game"]["platforms"]]
        assert "web" in platforms, "Game should have 'web' platform"
        assert "android" in platforms, "Game should have 'android' platform"
        assert "steam" in platforms, "Game should have 'steam' platform"
        assert "pc" in platforms, "Game should have 'pc' platform"
        print(f"✓ Created game with platforms: {platforms}")
    
    def test_cleanup_test_games(self, auth_headers):
        """Cleanup test games"""
        test_slugs = ["test-web-game", "test-android-game", "test-multi-platform-game"]
        for slug in test_slugs:
            response = requests.delete(
                f"{BASE_URL}/api/website/games/{slug}",
                headers=auth_headers
            )
            if response.status_code == 200:
                print(f"✓ Deleted test game: {slug}")


class TestFeaturedToggle:
    """Tests for featured game toggle functionality"""
    
    def test_list_games_shows_featured_status(self, auth_headers):
        """Test that games list includes featured status"""
        response = requests.get(
            f"{BASE_URL}/api/website/games",
            headers=auth_headers
        )
        assert response.status_code == 200, f"List games failed: {response.text}"
        data = response.json()
        assert "games" in data
        for game in data["games"]:
            assert "featured" in game, f"Game {game['name']} should have 'featured' field"
        print(f"✓ All {len(data['games'])} games have 'featured' field")
    
    def test_update_game_featured_status(self, auth_headers):
        """Test updating a game's featured status"""
        # First get the current featured game
        response = requests.get(f"{BASE_URL}/api/website/games/featured")
        assert response.status_code == 200
        current_featured = response.json().get("game")
        
        if current_featured:
            # Toggle off the featured status
            response = requests.put(
                f"{BASE_URL}/api/website/games/{current_featured['slug']}",
                json={"featured": False},
                headers=auth_headers
            )
            assert response.status_code == 200
            
            # Toggle it back on
            response = requests.put(
                f"{BASE_URL}/api/website/games/{current_featured['slug']}",
                json={"featured": True},
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["game"]["featured"] == True
            print(f"✓ Successfully toggled featured status for '{current_featured['name']}'")
        else:
            pytest.skip("No featured game to test with")


class TestPublicEndpoints:
    """Tests for public endpoints (no auth required)"""
    
    def test_public_games_endpoint(self):
        """Test public games endpoint"""
        response = requests.get(f"{BASE_URL}/api/website/games/public")
        assert response.status_code == 200, f"Public games failed: {response.text}"
        data = response.json()
        assert "games" in data
        # All returned games should be published
        for game in data["games"]:
            assert game["status"] == "published", f"Game {game['name']} should be published"
        print(f"✓ Public games endpoint returns {len(data['games'])} published games")
    
    def test_public_blog_endpoint(self):
        """Test public blog endpoint"""
        response = requests.get(f"{BASE_URL}/api/website/blog/public")
        assert response.status_code == 200, f"Public blog failed: {response.text}"
        data = response.json()
        assert "posts" in data
        # All returned posts should be published
        for post in data["posts"]:
            assert post["published"] == True, f"Post {post['title']} should be published"
        print(f"✓ Public blog endpoint returns {len(data['posts'])} published posts")
    
    def test_version_endpoint(self):
        """Test version endpoint"""
        response = requests.get(f"{BASE_URL}/api/version")
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "1.2.0"
        assert data["name"] == "Vakar Games Admin API"
        print(f"✓ Version: {data['version']}, Name: {data['name']}")


class TestLoginAndDashboard:
    """Tests for login and dashboard access"""
    
    def test_login_with_master_key(self):
        """Test login with master key"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"key": MASTER_KEY}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["is_super_admin"] == True
        assert data["user"]["username"] == "Super Admin"
        print("✓ Login with master key successful")
    
    def test_token_verification(self, auth_headers):
        """Test token verification"""
        response = requests.get(
            f"{BASE_URL}/api/auth/verify",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Verify failed: {response.text}"
        data = response.json()
        assert data["valid"] == True
        print("✓ Token verification successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
