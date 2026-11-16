from uuid import uuid4

import pytest

from slotera_api.db.models import FormTemplate
from slotera_api.form_validation import FormValidationError, validate_form_responses


def validate(kind: str, value: object, *, required: bool = True) -> None:
    form = FormTemplate(
        id=uuid4(),
        name="Prep",
        required_before_payment=True,
        fields=[
            {
                "id": "q",
                "label": "Question",
                "type": kind,
                "required": required,
                **({"options": ["A", "B"]} if kind.endswith("select") else {}),
            }
        ],
    )
    validate_form_responses(
        [form], [{"form_template_id": form.id, "answers": [{"field_id": "q", "value": value}]}]
    )


@pytest.mark.parametrize(
    ("kind", "value"),
    [
        ("yes_no", False),
        ("yes_no", True),
        ("short_text", "Hello"),
        ("long_text", "Context"),
        ("date", "2026-12-01"),
        ("single_select", "A"),
        ("multi_select", ["A", "B"]),
        ("consent_checkbox", True),
        ("consent_checkbox", False),
    ],
)
def test_valid_form_values(kind: str, value: object) -> None:
    validate(kind, value, required=not (kind == "consent_checkbox" and value is False))


@pytest.mark.parametrize(
    ("kind", "value"),
    [
        ("yes_no", "yes"),
        ("short_text", []),
        ("short_text", "  "),
        ("date", "2026-02-30"),
        ("single_select", "C"),
        ("single_select", ["A"]),
        ("multi_select", "A"),
        ("multi_select", ["A", "A"]),
        ("consent_checkbox", False),
    ],
)
def test_invalid_form_values(kind: str, value: object) -> None:
    with pytest.raises(FormValidationError):
        validate(kind, value)


@pytest.mark.parametrize("value", [0, 1, "true", "false", [1]])
def test_http_answer_schema_rejects_coercion_for_boolean_values(value: object) -> None:
    from pydantic import ValidationError

    from slotera_api.schemas.public_booking import PublicFormAnswer

    # Strings are valid for text fields; validation against yes/no fields still rejects them.
    if isinstance(value, str):
        with pytest.raises(FormValidationError):
            validate("yes_no", value)
    else:
        with pytest.raises(ValidationError):
            PublicFormAnswer.model_validate({"fieldId": "q", "value": value})
