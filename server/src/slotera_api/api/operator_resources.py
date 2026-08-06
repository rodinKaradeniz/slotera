from http import HTTPStatus
from typing import Annotated, Any, Literal, cast
from uuid import UUID

from fastapi import APIRouter, Query, Response

from slotera_api.auth.dependencies import (
    CsrfOperatorWorkspaceDependency,
    DatabaseDependency,
    OperatorWorkspaceDependency,
)
from slotera_api.db.models import (
    LocationType,
    Service,
    Workspace,
    WorkspaceBusinessProfile,
    WorkspaceLocation,
    WorkspacePaymentSettings,
)
from slotera_api.errors import ApiError
from slotera_api.operator_resources.repository import OperatorResourcesRepository
from slotera_api.schemas.operator_resources import (
    Address,
    BusinessSettingsPatch,
    BusinessSettingsResponse,
    PaymentSettingsPatch,
    PaymentSettingsResponse,
    ServiceCreate,
    ServiceListResponse,
    ServicePatch,
    ServiceResponse,
    WorkspaceLocationCreate,
    WorkspaceLocationListResponse,
    WorkspaceLocationPatch,
    WorkspaceLocationResponse,
)

settings_router = APIRouter(prefix="/settings", tags=["settings"])
services_router = APIRouter(prefix="/services", tags=["services"])


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _not_found(code: str, message: str) -> ApiError:
    return ApiError(status_code=HTTPStatus.NOT_FOUND, code=code, message=message)


def _business_response(
    workspace: Workspace, profile: WorkspaceBusinessProfile
) -> BusinessSettingsResponse:
    return BusinessSettingsResponse(
        workspace_id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        currency=workspace.currency,
        timezone=workspace.timezone,
        display_name=profile.display_name,
        bio=profile.bio,
        email=profile.email,
        phone=profile.phone,
        address=profile.address,
        booking_page_enabled=profile.booking_page_enabled,
        updated_at=max(workspace.updated_at, profile.updated_at),
    )


def _payment_response(item: WorkspacePaymentSettings) -> PaymentSettingsResponse:
    return PaymentSettingsResponse(
        manual_payment_enabled=item.manual_payment_enabled,
        manual_payment_instructions=item.manual_payment_instructions,
        booking_terms_enabled=item.booking_terms_enabled,
        booking_terms_content=item.booking_terms_content,
        tax_treatment=cast(Literal["none", "fixed"], item.tax_treatment),
        tax_rate_bps=item.tax_rate_bps,
        tax_label=item.tax_label,
        tax_jurisdiction=item.tax_jurisdiction,
        seller_tax_number=item.seller_tax_number,
        updated_at=item.updated_at,
    )


def _address_from_location(location: WorkspaceLocation) -> Address:
    return Address(
        street=location.street,
        street2=location.street2,
        city=location.city,
        region=location.region,
        postal_code=location.postal_code,
        country=location.country,
        notes=location.notes,
    )


def _location_response(location: WorkspaceLocation) -> WorkspaceLocationResponse:
    return WorkspaceLocationResponse(
        id=location.id,
        label=location.label,
        address=_address_from_location(location),
        created_at=location.created_at,
        updated_at=location.updated_at,
    )


def _service_response(service: Service, currency: str) -> ServiceResponse:
    return ServiceResponse(
        id=service.id,
        name=service.name,
        description=service.description,
        duration_min=service.duration_min,
        price_cents=service.price_cents,
        currency=currency,
        capacity=service.capacity,
        location_type=service.location_type.value,
        location=service.location,
        address=Address.model_validate(service.address) if service.address else None,
        booking_mode=service.booking_mode.value,
        confirmation_policy=service.confirmation_policy.value,
        cancellation_rule=service.cancellation_rule,
        active=service.active,
        notes=service.notes,
        created_at=service.created_at,
        updated_at=service.updated_at,
    )


def _location_values(payload: WorkspaceLocationCreate | WorkspaceLocationPatch) -> dict[str, Any]:
    changes: dict[str, Any] = {}
    if "label" in payload.model_fields_set:
        changes["label"] = payload.label
    if "address" in payload.model_fields_set and payload.address is not None:
        changes.update(payload.address.model_dump())
    return changes


def _service_values(payload: ServiceCreate | ServicePatch) -> dict[str, Any]:
    values = payload.model_dump(exclude_unset=True)
    if "address" in payload.model_fields_set and payload.address is not None:
        values["address"] = payload.address.model_dump()
    if values.get("location_type") == "online":
        values["address"] = None
    return values


@settings_router.get(
    "/business", response_model=BusinessSettingsResponse, operation_id="getBusinessSettings"
)
async def get_business_settings(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> BusinessSettingsResponse:
    result = await OperatorResourcesRepository(database).get_business(operator.workspace_id)
    if result is None:
        raise _not_found("business_settings_not_found", "Business settings were not found")
    _private(response)
    return _business_response(*result)


@settings_router.patch(
    "/business", response_model=BusinessSettingsResponse, operation_id="updateBusinessSettings"
)
async def update_business_settings(
    payload: BusinessSettingsPatch,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> BusinessSettingsResponse:
    changes = payload.model_dump(exclude_unset=True)
    workspace_changes = {key: changes[key] for key in ("name", "timezone") if key in changes}
    profile_changes = {key: value for key, value in changes.items() if key not in workspace_changes}
    repository = OperatorResourcesRepository(database)
    result = (
        await repository.update_business(
            operator.workspace_id, operator.user_id, workspace_changes, profile_changes
        )
        if changes
        else await repository.get_business(operator.workspace_id)
    )
    if result is None:
        raise _not_found("business_settings_not_found", "Business settings were not found")
    _private(response)
    return _business_response(*result)


@settings_router.get(
    "/payments",
    response_model=PaymentSettingsResponse,
    operation_id="getPaymentSettings",
)
async def get_payment_settings(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> PaymentSettingsResponse:
    item = await OperatorResourcesRepository(database).get_payment_settings(operator.workspace_id)
    if item is None:
        raise _not_found("payment_settings_not_found", "Payment settings were not found")
    _private(response)
    return _payment_response(item)


@settings_router.patch(
    "/payments",
    response_model=PaymentSettingsResponse,
    operation_id="updatePaymentSettings",
)
async def update_payment_settings(
    payload: PaymentSettingsPatch,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> PaymentSettingsResponse:
    repository = OperatorResourcesRepository(database)
    changes = payload.model_dump(exclude_unset=True)
    item = (
        await repository.update_payment_settings(operator.workspace_id, operator.user_id, changes)
        if changes
        else await repository.get_payment_settings(operator.workspace_id)
    )
    if item is None:
        raise ApiError(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            code="payment_settings_invalid",
            message="Payment settings are invalid",
        )
    _private(response)
    return _payment_response(item)


@settings_router.get(
    "/locations",
    response_model=WorkspaceLocationListResponse,
    operation_id="listWorkspaceLocations",
)
async def list_workspace_locations(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> WorkspaceLocationListResponse:
    locations = await OperatorResourcesRepository(database).list_locations(operator.workspace_id)
    _private(response)
    return WorkspaceLocationListResponse(items=[_location_response(item) for item in locations])


@settings_router.post(
    "/locations",
    response_model=WorkspaceLocationResponse,
    status_code=HTTPStatus.CREATED,
    operation_id="createWorkspaceLocation",
)
async def create_workspace_location(
    payload: WorkspaceLocationCreate,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> WorkspaceLocationResponse:
    location = await OperatorResourcesRepository(database).create_location(
        operator.workspace_id, operator.user_id, _location_values(payload)
    )
    _private(response)
    return _location_response(location)


@settings_router.patch(
    "/locations/{location_id}",
    response_model=WorkspaceLocationResponse,
    operation_id="updateWorkspaceLocation",
)
async def update_workspace_location(
    location_id: UUID,
    payload: WorkspaceLocationPatch,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> WorkspaceLocationResponse:
    repository = OperatorResourcesRepository(database)
    changes = _location_values(payload)
    location = (
        await repository.update_location(
            operator.workspace_id, operator.user_id, location_id, changes
        )
        if changes
        else next(
            (
                item
                for item in await repository.list_locations(operator.workspace_id)
                if item.id == location_id
            ),
            None,
        )
    )
    if location is None:
        raise _not_found("location_not_found", "Saved location was not found")
    _private(response)
    return _location_response(location)


@settings_router.delete(
    "/locations/{location_id}",
    status_code=HTTPStatus.NO_CONTENT,
    operation_id="deleteWorkspaceLocation",
)
async def delete_workspace_location(
    location_id: UUID,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> Response:
    deleted = await OperatorResourcesRepository(database).delete_location(
        operator.workspace_id, operator.user_id, location_id
    )
    if not deleted:
        raise _not_found("location_not_found", "Saved location was not found")
    return Response(status_code=HTTPStatus.NO_CONTENT, headers={"Cache-Control": "no-store"})


@services_router.get("", response_model=ServiceListResponse, operation_id="listServices")
async def list_services(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    search: Annotated[str | None, Query(max_length=160)] = None,
    active: bool | None = None,
    location_type: Annotated[LocationType | None, Query(alias="locationType")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ServiceListResponse:
    items, total, currency = await OperatorResourcesRepository(database).list_services(
        operator.workspace_id,
        search=search,
        active=active,
        location_type=location_type,
        limit=limit,
        offset=offset,
    )
    _private(response)
    return ServiceListResponse(
        items=[_service_response(item, currency) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@services_router.post(
    "", response_model=ServiceResponse, status_code=HTTPStatus.CREATED, operation_id="createService"
)
async def create_service(
    payload: ServiceCreate,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> ServiceResponse:
    service, currency = await OperatorResourcesRepository(database).create_service(
        operator.workspace_id, operator.user_id, _service_values(payload)
    )
    _private(response)
    return _service_response(service, currency)


@services_router.get("/{service_id}", response_model=ServiceResponse, operation_id="getService")
async def get_service(
    service_id: UUID,
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> ServiceResponse:
    result = await OperatorResourcesRepository(database).get_service(
        operator.workspace_id, service_id
    )
    if result is None:
        raise _not_found("service_not_found", "Service was not found")
    _private(response)
    return _service_response(*result)


@services_router.patch(
    "/{service_id}", response_model=ServiceResponse, operation_id="updateService"
)
async def update_service(
    service_id: UUID,
    payload: ServicePatch,
    response: Response,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> ServiceResponse:
    repository = OperatorResourcesRepository(database)
    changes = _service_values(payload)
    result = (
        await repository.update_service(
            operator.workspace_id, operator.user_id, service_id, changes
        )
        if changes
        else await repository.get_service(operator.workspace_id, service_id)
    )
    if result is None:
        raise _not_found("service_not_found", "Service was not found")
    _private(response)
    return _service_response(*result)


@services_router.delete(
    "/{service_id}", status_code=HTTPStatus.NO_CONTENT, operation_id="deleteService"
)
async def delete_service(
    service_id: UUID,
    operator: CsrfOperatorWorkspaceDependency,
    database: DatabaseDependency,
) -> Response:
    deleted = await OperatorResourcesRepository(database).delete_service(
        operator.workspace_id, operator.user_id, service_id
    )
    if not deleted:
        raise _not_found("service_not_found", "Service was not found")
    return Response(status_code=HTTPStatus.NO_CONTENT, headers={"Cache-Control": "no-store"})
