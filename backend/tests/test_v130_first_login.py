"""
Test suite for Vakar Games v1.3.0 - First Login Flow
Tests the secure first-login flow where:
1. Initial setup key generates a new secure key on first login
2. Initial setup key is permanently invalidated after first use
3. New generated key works for subsequent logins
"""
import pytest
import requests
import os
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'admin_dashboard_db')

# Initial setup key from backend
INITIAL_SETUP_KEY = "#fje&)m)fea-4_t97&^%xp@a+*nxab4bf_7!2$6^xpwf1m(ayd"

# Current working key (generated from previous first login)
CURRENT_SUPER_ADMIN_KEY = "EpTkonIkfT_A2lX4By08mgX370_88dZXvJfl7E_3Q3filj8bpbShu3fuRJ9RPP6X"


class TestVersion:
    """Test version endpoint returns 1.3.0"""
    
    def test_version_is_130(self):
        """GET /api/version should return version 1.3.0"""
        response = requests.get(f"{BASE_URL}/api/version")
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "1.3.0"
        assert data["name"] == "Vakar Games Admin API"
        print(f"✓ Version is {data['version']}")


class TestCurrentSuperAdminKey:
    """Test that the current generated super admin key works"""
    
    def test_login_with_current_key(self):
        """POST /api/auth/login with current super admin key should work"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "key": CURRENT_SUPER_ADMIN_KEY
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "token" in data
        assert "user" in data
        assert "first_login" in data
        assert "new_key" in data
        
        # Verify user data
        assert data["user"]["id"] == "super_admin"
        assert data["user"]["username"] == "Super Admin"
        assert data["user"]["is_super_admin"] == True
        
        # Verify this is NOT a first login
        assert data["first_login"] == False
        assert data["new_key"] is None
        
        print(f"✓ Current super admin key works, first_login={data['first_login']}")
        return data["token"]
    
    def test_verify_token(self):
        """GET /api/auth/verify should validate the token"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "key": CURRENT_SUPER_ADMIN_KEY
        })
        token = login_response.json()["token"]
        
        # Verify token
        response = requests.get(f"{BASE_URL}/api/auth/verify", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == True
        assert data["user"]["username"] == "Super Admin"
        print("✓ Token verification works")


class TestInitialSetupKeyRejected:
    """Test that the initial setup key is rejected after first login"""
    
    def test_initial_setup_key_rejected(self):
        """POST /api/auth/login with initial setup key should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "key": INITIAL_SETUP_KEY
        })
        assert response.status_code == 401
        data = response.json()
        assert data["detail"] == "Invalid access key"
        print("✓ Initial setup key is correctly rejected")


class TestFirstLoginFlow:
    """Test the first login flow by resetting super_admin collection"""
    
    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Setup: Drop super_admin collection, Teardown: Restore it"""
        # Connect to MongoDB
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Backup existing super_admin document
        existing_doc = db.super_admin.find_one({"role": "super_admin"})
        
        # Drop the collection to simulate fresh install
        db.super_admin.drop()
        print("✓ Dropped super_admin collection for first login test")
        
        yield  # Run the test
        
        # Teardown: Restore the original super_admin document if it existed
        if existing_doc:
            db.super_admin.insert_one(existing_doc)
            print("✓ Restored original super_admin document")
        
        client.close()
    
    def test_first_login_generates_new_key(self):
        """POST /api/auth/login with initial setup key should generate new key on first login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "key": INITIAL_SETUP_KEY
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify first login response
        assert data["first_login"] == True
        assert data["new_key"] is not None
        assert len(data["new_key"]) > 40  # Should be a long secure key
        
        # Verify user data
        assert data["user"]["id"] == "super_admin"
        assert data["user"]["username"] == "Super Admin"
        assert data["user"]["is_super_admin"] == True
        
        # Verify token is provided
        assert "token" in data
        assert len(data["token"]) > 50
        
        print(f"✓ First login generated new key: {data['new_key'][:20]}...")
        
        # Now test that the initial setup key is rejected
        response2 = requests.post(f"{BASE_URL}/api/auth/login", json={
            "key": INITIAL_SETUP_KEY
        })
        assert response2.status_code == 401
        print("✓ Initial setup key rejected after first login")
        
        # Test that the new key works
        response3 = requests.post(f"{BASE_URL}/api/auth/login", json={
            "key": data["new_key"]
        })
        assert response3.status_code == 200
        data3 = response3.json()
        assert data3["first_login"] == False
        assert data3["new_key"] is None
        print("✓ New generated key works for subsequent login")


class TestLoginResponseStructure:
    """Test the login response structure includes first_login and new_key fields"""
    
    def test_login_response_has_required_fields(self):
        """Login response should always have first_login and new_key fields"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "key": CURRENT_SUPER_ADMIN_KEY
        })
        assert response.status_code == 200
        data = response.json()
        
        # Check all required fields exist
        required_fields = ["token", "user", "first_login", "new_key"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Check user object structure
        user_fields = ["id", "username", "is_super_admin", "permissions"]
        for field in user_fields:
            assert field in data["user"], f"Missing user field: {field}"
        
        print("✓ Login response has all required fields")


class TestInvalidKeyRejection:
    """Test that invalid keys are rejected"""
    
    def test_random_key_rejected(self):
        """POST /api/auth/login with random key should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "key": "some-random-invalid-key-12345"
        })
        assert response.status_code == 401
        data = response.json()
        assert data["detail"] == "Invalid access key"
        print("✓ Random invalid key is rejected")
    
    def test_empty_key_rejected(self):
        """POST /api/auth/login with empty key should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "key": ""
        })
        assert response.status_code == 401
        data = response.json()
        assert data["detail"] == "Invalid access key"
        print("✓ Empty key is rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
