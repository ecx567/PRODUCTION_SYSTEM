"""
Tests for the Fields domain: CRUD, pagination, tenant isolation, soft-delete.

Covers tasks 3.1 and 3.5 from the apply spec.
"""

from __future__ import annotations

from uuid import UUID

import pytest
from fastapi import status

pytestmark = pytest.mark.asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


# ═══════════════════════════════════════════════════════════════
# Service-level tests
# ═══════════════════════════════════════════════════════════════

class TestFieldsService:
    """Tests for FieldsService CRUD operations."""

    async def test_create_field(
        self,
        fields_service,
        tenant_id: UUID,
        db_session: AsyncSession,
        sample_field_create: dict,
    ):
        """A valid field is created and returned with an ID."""
        from app.domain.fields.schemas import FieldCreate
        data = FieldCreate(**sample_field_create)
        result = await fields_service.create_field(data, tenant_id, db_session)
        assert result.id is not None
        assert result.name == "Test North Field"
        assert result.crop_type == "maize"
        assert result.area_ha == 12.5
        assert result.deleted_at is None

    async def test_create_field_invalid_crop_type(
        self,
        fields_service,
        tenant_id: UUID,
        db_session: AsyncSession,
    ):
        """Creating a field with an invalid crop type raises a validation error."""
        from pydantic import ValidationError
        from app.domain.fields.schemas import FieldCreate
        with pytest.raises(ValidationError, match="Invalid crop type"):
            FieldCreate(name="Bad", crop_type="wheat", area_ha=1.0)

    async def test_get_field(
        self,
        fields_service,
        tenant_id: UUID,
        db_session: AsyncSession,
        sample_field_create: dict,
    ):
        """Getting a field by ID returns the correct field."""
        from app.domain.fields.schemas import FieldCreate
        created = await fields_service.create_field(
            FieldCreate(**sample_field_create), tenant_id, db_session,
        )
        fetched = await fields_service.get_field(created.id, tenant_id, db_session)
        assert fetched is not None
        assert fetched.id == created.id
        assert fetched.name == "Test North Field"

    async def test_get_field_not_found(
        self,
        fields_service,
        tenant_id: UUID,
        db_session: AsyncSession,
    ):
        """Getting a non-existent field returns None."""
        result = await fields_service.get_field(
            UUID("00000000-0000-0000-0000-000000000000"),
            tenant_id, db_session,
        )
        assert result is None

    async def test_update_field(
        self,
        fields_service,
        tenant_id: UUID,
        db_session: AsyncSession,
        sample_field_create: dict,
    ):
        """Updating a field changes only the specified fields."""
        from app.domain.fields.schemas import FieldCreate, FieldUpdate
        created = await fields_service.create_field(
            FieldCreate(**sample_field_create), tenant_id, db_session,
        )
        updated = await fields_service.update_field(
            created.id,
            FieldUpdate(name="Updated Field", area_ha=20.0),
            tenant_id, db_session,
        )
        assert updated is not None
        assert updated.name == "Updated Field"
        assert updated.area_ha == 20.0
        assert updated.crop_type == "maize"  # unchanged

    async def test_soft_delete_field(
        self,
        fields_service,
        tenant_id: UUID,
        db_session: AsyncSession,
        sample_field_create: dict,
    ):
        """Soft-deleted field is no longer returned by get/list."""
        from app.domain.fields.schemas import FieldCreate
        created = await fields_service.create_field(
            FieldCreate(**sample_field_create), tenant_id, db_session,
        )
        deleted = await fields_service.soft_delete_field(created.id, tenant_id, db_session)
        assert deleted is True

        # Should not appear in get
        fetched = await fields_service.get_field(created.id, tenant_id, db_session)
        assert fetched is None

        # Should not appear in list
        field_list = await fields_service.list_fields(tenant_id, db_session)
        assert created.id not in [f.id for f in field_list.items]

    async def test_list_fields_pagination(
        self,
        fields_service,
        tenant_id: UUID,
        db_session: AsyncSession,
    ):
        """Cursor-based pagination returns correct pages."""
        from app.domain.fields.schemas import FieldCreate

        # Create 5 fields
        created_ids = []
        for i in range(5):
            f = await fields_service.create_field(
                FieldCreate(name=f"Field {i}", crop_type="maize", area_ha=1.0 + i),
                tenant_id, db_session,
            )
            created_ids.append(f.id)

        # First page: 2 items
        page1 = await fields_service.list_fields(tenant_id, db_session, page_size=2)
        assert len(page1.items) == 2
        assert page1.next_cursor is not None
        assert page1.total >= 5

        # Second page: 2 items
        page2 = await fields_service.list_fields(
            tenant_id, db_session, cursor=page1.next_cursor, page_size=2,
        )
        assert len(page2.items) == 2

        # Third page: remaining items
        page3 = await fields_service.list_fields(
            tenant_id, db_session, cursor=page2.next_cursor, page_size=2,
        )
        assert len(page3.items) >= 1

    async def test_tenant_isolation(
        self,
        fields_service,
        tenant_id: UUID,
        other_tenant_id: UUID,
        db_session: AsyncSession,
        sample_field_create: dict,
        sample_field_create_banana: dict,
    ):
        """Fields from one tenant are invisible to another tenant."""
        from app.domain.fields.schemas import FieldCreate

        # Create field for tenant A
        await fields_service.create_field(
            FieldCreate(**sample_field_create), tenant_id, db_session,
        )
        # Create field for tenant B
        await fields_service.create_field(
            FieldCreate(**sample_field_create_banana), other_tenant_id, db_session,
        )

        # Tenant A sees only their field
        tenant_a_list = await fields_service.list_fields(tenant_id, db_session)
        assert len(tenant_a_list.items) == 1
        assert tenant_a_list.items[0].name == "Test North Field"

        # Tenant B sees only their field
        tenant_b_list = await fields_service.list_fields(other_tenant_id, db_session)
        assert len(tenant_b_list.items) == 1
        assert tenant_b_list.items[0].name == "Banana Plantation"


# ═══════════════════════════════════════════════════════════════
# API-level tests
# ═══════════════════════════════════════════════════════════════

class TestFieldsAPI:
    """Tests for the Fields REST API endpoints."""

    async def test_create_field_api(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_field_create: dict,
    ):
        """POST /api/v1/fields returns 201 with the created field."""
        response = await client.post(
            "/api/v1/fields",
            json=sample_field_create,
            headers=auth_headers,
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "Test North Field"
        assert data["crop_type"] == "maize"
        assert "id" in data

    async def test_create_field_unauthorized(
        self,
        client: AsyncClient,
        sample_field_create: dict,
    ):
        """POST /api/v1/fields without auth returns 401."""
        response = await client.post(
            "/api/v1/fields",
            json=sample_field_create,
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_list_fields_api(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_field_create: dict,
    ):
        """GET /api/v1/fields returns paginated fields."""
        # Create a field first
        await client.post("/api/v1/fields", json=sample_field_create, headers=auth_headers)

        response = await client.get(
            "/api/v1/fields",
            headers=auth_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "items" in data
        assert len(data["items"]) >= 1
        assert data["items"][0]["name"] == "Test North Field"

    async def test_get_field_api(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_field_create: dict,
    ):
        """GET /api/v1/fields/{id} returns field details."""
        # Create
        create_resp = await client.post(
            "/api/v1/fields", json=sample_field_create, headers=auth_headers,
        )
        field_id = create_resp.json()["id"]

        # Get
        response = await client.get(f"/api/v1/fields/{field_id}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == field_id
        assert data["name"] == "Test North Field"

    async def test_get_field_not_found_api(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """GET /api/v1/fields/{id} for non-existent field returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.get(f"/api/v1/fields/{fake_id}", headers=auth_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_update_field_api(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_field_create: dict,
    ):
        """PUT /api/v1/fields/{id} updates field."""
        # Create
        create_resp = await client.post(
            "/api/v1/fields", json=sample_field_create, headers=auth_headers,
        )
        field_id = create_resp.json()["id"]

        # Update
        response = await client.put(
            f"/api/v1/fields/{field_id}",
            json={"name": "Updated Name", "area_ha": 30.0},
            headers=auth_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["area_ha"] == 30.0

    async def test_delete_field_api(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_field_create: dict,
    ):
        """DELETE /api/v1/fields/{id} soft-deletes and returns 204."""
        # Create
        create_resp = await client.post(
            "/api/v1/fields", json=sample_field_create, headers=auth_headers,
        )
        field_id = create_resp.json()["id"]

        # Delete
        response = await client.delete(f"/api/v1/fields/{field_id}", headers=auth_headers)
        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify deleted
        get_resp = await client.get(f"/api/v1/fields/{field_id}", headers=auth_headers)
        assert get_resp.status_code == status.HTTP_404_NOT_FOUND

    async def test_tenant_isolation_api(
        self,
        client: AsyncClient,
        auth_headers: dict,
        other_tenant_token: str,
        sample_field_create: dict,
    ):
        """Tenant A cannot see Tenant B's fields via API."""
        # Create field as tenant A
        create_resp = await client.post(
            "/api/v1/fields", json=sample_field_create, headers=auth_headers,
        )
        field_id = create_resp.json()["id"]

        # Tenant B tries to access it
        other_headers = {"Authorization": f"Bearer {other_tenant_token}"}
        response = await client.get(f"/api/v1/fields/{field_id}", headers=other_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND
